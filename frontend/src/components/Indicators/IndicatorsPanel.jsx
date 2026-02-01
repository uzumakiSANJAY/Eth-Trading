import React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

const IndicatorsPanel = ({ indicators, analysis }) => {
  if (!indicators) {
    return (
      <div className="card">
        <p className="text-gray-500">Loading indicators...</p>
      </div>
    );
  }

  const getSignalColor = (signal) => {
    switch (signal) {
      case 'bullish':
        return 'text-success-600 bg-success-50';
      case 'bearish':
        return 'text-danger-600 bg-danger-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getSignalIcon = (signal) => {
    switch (signal) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4" />;
      case 'bearish':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Technical Indicators</h3>
        {analysis && (
          <div className={`indicator-badge ${getSignalColor(analysis.signal)}`}>
            <span className="flex items-center space-x-1">
              {getSignalIcon(analysis.signal)}
              <span className="capitalize">{analysis.signal}</span>
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">RSI (14)</p>
          <p className="text-xl font-bold text-gray-900">
            {parseFloat(indicators.rsi).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {indicators.rsi < 30 ? 'Oversold' : indicators.rsi > 70 ? 'Overbought' : 'Neutral'}
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">MACD</p>
          <p className="text-xl font-bold text-gray-900">
            {parseFloat(indicators.macd).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Signal: {parseFloat(indicators.macdSignal).toFixed(2)}
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">ATR</p>
          <p className="text-xl font-bold text-gray-900">
            {parseFloat(indicators.atr).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Volatility</p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">EMA 9</p>
          <p className="text-xl font-bold text-gray-900">
            ${parseFloat(indicators.ema9).toFixed(2)}
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">EMA 21</p>
          <p className="text-xl font-bold text-gray-900">
            ${parseFloat(indicators.ema21).toFixed(2)}
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">EMA 50</p>
          <p className="text-xl font-bold text-gray-900">
            ${parseFloat(indicators.ema50).toFixed(2)}
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase mb-1">VWAP</p>
          <p className="text-xl font-bold text-gray-900">
            ${parseFloat(indicators.vwap).toFixed(2)}
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg col-span-2">
          <p className="text-xs text-gray-500 uppercase mb-1">Bollinger Bands</p>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500">Upper</p>
              <p className="text-sm font-semibold">${parseFloat(indicators.bollingerUpper).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Middle</p>
              <p className="text-sm font-semibold">${parseFloat(indicators.bollingerMiddle).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Lower</p>
              <p className="text-sm font-semibold">${parseFloat(indicators.bollingerLower).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {analysis && analysis.details && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Analysis Details</h4>
          <div className="space-y-1">
            {Object.entries(analysis.details).map(([key, value]) => (
              <p key={key} className="text-xs text-gray-700">
                <span className="font-medium capitalize">{key}:</span>{' '}
                {typeof value === 'object' ? value.signal || JSON.stringify(value) : value}
              </p>
            ))}
          </div>
          <div className="mt-2">
            <p className="text-xs text-gray-700">
              <span className="font-medium">Strength:</span> {analysis.strength.toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndicatorsPanel;
