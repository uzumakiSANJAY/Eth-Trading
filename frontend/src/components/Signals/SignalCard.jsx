import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Target, Shield } from 'lucide-react';

const SignalCard = ({ signal }) => {
  if (!signal) {
    return (
      <div className="card">
        <p className="text-gray-500">No active signal</p>
      </div>
    );
  }

  const getSignalStyle = (type) => {
    switch (type) {
      case 'BUY':
        return {
          bg: 'bg-success-50',
          border: 'border-success-500',
          text: 'text-success-700',
          icon: <TrendingUp className="w-6 h-6" />,
        };
      case 'SELL':
        return {
          bg: 'bg-danger-50',
          border: 'border-danger-500',
          text: 'text-danger-700',
          icon: <TrendingDown className="w-6 h-6" />,
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-500',
          text: 'text-gray-700',
          icon: <Minus className="w-6 h-6" />,
        };
    }
  };

  const style = getSignalStyle(signal.signalType);

  return (
    <div className={`card border-l-4 ${style.border}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-3 ${style.bg} rounded-lg ${style.text}`}>
            {style.icon}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{signal.signalType}</h3>
            <p className="text-sm text-gray-500">
              {signal.symbol} • {signal.timeframe}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase mb-1">Confidence</p>
          <div className="flex items-center space-x-2">
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${signal.confidence > 75 ? 'bg-success-500' : signal.confidence > 60 ? 'bg-yellow-500' : 'bg-gray-400'}`}
                style={{ width: `${signal.confidence}%` }}
              />
            </div>
            <span className="text-lg font-bold text-gray-900">{signal.confidence.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2 mb-1">
            <Target className="w-4 h-4 text-primary-600" />
            <p className="text-xs text-gray-500 uppercase">Entry Price</p>
          </div>
          <p className="text-xl font-bold text-gray-900">${parseFloat(signal.entryPrice).toFixed(2)}</p>
          {signal.entryZoneMin && signal.entryZoneMax && (
            <p className="text-xs text-gray-500 mt-1">
              Zone: ${parseFloat(signal.entryZoneMin).toFixed(2)} - ${parseFloat(signal.entryZoneMax).toFixed(2)}
            </p>
          )}
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2 mb-1">
            <Shield className="w-4 h-4 text-danger-600" />
            <p className="text-xs text-gray-500 uppercase">Stop Loss</p>
          </div>
          <p className="text-xl font-bold text-danger-600">
            ${parseFloat(signal.stopLoss).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {Math.abs(((signal.stopLoss - signal.entryPrice) / signal.entryPrice) * 100).toFixed(2)}% risk
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="w-4 h-4 text-success-600" />
            <p className="text-xs text-gray-500 uppercase">Take Profit</p>
          </div>
          <p className="text-xl font-bold text-success-600">
            ${parseFloat(signal.takeProfit1).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            R/R: {signal.riskRewardRatio ? parseFloat(signal.riskRewardRatio).toFixed(2) : 'N/A'}
          </p>
        </div>
      </div>

      {signal.takeProfit2 && signal.takeProfit3 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs font-semibold text-gray-700 mb-2">Additional Targets</p>
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-xs text-gray-500">TP2</p>
              <p className="font-semibold text-gray-900">${parseFloat(signal.takeProfit2).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">TP3</p>
              <p className="font-semibold text-gray-900">${parseFloat(signal.takeProfit3).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {signal.reasoning && (
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Signal Reasoning</h4>

              {signal.reasoning.indicators && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-700 mb-1">Technical Indicators:</p>
                  <div className="space-y-1">
                    {Object.entries(signal.reasoning.indicators).map(([key, value]) => (
                      <p key={key} className="text-xs text-gray-600">
                        • {key}: {typeof value === 'object' ? value.signal || JSON.stringify(value) : value}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {signal.reasoning.patterns && signal.reasoning.patterns.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-700 mb-1">Candlestick Patterns:</p>
                  <div className="space-y-1">
                    {signal.reasoning.patterns.map((pattern, idx) => (
                      <p key={idx} className="text-xs text-gray-600">
                        • {pattern.type} ({pattern.signal}, strength: {pattern.strength})
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {signal.reasoning.mlPrediction && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-gray-700 mb-1">AI Prediction:</p>
                  <p className="text-xs text-gray-600">
                    • Direction: {signal.reasoning.mlPrediction.direction} (
                    {(signal.reasoning.mlPrediction.probability * 100).toFixed(1)}% probability)
                  </p>
                </div>
              )}

              {signal.reasoning.volumeAnalysis && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">Volume:</p>
                  <p className="text-xs text-gray-600">• {signal.reasoning.volumeAnalysis}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Generated: {new Date(signal.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default SignalCard;
