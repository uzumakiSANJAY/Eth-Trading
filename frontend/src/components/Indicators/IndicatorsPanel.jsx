import React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

const IndicatorsPanel = ({ indicators, analysis }) => {
  if (!indicators) {
    return (
      <div className="card">
        <p className="text-gray-500 dark:text-gray-400">Loading indicators...</p>
      </div>
    );
  }

  const getSignalColor = (signal) => {
    switch (signal) {
      case 'bullish':
        return 'text-success-600 bg-success-50 dark:bg-green-900/30';
      case 'bearish':
        return 'text-danger-600 bg-danger-50 dark:bg-red-900/30';
      default:
        return 'text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50';
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Technical Indicators</h3>
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
        {[
          { label: 'RSI (14)', value: parseFloat(indicators.rsi).toFixed(2), sub: indicators.rsi < 30 ? 'Oversold' : indicators.rsi > 70 ? 'Overbought' : 'Neutral' },
          { label: 'MACD', value: parseFloat(indicators.macd).toFixed(2), sub: `Signal: ${parseFloat(indicators.macdSignal).toFixed(2)}` },
          { label: 'ATR', value: parseFloat(indicators.atr).toFixed(2), sub: 'Volatility' },
          { label: 'EMA 9', value: `$${parseFloat(indicators.ema9).toFixed(2)}`, sub: null },
          { label: 'EMA 21', value: `$${parseFloat(indicators.ema21).toFixed(2)}`, sub: null },
          { label: 'EMA 50', value: `$${parseFloat(indicators.ema50).toFixed(2)}`, sub: null },
          { label: 'VWAP', value: `$${parseFloat(indicators.vwap).toFixed(2)}`, sub: null },
        ].map(({ label, value, sub }) => (
          <div key={label} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">{label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
            {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
          </div>
        ))}

        {indicators.obv && (
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">OBV</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {parseFloat(indicators.obv).toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Volume Flow</p>
          </div>
        )}

        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg col-span-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Bollinger Bands</p>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Upper</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">${parseFloat(indicators.bollingerUpper).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Middle</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">${parseFloat(indicators.bollingerMiddle).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Lower</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">${parseFloat(indicators.bollingerLower).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {analysis && analysis.details && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Analysis Details</h4>
          <div className="space-y-1">
            {Object.entries(analysis.details).map(([key, value]) => (
              <p key={key} className="text-xs text-gray-700 dark:text-gray-300">
                <span className="font-medium capitalize">{key}:</span>{' '}
                {typeof value === 'object' ? value.signal || JSON.stringify(value) : value}
              </p>
            ))}
          </div>
          <div className="mt-2">
            <p className="text-xs text-gray-700 dark:text-gray-300">
              <span className="font-medium">Strength:</span> {analysis.strength.toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndicatorsPanel;
