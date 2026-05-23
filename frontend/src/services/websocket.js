import { io } from 'socket.io-client';
import { create } from 'zustand';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

let socket = null;

export const useWebSocketStore = create((set) => ({
  isConnected: false,
  currentPrice: null,
  latestSignal: null,
  indicators: null,
  // auto_update payload from backend 20-second loop
  autoSignal: null,
  autoMtf: null,
  autoReview: null,
  autoLastUpdated: null,

  setConnected: (connected) => set({ isConnected: connected }),
  setCurrentPrice: (price) => set({ currentPrice: price }),
  setLatestSignal: (signal) => set({ latestSignal: signal }),
  setIndicators: (indicators) => set({ indicators }),
  setAutoUpdate: (payload) => set({
    autoSignal:      payload.signal,
    autoMtf:         payload.mtfAnalysis,
    autoReview:      payload.dailyReview,
    autoLastUpdated: payload.timestamp,
    // also keep latestSignal in sync if a real BUY/SELL came in
    ...(payload.signal?.signalType === 'BUY' || payload.signal?.signalType === 'SELL'
      ? { latestSignal: payload.signal }
      : {}),
  }),
}));

export const useWebSocket = () => {
  const store = useWebSocketStore();

  const connect = () => {
    if (socket?.connected) return;

    // If socket exists but is disconnected (e.g. server dropped the connection),
    // clean up the stale instance before creating a new one to avoid duplicate
    // event listeners accumulating on every reconnect attempt.
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      store.setConnected(true);
      socket.emit('subscribe', { symbol: 'ETH/USDT', timeframe: '1h' });
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      store.setConnected(false);
    });

    socket.on('price_update', (data) => {
      store.setCurrentPrice(data.price);
    });

    socket.on('new_signal', (signal) => {
      store.setLatestSignal(signal);
    });

    socket.on('indicator_update', (data) => {
      store.setIndicators(data.indicators);
    });

    socket.on('auto_update', (payload) => {
      store.setAutoUpdate(payload);
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      store.setConnected(false);
    }
  };

  const subscribe = (symbol, timeframe) => {
    if (socket?.connected) {
      socket.emit('subscribe', { symbol, timeframe });
    }
  };

  const unsubscribe = (symbol, timeframe) => {
    if (socket?.connected) {
      socket.emit('unsubscribe', { symbol, timeframe });
    }
  };

  return { connect, disconnect, subscribe, unsubscribe };
};
