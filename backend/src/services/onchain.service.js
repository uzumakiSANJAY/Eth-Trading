const axios = require('axios');
const logger = require('../utils/logger');
const { setCache, getCache } = require('../database/config/redis');

class OnchainService {

  async getLongShortRatio(symbol = 'ETHUSDT') {
    const cacheKey = `onchain:ls:${symbol}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    try {
      const [globalRes, topRes, takerRes] = await Promise.all([
        axios.get(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=3`, { timeout: 5000 }),
        axios.get(`https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=1h&limit=3`, { timeout: 5000 }),
        axios.get(`https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${symbol}&period=1h&limit=3`, { timeout: 5000 })
      ]);

      const global = globalRes.data;
      const top = topRes.data;
      const taker = takerRes.data;

      const latestGlobal = parseFloat(global[global.length - 1].longShortRatio);
      const latestTop = parseFloat(top[top.length - 1].longShortRatio);
      const latestTakerBuy = parseFloat(taker[taker.length - 1].buySellRatio);

      const result = {
        longShortRatio: {
          ratio: parseFloat(latestGlobal.toFixed(3)),
          signal: latestGlobal > 1.8 ? 'overleveraged_long' : latestGlobal < 0.6 ? 'overleveraged_short' : 'balanced',
          bias: latestGlobal > 1.8 ? 'bearish' : latestGlobal < 0.6 ? 'bullish' : 'neutral'
        },
        topTraderRatio: {
          ratio: parseFloat(latestTop.toFixed(3)),
          signal: latestTop > 1.5 ? 'smart_money_long' : latestTop < 0.7 ? 'smart_money_short' : 'neutral',
          bias: latestTop > 1.5 ? 'bullish' : latestTop < 0.7 ? 'bearish' : 'neutral'
        },
        takerRatio: {
          buySellRatio: parseFloat(latestTakerBuy.toFixed(3)),
          buyPct: parseFloat((latestTakerBuy / (1 + latestTakerBuy) * 100).toFixed(1)),
          sellPct: parseFloat((1 / (1 + latestTakerBuy) * 100).toFixed(1)),
          bias: latestTakerBuy > 1.1 ? 'bullish' : latestTakerBuy < 0.9 ? 'bearish' : 'neutral'
        }
      };
      await setCache(cacheKey, result, 300);
      return result;
    } catch (err) {
      logger.warn(`Long/Short ratio fetch failed: ${err.message}`);
      return {
        longShortRatio: { ratio: 1, signal: 'neutral', bias: 'neutral' },
        topTraderRatio: { ratio: 1, signal: 'neutral', bias: 'neutral' },
        takerRatio: { buySellRatio: 1, buyPct: 50, sellPct: 50, bias: 'neutral' }
      };
    }
  }

  async getCoinGeckoSentiment() {
    const cacheKey = 'onchain:coingecko:eth';
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    try {
      const res = await axios.get(
        'https://api.coingecko.com/api/v3/coins/ethereum?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false',
        { timeout: 8000, headers: { 'Accept': 'application/json' } }
      );
      const coin = res.data;
      const upPct = coin.sentiment_votes_up_percentage || 50;
      const downPct = coin.sentiment_votes_down_percentage || 50;
      const redditActive = coin.community_data?.reddit_accounts_active_48h || 0;
      const redditPosts = coin.community_data?.reddit_average_posts_48h || 0;

      const result = {
        upPct: parseFloat(upPct.toFixed(1)),
        downPct: parseFloat(downPct.toFixed(1)),
        sentiment: upPct > 65 ? 'bullish' : upPct < 35 ? 'bearish' : 'neutral',
        redditActive,
        redditPosts: parseFloat(redditPosts.toFixed(1)),
        priceChange24h: coin.market_data?.price_change_percentage_24h || 0,
        priceChange7d: coin.market_data?.price_change_percentage_7d || 0
      };
      await setCache(cacheKey, result, 900); // 15 min
      return result;
    } catch (err) {
      logger.warn(`CoinGecko sentiment fetch failed: ${err.message}`);
      return { upPct: 50, downPct: 50, sentiment: 'neutral', redditActive: 0, redditPosts: 0 };
    }
  }

  async getDefiLlamaTVL() {
    const cacheKey = 'onchain:defillama:eth:tvl';
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    try {
      const res = await axios.get('https://api.llama.fi/v2/historicalChainTvl/Ethereum', { timeout: 8000 });
      const history = res.data;
      if (!history || history.length < 8) return { current: 0, change7dPct: 0, trend: 'stable' };

      const latest = history[history.length - 1].tvl;
      const week_ago = history[history.length - 8].tvl;
      const change7dPct = ((latest - week_ago) / week_ago) * 100;

      const result = {
        current: parseFloat((latest / 1e9).toFixed(2)), // in billions
        change7dPct: parseFloat(change7dPct.toFixed(2)),
        trend: change7dPct > 5 ? 'growing' : change7dPct < -5 ? 'shrinking' : 'stable'
      };
      await setCache(cacheKey, result, 3600); // 1 hour
      return result;
    } catch (err) {
      logger.warn(`DefiLlama TVL fetch failed: ${err.message}`);
      return { current: 0, change7dPct: 0, trend: 'stable' };
    }
  }

  async getAllOnchain(symbol = 'ETHUSDT') {
    const cacheKey = `onchain:all:${symbol}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const [lsResult, cgResult, tvlResult] = await Promise.allSettled([
      this.getLongShortRatio(symbol),
      this.getCoinGeckoSentiment(),
      this.getDefiLlamaTVL()
    ]);

    const ls = lsResult.status === 'fulfilled' ? lsResult.value : null;
    const cg = cgResult.status === 'fulfilled' ? cgResult.value : null;
    const tvl = tvlResult.status === 'fulfilled' ? tvlResult.value : null;

    // Composite score -1 to +1
    let bullishSignals = 0, bearishSignals = 0, total = 0;

    if (ls) {
      if (ls.longShortRatio.bias === 'bullish') { bullishSignals += 2; total += 2; }
      else if (ls.longShortRatio.bias === 'bearish') { bearishSignals += 2; total += 2; }
      else total += 1;

      if (ls.topTraderRatio.bias === 'bullish') { bullishSignals += 2; total += 2; }
      else if (ls.topTraderRatio.bias === 'bearish') { bearishSignals += 2; total += 2; }
      else total += 1;

      if (ls.takerRatio.bias === 'bullish') { bullishSignals += 1; total += 1; }
      else if (ls.takerRatio.bias === 'bearish') { bearishSignals += 1; total += 1; }
      else total += 1;
    }

    if (cg) {
      if (cg.sentiment === 'bullish') { bullishSignals += 1; total += 1; }
      else if (cg.sentiment === 'bearish') { bearishSignals += 1; total += 1; }
      else total += 1;
    }

    if (tvl) {
      if (tvl.trend === 'growing') { bullishSignals += 1; total += 1; }
      else if (tvl.trend === 'shrinking') { bearishSignals += 1; total += 1; }
      else total += 1;
    }

    const compositeScore = total > 0 ? (bullishSignals - bearishSignals) / total : 0;
    const compositeBias = compositeScore > 0.2 ? 'bullish' : compositeScore < -0.2 ? 'bearish' : 'neutral';

    const result = {
      longShortRatio: ls?.longShortRatio || null,
      topTraderRatio: ls?.topTraderRatio || null,
      takerRatio: ls?.takerRatio || null,
      communityVotes: cg ? { upPct: cg.upPct, downPct: cg.downPct, sentiment: cg.sentiment } : null,
      redditActivity: cg ? { active48h: cg.redditActive, avgPosts48h: cg.redditPosts } : null,
      defiTVL: tvl,
      compositeScore: parseFloat(compositeScore.toFixed(3)),
      compositeBias
    };

    await setCache(cacheKey, result, 300);
    logger.info(`On-chain composite: ${compositeBias} (${compositeScore.toFixed(3)})`);
    return result;
  }

  scoreOnchain(onchainData, proposedDirection) {
    if (!onchainData) return { boost: 0 };
    const { compositeScore, compositeBias, topTraderRatio } = onchainData;

    let boost = 0;

    // Smart money (top trader) has highest weight
    if (topTraderRatio) {
      if (topTraderRatio.bias === proposedDirection) boost += 1;
      else if (topTraderRatio.bias !== 'neutral' && topTraderRatio.bias !== proposedDirection) boost -= 1;
    }

    // Composite score
    if (compositeBias === proposedDirection && Math.abs(compositeScore) > 0.3) boost += 1;
    else if (compositeBias !== 'neutral' && compositeBias !== proposedDirection && Math.abs(compositeScore) > 0.3) boost -= 1;

    return { boost: Math.max(-2, Math.min(2, boost)) };
  }
}

module.exports = new OnchainService();
