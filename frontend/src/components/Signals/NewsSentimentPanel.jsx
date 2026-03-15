import React, { useEffect, useRef } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const sentimentConfig = {
  bullish: {
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
    Icon: TrendingUp,
  },
  bearish: {
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-800',
    dot: 'bg-red-500',
    Icon: TrendingDown,
  },
  neutral: {
    color: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-200',
    badge: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-400',
    Icon: Minus,
  },
};

const impactColors = { high: 'text-red-500', medium: 'text-orange-500', low: 'text-gray-400' };

const NewsSentimentPanel = ({ sentiment, loading, error, onRefresh }) => {
  const scrollRef = useRef(null);

  // Auto-scroll the headlines list
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

    // Pause on hover
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
          <Newspaper className="w-5 h-5 text-gray-600" />
          <h4 className="text-base font-semibold text-gray-900">Crypto News Sentiment</h4>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
          className="p-1.5 rounded hover:bg-white/60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center space-x-2 py-6 justify-center">
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
          <span className="text-sm text-gray-500">Fetching news & AI analysis...</span>
        </div>
      )}

      {/* Error / no key state */}
      {!loading && error && (
        <div className="flex items-center space-x-2 py-4">
          <WifiOff className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500">News unavailable — check GEMINI_API_KEY</span>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && sentiment && (
        <>
          {/* Sentiment badge + score */}
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
            <span className="text-sm text-gray-500">
              Score: <span className={`font-bold text-base ${cfg.color}`}>
                {sentiment.score > 0 ? '+' : ''}{(sentiment.score * 100).toFixed(0)}%
              </span>
            </span>
          </div>

          {/* AI reason */}
          {sentiment.reason && (
            <p className="text-sm text-gray-600 italic mb-4 leading-relaxed border-l-3 border-gray-300 pl-3 border-l-2">
              "{sentiment.reason}"
            </p>
          )}

          {/* Scrollable headlines */}
          {sentiment.headlines?.length > 0 && (
            <div className="relative">
              <p className="text-sm text-gray-500 mb-2 font-medium">
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
                {/* Duplicate for seamless loop */}
                {[...sentiment.headlines, ...sentiment.headlines].map((h, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-2 py-2 px-3 bg-white/70 rounded-lg text-sm text-gray-700 leading-snug"
                  >
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-right flex items-center justify-end space-x-1">
                <Wifi className="w-3 h-3" />
                <span>Cached 30 min · Hover to pause</span>
              </p>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !error && !sentiment && (
        <p className="text-sm text-gray-400 py-3 text-center">No news data yet. Generate a signal to load.</p>
      )}
    </div>
  );
};

export default NewsSentimentPanel;
