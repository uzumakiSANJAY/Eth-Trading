import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { RefreshCw, Zap, Activity, StopCircle } from 'lucide-react';
import TradingViewChart from '../Chart/TradingViewChart';
import IndicatorsPanel from '../Indicators/IndicatorsPanel';
import SignalCard from '../Signals/SignalCard';
import MultiTimeframePanel from '../MultiTimeframe/MultiTimeframePanel';
import NewsSentimentPanel from '../Signals/NewsSentimentPanel';
import DailyReviewPanel from '../Review/DailyReviewPanel';
import PaperTradingPanel from '../PaperTrading/PaperTradingPanel';
import { marketAPI, analysisAPI, signalsAPI, reviewAPI } from '../../services/api';
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
  const [newsSentiment, setNewsSentiment] = useState(null);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState(false);
  const [stats24h, setStats24h] = useState(null);
  const [dailyReview, setDailyReview] = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [togglingAuto, setTogglingAuto] = useState(false);

  const { currentPrice, isConnected, autoSignal, autoMtf, autoReview, autoPaper, autoLastUpdated } = useWebSocketStore();

  useEffect(() => {
    fetchAllData();
    fetchNewsSentiment();
    fetch24hStats();
  }, [timeframe]);

  // Auto-update: when the backend 20s cycle pushes data via WebSocket, sync it into panels
  useEffect(() => {
    if (!autoLastUpdated) return;
    if (autoSignal)  setSignal(autoSignal);
    if (autoMtf)     setMtfAnalysis(autoMtf);
    if (autoReview)  setDailyReview(autoReview);
  }, [autoLastUpdated]);

  const fetch24hStats = async () => {
    try {
      const response = await marketAPI.get24hStats('ETHUSDT');
      setStats24h(response.data.data);
    } catch (error) {
      console.error('Error fetching 24h stats:', error);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOhlcvData(),
        fetchIndicators(),
        fetchLatestSignal(),
        fetch24hStats(),
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

  const fetchNewsSentiment = async () => {
    setLoadingNews(true);
    setNewsError(false);
    try {
      const response = await signalsAPI.getNewsSentiment();
      setNewsSentiment(response.data.data);
    } catch (error) {
      console.error('Error fetching news sentiment:', error);
      setNewsError(true);
    } finally {
      setLoadingNews(false);
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

  const fetchDailyReview = async () => {
    setLoadingReview(true);
    setReviewError(false);
    try {
      const response = await reviewAPI.getDailyReview('ETHUSDT', timeframe);
      setDailyReview(response.data.data);
    } catch (error) {
      console.error('Error fetching daily review:', error);
      setReviewError(true);
    } finally {
      setLoadingReview(false);
    }
  };

  const toggleAutoAnalysis = async () => {
    setTogglingAuto(true);
    try {
      const next = !autoEnabled;
      await reviewAPI.setAutoAnalysis(next ? 'start' : 'stop');
      setAutoEnabled(next);
    } catch (err) {
      console.error('Failed to toggle auto-analysis:', err);
    } finally {
      setTogglingAuto(false);
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
          {stats24h && (
            <div className="px-4 py-2 bg-white rounded-lg shadow">
              <p className="text-xs text-gray-500 font-medium mb-1">24h Range</p>
              <div className="flex flex-col space-y-1">
                <div className="flex items-center justify-between space-x-4">
                  <span className="text-xs text-green-600 font-semibold">H</span>
                  <span className="text-sm font-bold text-green-600">${stats24h.high.toFixed(2)}</span>
                  {stats24h.highTime && (
                    <span className="text-xs text-gray-400">
                      {dayjs(Number(stats24h.highTime)).format('MMM D, HH:mm')}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between space-x-4">
                  <span className="text-xs text-red-500 font-semibold">L</span>
                  <span className="text-sm font-bold text-red-500">${stats24h.low.toFixed(2)}</span>
                  {stats24h.lowTime && (
                    <span className="text-xs text-gray-400">
                      {dayjs(Number(stats24h.lowTime)).format('MMM D, HH:mm')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
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

          {/* ── Global Auto-Analysis Control Bar ── */}
          <div className={`card border-2 ${autoEnabled ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {autoEnabled ? (
                  <span className="relative flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500" />
                  </span>
                ) : (
                  <span className="inline-flex rounded-full h-4 w-4 bg-gray-400" />
                )}
                <div>
                  <p className="text-base font-bold text-gray-900">
                    {autoEnabled ? '🔄 Auto-Analysis Active' : '⏸ Auto-Analysis Paused'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {autoEnabled
                      ? 'Signal · Multi-Timeframe · Daily Review — all updating every 20s'
                      : 'Click Start to enable 20-second auto-refresh for all panels'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {autoLastUpdated && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Last cycle</p>
                    <p className="text-sm font-bold text-gray-700">{dayjs(autoLastUpdated).format('HH:mm:ss')}</p>
                  </div>
                )}
                <button
                  onClick={toggleAutoAnalysis}
                  disabled={togglingAuto}
                  className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                    autoEnabled
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {autoEnabled
                    ? <><StopCircle className="w-4 h-4" /><span>Stop Auto</span></>
                    : <><Activity className="w-4 h-4" /><span>Start Auto</span></>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Generate Trading Signal ── */}
          <div className={`card border-2 ${autoEnabled && autoSignal ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-semibold text-gray-900">Generate Trading Signal</h3>
                {autoEnabled && autoSignal && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                    Live · every 20s
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {autoLastUpdated && autoSignal && (
                  <span className="text-xs text-gray-400">
                    Updated {dayjs(autoLastUpdated).format('HH:mm:ss')}
                  </span>
                )}
                <button
                  onClick={handleGenerateSignal}
                  disabled={generatingSignal || loading}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Zap className={`w-4 h-4 ${generatingSignal ? 'animate-pulse' : ''}`} />
                  <span>{generatingSignal ? 'Analyzing...' : 'Force Refresh'}</span>
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {autoEnabled
                ? 'Signal auto-refreshes every 20s via live analysis. Use Force Refresh to trigger immediately.'
                : 'Click Force Refresh to analyze current market conditions and generate a trading suggestion.'}
            </p>
          </div>

          <SignalCard signal={signal} />

          {/* ── Multi-Timeframe Analysis ── */}
          <div className={`card border-2 ${autoEnabled && autoMtf ? 'border-indigo-300 bg-indigo-50' : 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">Multi-Timeframe Analysis</h3>
                  {autoEnabled && autoMtf && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse inline-block" />
                      Live · every 20s
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {autoEnabled && autoLastUpdated && autoMtf
                    ? `Last updated ${dayjs(autoLastUpdated).format('HH:mm:ss')} · Combines 15m, 1h, 4h, 1d`
                    : 'Combines 15m, 1h, 4h, and 1d into one unified signal'}
                </p>
              </div>
              <button
                onClick={handleMultiTimeframeAnalysis}
                disabled={loadingMtf || loading}
                className="btn-primary flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Zap className={`w-4 h-4 ${loadingMtf ? 'animate-pulse' : ''}`} />
                <span>{loadingMtf ? 'Analyzing...' : 'Force Refresh'}</span>
              </button>
            </div>
          </div>

          {(mtfAnalysis || autoMtf) && <MultiTimeframePanel data={mtfAnalysis || autoMtf} />}

          {/* ── Daily Market Review ── */}
          <div className={`card border-2 ${autoEnabled && autoReview ? 'border-slate-400 bg-slate-50' : 'border-slate-300 bg-slate-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">Daily Market Review</h3>
                  {autoEnabled && autoReview && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse inline-block" />
                      Live · every 20s
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {autoEnabled && autoLastUpdated && autoReview
                    ? `Last updated ${dayjs(autoLastUpdated).format('HH:mm:ss')} · Patterns, breakouts, missed trades & optimization`
                    : 'Patterns, breakouts, missed trades & loss optimization for today'}
                </p>
              </div>
              <button
                onClick={fetchDailyReview}
                disabled={loadingReview}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-800 font-semibold text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loadingReview ? 'animate-spin' : ''}`} />
                <span>Force Refresh</span>
              </button>
            </div>
          </div>

          {(dailyReview || autoReview || loadingReview || reviewError) && (
            <DailyReviewPanel
              data={dailyReview || autoReview}
              loading={loadingReview}
              error={reviewError}
              onRefresh={fetchDailyReview}
            />
          )}
        </div>

        <div className="space-y-6">
          <IndicatorsPanel indicators={indicators} analysis={analysis} />

          <PaperTradingPanel livePortfolio={autoPaper} />

          <NewsSentimentPanel
            sentiment={newsSentiment}
            loading={loadingNews}
            error={newsError}
            onRefresh={fetchNewsSentiment}
          />

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
