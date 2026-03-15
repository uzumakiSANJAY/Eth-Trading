const axios = require('axios');
const logger = require('../utils/logger');
const { setCache, getCache } = require('../database/config/redis');

const CACHE_TTL = 1800; // 30 minutes - avoid repeated Gemini calls
const MAX_HEADLINES = 8; // token budget cap
// gemini-2.5-flash: thinking model, needs ~500 tokens for thinking+output but still cheap
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Google News RSS queries for ETH / crypto
const RSS_URLS = [
  'https://news.google.com/rss/search?q=ethereum+ETH+crypto&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=crypto+market+bitcoin+altcoin&hl=en-US&gl=US&ceid=US:en',
];

class NewsService {
  /**
   * Fetch headlines from Google News RSS (no API key needed).
   * Returns up to MAX_HEADLINES plain-text headlines.
   */
  async fetchHeadlines() {
    const cacheKey = 'news:headlines';
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const headlines = [];

    for (const url of RSS_URLS) {
      try {
        const res = await axios.get(url, {
          timeout: 8000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        // Extract all <title> tags; skip index 0 (channel title)
        const raw = res.data;
        const matches = [...raw.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi)];

        for (let i = 1; i < matches.length; i++) {
          const title = (matches[i][1] || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
          if (title && title.length > 10 && !title.toLowerCase().includes('google news')) {
            headlines.push(title);
          }
          if (headlines.length >= MAX_HEADLINES) break;
        }
      } catch (err) {
        logger.warn(`News RSS fetch failed (${url}): ${err.message}`);
      }
      if (headlines.length >= MAX_HEADLINES) break;
    }

    const result = headlines.slice(0, MAX_HEADLINES);
    if (result.length > 0) {
      await setCache(cacheKey, result, CACHE_TTL);
    }

    return result;
  }

  /**
   * Call Gemini Flash with a minimal prompt.
   * Returns { sentiment, score, reason, impactLevel }
   * Tokens used: ~200 input + ~80 output per call (very small).
   */
  async analyzeWithGemini(headlines) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY not set - skipping news LLM analysis');
      return null;
    }
    if (!headlines || headlines.length === 0) return null;

    // Ultra-compact prompt - single aggregated sentiment, strict JSON
    const prompt = `Crypto news analyst task: read the headlines below and output ONE single aggregated JSON object (not an array) representing the OVERALL ETH market sentiment. No markdown, no explanation, just raw JSON.
Format: {"sentiment":"bullish|bearish|neutral","score":0.0,"reason":"one sentence max 12 words","impact":"high|medium|low"}

Headlines:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Output ONLY the JSON object:`;

    try {
      const res = await axios.post(
        `${GEMINI_URL}?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048, // thinking model: ~800 thinking + ~200 output, cached 30min so cost is minimal
            candidateCount: 1,
          },
        },
        { timeout: 35000 } // 2.5-flash thinking takes ~30s
      );

      // gemini-2.5-flash returns multiple parts (thought + response); find the non-thought part
      const parts = res.data?.candidates?.[0]?.content?.parts || [];
      const text = parts.find(p => !p.thought && p.text)?.text || '';
      // Extract first {...} JSON object - handles markdown fences and arrays
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) throw new Error('No JSON object in Gemini response');
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        sentiment: parsed.sentiment || 'neutral',
        score: parseFloat(parsed.score) || 0,
        reason: parsed.reason || '',
        impactLevel: parsed.impact || 'low',
        headlineCount: headlines.length,
      };
    } catch (err) {
      logger.error(`Gemini analysis failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Main entry: fetch headlines + get Gemini sentiment.
   * Caches the full analysis result for 30 min.
   */
  async getNewsSentiment() {
    const cacheKey = 'news:sentiment';
    const cached = await getCache(cacheKey);
    if (cached) {
      logger.info('News sentiment served from cache');
      return cached;
    }

    const headlines = await this.fetchHeadlines();
    const analysis = await this.analyzeWithGemini(headlines);

    if (!analysis) {
      return {
        sentiment: 'neutral',
        score: 0,
        reason: 'No analysis available',
        impactLevel: 'low',
        headlines,
        cached: false,
      };
    }

    const result = { ...analysis, headlines, cached: false };
    await setCache(cacheKey, result, CACHE_TTL);

    logger.info(`News sentiment: ${result.sentiment} (score: ${result.score}, impact: ${result.impactLevel})`);
    return result;
  }

  /**
   * Convert news sentiment into a score modifier for signal generation.
   * Returns { boost, direction } where boost is 0-2 score points.
   */
  sentimentToSignalScore(newsSentiment) {
    if (!newsSentiment || newsSentiment.sentiment === 'neutral') {
      return { boost: 0, direction: 'neutral' };
    }

    const impactMultiplier = { high: 2, medium: 1, low: 0 };
    const boost = impactMultiplier[newsSentiment.impactLevel] || 0;

    return {
      boost,
      direction: newsSentiment.sentiment, // 'bullish' | 'bearish'
    };
  }
}

module.exports = new NewsService();
