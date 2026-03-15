const axios = require('axios');
const logger = require('../utils/logger');
const { setCache, getCache } = require('../database/config/redis');

const BULLISH_KEYWORDS = ['bullish', 'pump', 'moon', 'buy', 'accumulate', 'breakout', 'break out', 'surge', 'rally', 'upside', 'long', 'green', 'ath', 'adoption', 'staking', 'upgrade', 'institutional', 'etf', 'positive'];
const BEARISH_KEYWORDS = ['bearish', 'dump', 'crash', 'sell', 'short', 'correction', 'rekt', 'rug', 'scam', 'fear', 'capitulation', 'bottom', 'warning', 'down', 'bear', 'liquidation', 'panic', 'collapse', 'exit'];

const SUBREDDITS = [
  { name: 'ethereum', url: 'https://www.reddit.com/r/ethereum/hot.json?limit=25' },
  { name: 'ethtrader', url: 'https://www.reddit.com/r/ethtrader/hot.json?limit=25' },
  { name: 'cryptocurrency', url: 'https://www.reddit.com/r/CryptoCurrency/search.json?q=ethereum&sort=hot&t=day&limit=15' }
];

class RedditService {
  scoreTitle(title) {
    const lower = title.toLowerCase();
    let bullish = 0, bearish = 0;
    for (const kw of BULLISH_KEYWORDS) { if (lower.includes(kw)) bullish++; }
    for (const kw of BEARISH_KEYWORDS) { if (lower.includes(kw)) bearish++; }
    return { bullish, bearish };
  }

  async fetchSubreddit(subreddit) {
    try {
      const res = await axios.get(subreddit.url, {
        timeout: 8000,
        headers: { 'User-Agent': 'ETH-Trading-Bot/1.0' }
      });
      const posts = res.data?.data?.children || [];
      const now = Math.floor(Date.now() / 1000);
      const recent = posts
        .map(p => p.data)
        .filter(p => p.created_utc > now - 86400 && !p.stickied);
      return { name: subreddit.name, posts: recent };
    } catch (err) {
      logger.warn(`Reddit fetch failed (${subreddit.name}): ${err.message}`);
      return { name: subreddit.name, posts: [] };
    }
  }

  async getSentiment() {
    const cacheKey = 'social:reddit:sentiment';
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const results = await Promise.allSettled(SUBREDDITS.map(s => this.fetchSubreddit(s)));

    let weightedBullish = 0, weightedBearish = 0;
    let totalBullishPosts = 0, totalBearishPosts = 0, totalPosts = 0;
    const allPosts = [];
    const subredditStats = {};

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { name, posts } = result.value;
      let subBullish = 0, subBearish = 0;

      for (const post of posts) {
        const weight = Math.log(Math.max(post.score, 1) + 1) * (post.upvote_ratio || 0.5);
        const { bullish, bearish } = this.scoreTitle(post.title);
        if (bullish > bearish) { weightedBullish += weight * bullish; subBullish++; totalBullishPosts++; }
        else if (bearish > bullish) { weightedBearish += weight * bearish; subBearish++; totalBearishPosts++; }
        totalPosts++;
        allPosts.push({ title: post.title, score: post.score, upvote_ratio: post.upvote_ratio });
      }
      subredditStats[name] = { bullish: subBullish, bearish: subBearish, total: posts.length };
    }

    const sentimentScore = (weightedBullish - weightedBearish) / (weightedBullish + weightedBearish + 1);
    const normalizedScore = Math.max(-1, Math.min(1, sentimentScore));

    const topTitles = allPosts
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(p => p.title);

    let sentiment = 'neutral';
    if (normalizedScore > 0.15) sentiment = 'bullish';
    else if (normalizedScore < -0.15) sentiment = 'bearish';

    let intensity = 'weak';
    if (Math.abs(normalizedScore) > 0.4) intensity = 'strong';
    else if (Math.abs(normalizedScore) > 0.2) intensity = 'moderate';

    const data = {
      sentiment,
      score: parseFloat(normalizedScore.toFixed(3)),
      intensity,
      bullishPosts: totalBullishPosts,
      bearishPosts: totalBearishPosts,
      totalPostsAnalyzed: totalPosts,
      topTitles,
      subreddits: subredditStats
    };

    if (totalPosts > 0) await setCache(cacheKey, data, 900); // 15 min cache
    logger.info(`Reddit sentiment: ${sentiment} (${normalizedScore.toFixed(3)}) from ${totalPosts} posts`);
    return data;
  }

  scoreSentiment(redditData, proposedDirection) {
    if (!redditData || redditData.totalPostsAnalyzed < 5) return { boost: 0 };
    const { sentiment, intensity } = redditData;
    const intensityMap = { strong: 2, moderate: 1, weak: 0 };
    const boost = intensityMap[intensity] || 0;
    if (sentiment === proposedDirection) return { boost };
    if (sentiment !== 'neutral' && sentiment !== proposedDirection) return { boost: -boost };
    return { boost: 0 };
  }
}

module.exports = new RedditService();
