import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

const TradingViewChart = ({ data, indicators, height = 500 }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const ema9SeriesRef = useRef(null);
  const ema21SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: '#d1d4dc',
      },
      timeScale: {
        borderColor: '#d1d4dc',
        timeVisible: true,
        secondsVisible: false,
      },
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
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    ema9SeriesRef.current = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      title: 'EMA 9',
    });

    ema21SeriesRef.current = chart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 2,
      title: 'EMA 21',
    });

    ema50SeriesRef.current = chart.addLineSeries({
      color: '#9C27B0',
      lineWidth: 2,
      title: 'EMA 50',
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [height]);

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
    if (!indicators || !data || data.length === 0) return;

    if (indicators.ema9 && ema9SeriesRef.current) {
      const ema9Data = data
        .filter((_, idx) => idx >= 8)
        .map((candle) => ({
          time: Math.floor(candle.timestamp / 1000),
          value: parseFloat(indicators.ema9),
        }));
      ema9SeriesRef.current.setData(ema9Data);
    }

    if (indicators.ema21 && ema21SeriesRef.current) {
      const ema21Data = data
        .filter((_, idx) => idx >= 20)
        .map((candle) => ({
          time: Math.floor(candle.timestamp / 1000),
          value: parseFloat(indicators.ema21),
        }));
      ema21SeriesRef.current.setData(ema21Data);
    }

    if (indicators.ema50 && ema50SeriesRef.current) {
      const ema50Data = data
        .filter((_, idx) => idx >= 49)
        .map((candle) => ({
          time: Math.floor(candle.timestamp / 1000),
          value: parseFloat(indicators.ema50),
        }));
      ema50SeriesRef.current.setData(ema50Data);
    }
  }, [indicators, data]);

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">ETH/USDT Price Chart</h3>
        <p className="text-sm text-gray-500">Real-time candlestick chart with technical indicators</p>
      </div>
      <div ref={chartContainerRef} className="relative" />
    </div>
  );
};

export default TradingViewChart;
