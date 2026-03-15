const axios = require('axios');
const logger = require('../utils/logger');
const { setCache, getCache } = require('../database/config/redis');

class MarketIntelService {

  // Fear & Greed Index (free, no key needed)
  // Cache 1 hour
  async getFearGreedIndex() {
    const cacheKey = 'intel:feargreed';
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    try {
      const res = await axios.get('https://api.alternative.me/fng/?limit=1', { timeout: 5000 });
      const data = res.data.data[0];
      const result = {
        value: parseInt(data.value),
        classification: data.value_classification, // e.g. "Fear", "Extreme Fear", "Greed"
        signal: parseInt(data.value) <= 25 ? 'extreme_fear' : parseInt(data.value) <= 45 ? 'fear' : parseInt(data.value) >= 75 ? 'extreme_greed' : parseInt(data.value) >= 55 ? 'greed' : 'neutral'
      };
      await setCache(cacheKey, result, 3600);
      return result;
    } catch (err) {
      logger.warn(`Fear & Greed fetch failed: ${err.message}`);
      return { value: 50, classification: 'Neutral', signal: 'neutral' };
    }
  }

  // Funding Rate from Binance futures (free, no key needed for public endpoint)
  // Cache 5 minutes
  async getFundingRate(symbol = 'ETHUSDT') {
    const cacheKey = `intel:funding:${symbol}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    try {
      const res = await axios.get(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=3`, { timeout: 5000 });
      const rates = res.data;
      const latest = parseFloat(rates[rates.length - 1].fundingRate);
      const avg = rates.reduce((s, r) => s + parseFloat(r.fundingRate), 0) / rates.length;
      // Positive funding = longs paying shorts = market overleveraged long = bearish pressure
      // Negative funding = shorts paying longs = market overleveraged short = bullish pressure
      const result = {
        rate: latest,
        ratePercent: (latest * 100).toFixed(4),
        avgRate: avg,
        signal: latest > 0.001 ? 'overleveraged_long' : latest < -0.001 ? 'overleveraged_short' : 'neutral',
        bias: latest > 0.001 ? 'bearish' : latest < -0.001 ? 'bullish' : 'neutral'
      };
      await setCache(cacheKey, result, 300);
      return result;
    } catch (err) {
      logger.warn(`Funding rate fetch failed: ${err.message}`);
      return { rate: 0, ratePercent: '0', avgRate: 0, signal: 'neutral', bias: 'neutral' };
    }
  }

  // Open Interest from Binance futures (free)
  // Cache 5 minutes
  async getOpenInterest(symbol = 'ETHUSDT') {
    const cacheKey = `intel:oi:${symbol}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    try {
      // Get current OI and OI history (5 data points, 1h interval)
      const [currentRes, histRes] = await Promise.all([
        axios.get(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`, { timeout: 5000 }),
        axios.get(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=5`, { timeout: 5000 })
      ]);
      const currentOI = parseFloat(currentRes.data.openInterest);
      const hist = histRes.data;
      const oldOI = parseFloat(hist[0].sumOpenInterest);
      const oiChange = ((currentOI - oldOI) / oldOI) * 100;

      // Rising OI + rising price = strong trend (healthy)
      // Rising OI + falling price = bearish pressure (shorts piling in)
      // Falling OI + rising price = weak rally (short covering only)
      // Falling OI + falling price = capitulation (could be near bottom)
      const result = {
        current: currentOI,
        change4h: parseFloat(oiChange.toFixed(2)),
        trend: oiChange > 2 ? 'increasing' : oiChange < -2 ? 'decreasing' : 'stable',
        signal: oiChange > 3 ? 'strong_positioning' : oiChange < -3 ? 'unwinding' : 'neutral'
      };
      await setCache(cacheKey, result, 300);
      return result;
    } catch (err) {
      logger.warn(`Open interest fetch failed: ${err.message}`);
      return { current: 0, change4h: 0, trend: 'neutral', signal: 'neutral' };
    }
  }

  // BTC trend check - ETH follows BTC 80%+ of the time
  // Cache 5 minutes
  async getBTCTrend() {
    const cacheKey = 'intel:btctrend';
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    try {
      // Fetch BTC 4h candles last 10 candles to determine trend
      const res = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=10', { timeout: 5000 });
      const candles = res.data;
      const closes = candles.map(c => parseFloat(c[4]));
      const ema5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const ema10 = closes.reduce((a, b) => a + b, 0) / 10;
      const latestClose = closes[closes.length - 1];
      const prevClose = closes[closes.length - 2];
      const priceChange4h = ((latestClose - prevClose) / prevClose) * 100;

      const result = {
        price: latestClose,
        ema5,
        ema10,
        priceChange4h: parseFloat(priceChange4h.toFixed(2)),
        trend: ema5 > ema10 && latestClose > ema5 ? 'bullish' : ema5 < ema10 && latestClose < ema5 ? 'bearish' : 'neutral',
        strongTrend: Math.abs(priceChange4h) > 2
      };
      await setCache(cacheKey, result, 300);
      return result;
    } catch (err) {
      logger.warn(`BTC trend fetch failed: ${err.message}`);
      return { price: 0, trend: 'neutral', strongTrend: false, priceChange4h: 0 };
    }
  }

  // Time-of-day filter
  // Best trading windows: London open (3-5 AM EST), NY open (9:30-11:30 AM EST), NY/London overlap
  // Avoid: Asian session dead zone (11 PM - 2 AM EST)
  getTimeFilter() {
    const now = new Date();
    // UTC hours
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    void (utcHour + utcMinute / 60); // utcTime reserved for future DST calculation

    // EST = UTC - 5 (or UTC - 4 during DST, approximate with UTC - 5)
    const estHour = (utcHour - 5 + 24) % 24;

    let session, quality;

    if (estHour >= 2 && estHour < 5) {
      session = 'london_open';
      quality = 'good'; // London open, high volatility
    } else if (estHour >= 9 && estHour < 12) {
      session = 'ny_open';
      quality = 'best'; // Best session - highest volume
    } else if (estHour >= 12 && estHour < 16) {
      session = 'ny_afternoon';
      quality = 'good';
    } else if (estHour >= 20 || estHour < 2) {
      session = 'dead_zone';
      quality = 'avoid'; // Low volume, high slippage, fake moves
    } else {
      session = 'transition';
      quality = 'moderate';
    }

    return {
      utcHour,
      estHour,
      session,
      quality,
      shouldTrade: quality !== 'avoid',
      warning: quality === 'avoid' ? 'Low volume dead zone - signals less reliable' : null
    };
  }

  // Get all intel in one call (parallel)
  async getAllIntel(symbol = 'ETHUSDT') {
    const [fearGreed, fundingRate, openInterest, btcTrend] = await Promise.allSettled([
      this.getFearGreedIndex(),
      this.getFundingRate(symbol),
      this.getOpenInterest(symbol),
      this.getBTCTrend()
    ]);

    return {
      fearGreed: fearGreed.status === 'fulfilled' ? fearGreed.value : null,
      fundingRate: fundingRate.status === 'fulfilled' ? fundingRate.value : null,
      openInterest: openInterest.status === 'fulfilled' ? openInterest.value : null,
      btcTrend: btcTrend.status === 'fulfilled' ? btcTrend.value : null,
      timeFilter: this.getTimeFilter()
    };
  }

  // Convert market intel into signal score adjustments
  // Returns { bullishBoost, bearishBoost, vetoed, vetoReason }
  scoreMarketIntel(intel, proposedDirection) {
    let bullishBoost = 0;
    let bearishBoost = 0;
    let vetoed = false;
    let vetoReason = null;

    if (!intel) return { bullishBoost, bearishBoost, vetoed, vetoReason };

    const { fearGreed, fundingRate, openInterest, btcTrend, timeFilter } = intel;

    // 1. VETO: BTC strongly trending opposite direction - cancel trade
    if (btcTrend && btcTrend.strongTrend) {
      if (proposedDirection === 'bullish' && btcTrend.trend === 'bearish') {
        vetoed = true;
        vetoReason = `BTC strongly bearish (${btcTrend.priceChange4h}% 4h) - ETH BUY cancelled`;
        return { bullishBoost, bearishBoost, vetoed, vetoReason };
      }
      if (proposedDirection === 'bearish' && btcTrend.trend === 'bullish') {
        vetoed = true;
        vetoReason = `BTC strongly bullish (${btcTrend.priceChange4h}% 4h) - ETH SELL cancelled`;
        return { bullishBoost, bearishBoost, vetoed, vetoReason };
      }
    }

    // 2. VETO: Dead zone trading (low volume)
    if (timeFilter && !timeFilter.shouldTrade && proposedDirection !== 'neutral') {
      vetoed = true;
      vetoReason = `Dead zone (${timeFilter.session}) - ${timeFilter.warning}`;
      return { bullishBoost, bearishBoost, vetoed, vetoReason };
    }

    // 3. Fear & Greed - contrarian signals at extremes
    if (fearGreed) {
      if (fearGreed.signal === 'extreme_fear' && proposedDirection === 'bullish') {
        bullishBoost += 2; // Extreme fear = buy opportunity
      } else if (fearGreed.signal === 'extreme_greed' && proposedDirection === 'bearish') {
        bearishBoost += 2; // Extreme greed = sell opportunity
      } else if (fearGreed.signal === 'extreme_greed' && proposedDirection === 'bullish') {
        bullishBoost -= 1; // Buying into extreme greed is risky
      }
    }

    // 4. Funding Rate - overleveraged positions = reversal fuel
    if (fundingRate) {
      if (fundingRate.bias === 'bearish' && proposedDirection === 'bearish') {
        bearishBoost += 1; // Longs being squeezed confirms bearish
      } else if (fundingRate.bias === 'bullish' && proposedDirection === 'bullish') {
        bullishBoost += 1; // Shorts being squeezed confirms bullish
      } else if (fundingRate.signal === 'overleveraged_long' && proposedDirection === 'bullish') {
        bullishBoost -= 1; // Don't buy into overleveraged longs
      }
    }

    // 5. Open Interest - confirms or warns
    if (openInterest) {
      if (openInterest.trend === 'increasing' && proposedDirection === 'bullish') {
        bullishBoost += 1;
      } else if (openInterest.trend === 'increasing' && proposedDirection === 'bearish') {
        bearishBoost += 1;
      }
    }

    // 6. BTC alignment bonus
    if (btcTrend) {
      if (btcTrend.trend === 'bullish' && proposedDirection === 'bullish') {
        bullishBoost += 1;
      } else if (btcTrend.trend === 'bearish' && proposedDirection === 'bearish') {
        bearishBoost += 1;
      }
    }

    return { bullishBoost, bearishBoost, vetoed, vetoReason };
  }
}

module.exports = new MarketIntelService();
