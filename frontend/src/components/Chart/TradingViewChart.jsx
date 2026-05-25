import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { useTheme } from '../../contexts/ThemeContext';

const calcEMA = (closes, period) => {
  if (!closes || closes.length < period) return [];
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [{ startIdx: period - 1, value: ema }];
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push({ startIdx: i, value: ema });
  }
  return result;
};

const lightTheme = {
  layout: { background: { color: '#ffffff' }, textColor: '#333' },
  grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
  rightPriceScale: { borderColor: '#d1d4dc' },
  timeScale: { borderColor: '#d1d4dc' },
};

const darkTheme = {
  layout: { background: { color: '#1f2937' }, textColor: '#d1d5db' },
  grid: { vertLines: { color: '#374151' }, horzLines: { color: '#374151' } },
  rightPriceScale: { borderColor: '#4b5563' },
  timeScale: { borderColor: '#4b5563' },
};

const TradingViewChart = ({ data, indicators, height = 500 }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const ema9SeriesRef = useRef(null);
  const ema21SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const theme = isDark ? darkTheme : lightTheme;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      ...theme,
      crosshair: { mode: 0 },
      timeScale: { ...theme.timeScale, timeVisible: true, secondsVisible: false },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candlestickSeriesRef.current = candlestickSeries;

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    ema9SeriesRef.current = chart.addLineSeries({ color: '#2962FF', lineWidth: 2, title: 'EMA 9' });
    ema21SeriesRef.current = chart.addLineSeries({ color: '#FF6D00', lineWidth: 2, title: 'EMA 21' });
    ema50SeriesRef.current = chart.addLineSeries({ color: '#9C27B0', lineWidth: 2, title: 'EMA 50' });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height, isDark]);

  useEffect(() => {
    if (!data || data.length === 0 || !candlestickSeriesRef.current) return;

    const candleData = data.map((candle) => ({
      time: Math.floor(candle.timestamp / 1000),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
    }));

    const volumeData = data.map((candle) => ({
      time: Math.floor(candle.timestamp / 1000),
      value: parseFloat(candle.volume),
      color: parseFloat(candle.close) >= parseFloat(candle.open) ? '#22c55e80' : '#ef444480',
    }));

    candlestickSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const closes = data.map((c) => parseFloat(c.close));

    if (ema9SeriesRef.current) {
      const ema9Points = calcEMA(closes, 9);
      ema9SeriesRef.current.setData(
        ema9Points.map(({ startIdx, value }) => ({ time: Math.floor(data[startIdx].timestamp / 1000), value }))
      );
    }
    if (ema21SeriesRef.current) {
      const ema21Points = calcEMA(closes, 21);
      ema21SeriesRef.current.setData(
        ema21Points.map(({ startIdx, value }) => ({ time: Math.floor(data[startIdx].timestamp / 1000), value }))
      );
    }
    if (ema50SeriesRef.current) {
      const ema50Points = calcEMA(closes, 50);
      ema50SeriesRef.current.setData(
        ema50Points.map(({ startIdx, value }) => ({ time: Math.floor(data[startIdx].timestamp / 1000), value }))
      );
    }
  }, [data]);

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ETH/USDT Price Chart</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Real-time candlestick chart with technical indicators</p>
      </div>
      <div ref={chartContainerRef} className="relative" />
    </div>
  );
};

export default TradingViewChart;
