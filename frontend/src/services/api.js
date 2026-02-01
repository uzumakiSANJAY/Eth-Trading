import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const marketAPI = {
  getCurrentPrice: (symbol = 'ETH/USDT') =>
    api.get('/api/market/price', { params: { symbol } }),

  getOhlcvData: (symbol = 'ETHUSDT', timeframe = '1h', limit = 100) =>
    api.get('/api/market/ohlcv', { params: { symbol, timeframe, limit } }),

  getVolumeAnalysis: (symbol = 'ETHUSDT', timeframe = '1h', candles = 24) =>
    api.get('/api/market/volume', { params: { symbol, timeframe, candles } }),

  fetchFreshData: (symbol = 'ETH/USDT', timeframe = '1h', limit = 500) =>
    api.post('/api/market/fetch', null, { params: { symbol, timeframe, limit } }),
};

export const analysisAPI = {
  getIndicators: (symbol = 'ETHUSDT', timeframe = '1h') =>
    api.get('/api/analysis/indicators', { params: { symbol, timeframe } }),

  calculateIndicators: (symbol = 'ETHUSDT', timeframe = '1h') =>
    api.post('/api/analysis/calculate', null, { params: { symbol, timeframe } }),
};

export const patternsAPI = {
  detectPatterns: (symbol = 'ETHUSDT', timeframe = '1h') =>
    api.post('/api/patterns/detect', null, { params: { symbol, timeframe } }),

  getRecentPatterns: (symbol = 'ETHUSDT', timeframe = '1h', limit = 10) =>
    api.get('/api/patterns/recent', { params: { symbol, timeframe, limit } }),
};

export const signalsAPI = {
  generateSignal: (symbol = 'ETHUSDT', timeframe = '1h') =>
    api.post('/api/signals/generate', { symbol, timeframe }),

  getLatestSignal: (symbol = 'ETHUSDT', timeframe = '1h') =>
    api.get('/api/signals/latest', { params: { symbol, timeframe } }),

  getSignalHistory: (symbol = 'ETHUSDT', timeframe = '1h', limit = 50) =>
    api.get('/api/signals/history', { params: { symbol, timeframe, limit } }),
};

export default api;
