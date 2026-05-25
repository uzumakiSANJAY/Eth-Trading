import React, { useEffect, useRef } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const sentimentConfig = {
  bullish: {
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
    dot: 'bg-green-500',
    Icon: TrendingUp,
  },
  bearish: {
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
    dot: 'bg-red-500',
    Icon: TrendingDown,
  },
  neutral: {
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
    badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    dot: 'bg-gray-400',
    Icon: Minus,
  },
};

const impactColors = {
  high: 'text-red-500 dark:text-red-400',
  medium: 'text-orange-500 dark:text-orange-400',
  low: 'text-gray-400 dark:text-gray-500',
};

const NewsSentimentPanel = ({ sentiment, loading, error, onRefresh }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !sentiment?.headlines?.length) return;
    let frame;
    let pos = 0;

    const tick = () => {
      pos += 0.4;
      if (pos >= el.scrollHeight - el.clientHeight) pos = 0;
      el.scrollTop = pos;
      frame = requestAnimationFrame(tick);
    };

    const pause = () => cancelAnimationFrame(frame);
    const resume = () => { frame = requestAnimationFrame(tick); };
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
    };
  }, [sentiment]);

  const cfg = sentimentConfig[sentiment?.sentiment || 'neutral'];

  return (
    <div className={`card border ${cfg.bg} transition-all`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Newspaper className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">Crypto News Sentiment</h4>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
          className="p-1.5 rounded hover:bg-white/60 dark:hover:bg-gray-700/60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center space-x-2 py-6 justify-center">
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Fetching news & AI analysis...</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center space-x-2 py-4">
          <WifiOff className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">News unavailable — check GEMINI_API_KEY</span>
        </div>
      )}

      {!loading && !error && sentiment && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.badge}`}>
                <cfg.Icon className="w-4 h-4" />
                <span className="capitalize">{sentiment.sentiment}</span>
              </span>
              <span className={`text-sm font-medium ${impactColors[sentiment.impactLevel] || 'text-gray-400'}`}>
                {sentiment.impactLevel?.toUpperCase()} impact
              </span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Score: <span className={`font-bold text-base ${cfg.color}`}>
                {sentiment.score > 0 ? '+' : ''}{(sentiment.score * 100).toFixed(0)}%
              </span>
            </span>
          </div>

          {sentiment.reason && (
            <p className="text-sm text-gray-600 dark:text-gray-300 italic mb-4 leading-relaxed border-l-2 border-gray-300 dark:border-gray-600 pl-3">
              "{sentiment.reason}"
            </p>
          )}

          {sentiment.headlines?.length > 0 && (
            <div className="relative">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 font-medium">
                Live Headlines ({sentiment.headlines.length})
              </p>
              <div
                ref={scrollRef}
                className="overflow-y-hidden space-y-2 pr-1"
                style={{
                  height: '220px',
                  maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
                }}
              >
                {[...sentiment.headlines, ...sentiment.headlines].map((h, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-2 py-2 px-3 bg-white/70 dark:bg-gray-700/70 rounded-lg text-sm text-gray-700 dark:text-gray-200 leading-snug"
                  >
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right flex items-center justify-end space-x-1">
                <Wifi className="w-3 h-3" />
                <span>Cached 30 min · Hover to pause</span>
              </p>
            </div>
          )}
        </>
      )}

      {!loading && !error && !sentiment && (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-3 text-center">No news data yet. Generate a signal to load.</p>
      )}
    </div>
  );
};

export default NewsSentimentPanel;
