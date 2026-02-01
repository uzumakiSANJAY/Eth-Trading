import { io } from 'socket.io-client';
import { create } from 'zustand';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

let socket = null;

export const useWebSocketStore = create((set) => ({
  isConnected: false,
  currentPrice: null,
  latestSignal: null,
  indicators: null,

  setConnected: (connected) => set({ isConnected: connected }),
  setCurrentPrice: (price) => set({ currentPrice: price }),
  setLatestSignal: (signal) => set({ latestSignal: signal }),
  setIndicators: (indicators) => set({ indicators }),
}));

export const useWebSocket = () => {
  const store = useWebSocketStore();

  const connect = () => {
    if (socket?.connected) return;

    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
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
