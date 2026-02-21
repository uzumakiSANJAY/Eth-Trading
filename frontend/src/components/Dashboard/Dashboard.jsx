import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import TradingViewChart from '../Chart/TradingViewChart';
import IndicatorsPanel from '../Indicators/IndicatorsPanel';
import SignalCard from '../Signals/SignalCard';
import MultiTimeframePanel from '../MultiTimeframe/MultiTimeframePanel';
import { marketAPI, analysisAPI, signalsAPI } from '../../services/api';
import { useWebSocketStore } from '../../services/websocket';

const Dashboard = () => {
  const [ohlcvData, setOhlcvData] = useState([]);
  const [indicators, setIndicators] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [signal, setSignal] = useState(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [loading, setLoading] = useState(false);
  const [generatingSignal, setGeneratingSignal] = useState(false);
  const [mtfAnalysis, setMtfAnalysis] = useState(null);
  const [loadingMtf, setLoadingMtf] = useState(false);

  const { currentPrice, isConnected } = useWebSocketStore();

  useEffect(() => {
    fetchAllData();
  }, [timeframe]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOhlcvData(),
        fetchIndicators(),
        fetchLatestSignal(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOhlcvData = async () => {
    try {
      const response = await marketAPI.getOhlcvData('ETHUSDT', timeframe, 100);
      setOhlcvData(response.data.data.candles);
    } catch (error) {
      console.error('Error fetching OHLCV:', error);
    }
  };

  const fetchIndicators = async () => {
    try {
      const response = await analysisAPI.getIndicators('ETHUSDT', timeframe);
      setIndicators(response.data.data.indicators);
      setAnalysis(response.data.data.analysis);
    } catch (error) {
      console.error('Error fetching indicators:', error);
    }
  };

  const fetchLatestSignal = async () => {
    try {
      const response = await signalsAPI.getLatestSignal('ETHUSDT', timeframe);
      setSignal(response.data.data);
    } catch (error) {
      console.error('Error fetching signal:', error);
    }
  };

  const handleGenerateSignal = async () => {
    setGeneratingSignal(true);
    try {
      await analysisAPI.calculateIndicators('ETHUSDT', timeframe);

      const response = await signalsAPI.generateSignal('ETHUSDT', timeframe);
      setSignal(response.data.data);

      await fetchIndicators();
    } catch (error) {
      console.error('Error generating signal:', error);
      alert('Failed to generate signal. Please try again.');
    } finally {
      setGeneratingSignal(false);
    }
  };

  const handleMultiTimeframeAnalysis = async () => {
    setLoadingMtf(true);
    try {
      const response = await analysisAPI.getMultiTimeframeAnalysis('ETHUSDT');
      setMtfAnalysis(response.data.data);
    } catch (error) {
      console.error('Error fetching multi-timeframe analysis:', error);
      alert('Failed to fetch multi-timeframe analysis. Please try again.');
    } finally {
      setLoadingMtf(false);
    }
  };

  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Trading Dashboard</h2>
          <p className="text-gray-500 mt-1">
            Real-time analysis and AI-powered trading suggestions
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {currentPrice && (
            <div className="px-4 py-2 bg-white rounded-lg shadow">
              <p className="text-xs text-gray-500">Current Price</p>
              <p className="text-2xl font-bold text-gray-900">${currentPrice.toFixed(2)}</p>
              <div className="flex items-center space-x-1 mt-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-500">
                  {isConnected ? 'Live' : 'Disconnected'}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="btn-primary flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
              timeframe === tf
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TradingViewChart data={ohlcvData} indicators={indicators} />

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Generate Trading Signal</h3>
              <button
                onClick={handleGenerateSignal}
                disabled={generatingSignal || loading}
                className="btn-primary flex items-center space-x-2"
              >
                <Zap className={`w-4 h-4 ${generatingSignal ? 'animate-pulse' : ''}`} />
                <span>{generatingSignal ? 'Analyzing...' : 'Generate Signal'}</span>
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Click to analyze current market conditions and generate a trading suggestion based on
              technical indicators, candlestick patterns, and AI prediction.
            </p>
          </div>

          <div className="card bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Multi-Timeframe Analysis
                </h3>
                <p className="text-sm text-gray-500">
                  Combine 15m, 1h, 4h, and 1d into one unified signal
                </p>
              </div>
              <button
                onClick={handleMultiTimeframeAnalysis}
                disabled={loadingMtf || loading}
                className="btn-primary flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Zap className={`w-4 h-4 ${loadingMtf ? 'animate-pulse' : ''}`} />
                <span>
                  {loadingMtf ? 'Analyzing All Timeframes...' : 'Analyze All Timeframes'}
                </span>
              </button>
            </div>
          </div>

          {mtfAnalysis && <MultiTimeframePanel data={mtfAnalysis} />}

          <SignalCard signal={signal} />
        </div>

        <div className="space-y-6">
          <IndicatorsPanel indicators={indicators} analysis={analysis} />

          <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">⚠️ Important Disclaimer</h4>
            <ul className="space-y-1 text-xs text-gray-700">
              <li>• This platform provides analysis and suggestions only</li>
              <li>• NO automated trading is performed</li>
              <li>• All trading decisions are your responsibility</li>
              <li>• Past performance does not guarantee future results</li>
              <li>• Cryptocurrency trading carries significant risk</li>
              <li>• Only invest what you can afford to lose</li>
            </ul>
          </div>

          <div className="card bg-blue-50">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">How It Works</h4>
            <div className="space-y-2 text-xs text-gray-700">
              <div className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <p>Real-time data fetched from Binance exchange</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <p>Technical indicators calculated (RSI, MACD, EMA, ATR, VWAP)</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <p>Candlestick patterns detected and analyzed</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <p>ML model predicts price direction probability</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  5
                </span>
                <p>Signal generated with entry, stop-loss, and take-profit levels</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
