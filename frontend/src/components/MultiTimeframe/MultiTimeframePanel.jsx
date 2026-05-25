import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Activity,
  ChevronDown, ChevronUp, Target, Shield,
} from 'lucide-react';

const TIMEFRAME_LABELS = { '15m': '15 Minutes', '1h': '1 Hour', '4h': '4 Hours', '1d': '1 Day' };
const WEIGHT_LABELS   = { '15m': '10%', '1h': '20%', '4h': '30%', '1d': '40%' };

const MultiTimeframePanel = ({ data }) => {
  const [expandedTf, setExpandedTf] = useState(null);

  if (!data) return null;

  const { combined, timeframes, riskManagement, currentPrice, failedTimeframes } = data;

  const getSignalColor = (signal) => {
    if (signal === 'BUY' || signal === 'bullish')
      return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-500';
    if (signal === 'SELL' || signal === 'bearish')
      return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-500';
    return 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border-gray-400';
  };

  const getSignalIcon = (signal) => {
    if (signal === 'BUY' || signal === 'bullish') return <TrendingUp className="w-5 h-5" />;
    if (signal === 'SELL' || signal === 'bearish') return <TrendingDown className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };

  const toggleTimeframe = (tf) => setExpandedTf(expandedTf === tf ? null : tf);

  return (
    <div className="card border-l-4 border-indigo-500">
      {/* Combined Signal Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-lg border ${getSignalColor(combined.signalType)}`}>
            {getSignalIcon(combined.signalType)}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{combined.signalType}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Multi-Timeframe Unified Signal</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Trend: <span className="capitalize font-medium">{combined.overallTrend}</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Confidence</p>
          <div className="flex items-center space-x-2">
            <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  combined.confidence > 75 ? 'bg-green-500' : combined.confidence > 60 ? 'bg-yellow-500' : 'bg-gray-400'
                }`}
                style={{ width: `${combined.confidence}%` }}
              />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {combined.confidence.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Scores Summary */}
      {combined.scores && (
        <div className="flex items-center space-x-4 mb-6 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              Bullish Score: <span className="font-bold text-green-700 dark:text-green-400">{combined.scores.bullish}</span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              Bearish Score: <span className="font-bold text-red-700 dark:text-red-400">{combined.scores.bearish}</span>
            </span>
          </div>
        </div>
      )}

      {/* Risk Management */}
      {riskManagement && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Entry</p>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              ${parseFloat(currentPrice).toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Stop Loss</p>
            </div>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              ${riskManagement.stopLoss.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Take Profit 1</p>
            </div>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              ${riskManagement.takeProfit1.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">R/R Ratio</p>
            </div>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {riskManagement.riskRewardRatio.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {riskManagement && (
        <div className="flex items-center space-x-4 mb-6 text-xs text-gray-500 dark:text-gray-400">
          <span>TP2: <span className="font-medium text-green-600 dark:text-green-400">${riskManagement.takeProfit2.toFixed(2)}</span></span>
          <span>TP3: <span className="font-medium text-green-600 dark:text-green-400">${riskManagement.takeProfit3.toFixed(2)}</span></span>
        </div>
      )}

      {/* Per-Timeframe Breakdown */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Timeframe Breakdown</h4>
        {Object.entries(timeframes).map(([tf, tfData]) => (
          <div key={tf} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleTimeframe(tf)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className={`px-2 py-1 rounded text-xs font-medium border ${getSignalColor(tfData.analysis.signal)}`}>
                  {tfData.analysis.signal.toUpperCase()}
                </div>
                <span className="font-medium text-gray-900 dark:text-white">{TIMEFRAME_LABELS[tf] || tf}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">Weight: {WEIGHT_LABELS[tf]}</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Strength: {tfData.analysis.strength.toFixed(0)}%
                </span>
                {expandedTf === tf
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {expandedTf === tf && (
              <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  {Object.entries(tfData.analysis.details).map(([key, value]) => (
                    <div key={key} className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                      <span className="font-medium capitalize text-gray-700 dark:text-gray-200">{key}: </span>
                      <span className="text-gray-600 dark:text-gray-300">
                        {typeof value === 'object' ? value.signal || JSON.stringify(value) : value}
                      </span>
                    </div>
                  ))}
                </div>

                {tfData.indicators && (
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    {tfData.indicators.rsi && (
                      <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 text-center">
                        <p className="text-gray-500 dark:text-gray-400 uppercase">RSI</p>
                        <p className="font-bold text-gray-900 dark:text-white">{parseFloat(tfData.indicators.rsi).toFixed(2)}</p>
                      </div>
                    )}
                    {tfData.indicators.macd && (
                      <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 text-center">
                        <p className="text-gray-500 dark:text-gray-400 uppercase">MACD</p>
                        <p className="font-bold text-gray-900 dark:text-white">{parseFloat(tfData.indicators.macd).toFixed(4)}</p>
                      </div>
                    )}
                    {tfData.indicators.obv && (
                      <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 text-center">
                        <p className="text-gray-500 dark:text-gray-400 uppercase">OBV</p>
                        <p className="font-bold text-gray-900 dark:text-white">{parseFloat(tfData.indicators.obv).toFixed(0)}</p>
                      </div>
                    )}
                  </div>
                )}

                {tfData.patterns && tfData.patterns.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Patterns:</p>
                    <div className="flex flex-wrap gap-1">
                      {tfData.patterns.map((p, idx) => (
                        <span
                          key={idx}
                          className={`inline-block text-xs border rounded px-2 py-1 ${
                            p.signal === 'bullish'
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                              : p.signal === 'bearish'
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                              : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {p.type} ({p.signal})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {tfData.volumeAnalysis && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Volume ratio: {tfData.volumeAnalysis.volumeRatio?.toFixed(2) || 'N/A'}x
                    {tfData.volumeAnalysis.volumeRatio > 1.5 && (
                      <span className="ml-1 text-green-600 dark:text-green-400 font-medium">(High)</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {failedTimeframes && failedTimeframes.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            Could not analyze: {failedTimeframes.join(', ')}. Results are based on available timeframes only.
          </p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Generated: {new Date(data.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default MultiTimeframePanel;
