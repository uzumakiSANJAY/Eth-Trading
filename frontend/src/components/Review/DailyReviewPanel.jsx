import React, { useState } from 'react';
import dayjs from 'dayjs';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle,
  XCircle, Zap, BarChart2, Target, Search, ChevronDown, ChevronUp,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────── */
const pct = (v) => (v !== null && v !== undefined ? `${v > 0 ? '+' : ''}${v}%` : '—');
const usd = (v) => (v !== null && v !== undefined ? `$${parseFloat(v).toFixed(2)}` : '—');
const ts  = (v) => v ? dayjs(Number(v)).format('HH:mm') : '—';

function DirectionBadge({ direction }) {
  if (direction === 'bullish')
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-bold"><TrendingUp className="w-4 h-4" /> Bullish</span>;
  if (direction === 'bearish')
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-bold"><TrendingDown className="w-4 h-4" /> Bearish</span>;
  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-bold"><Minus className="w-4 h-4" /> Sideways</span>;
}

function Section({ title, icon: Icon, iconColor = 'text-gray-500', children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <span className="text-base font-bold text-gray-800">{title}</span>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  );
}

/* ─── Price Action ────────────────────────────────────────── */
function PriceActionBar({ pa }) {
  if (!pa || pa.candleCount === 0)
    return <p className="text-sm text-gray-400 italic">No candles recorded for today yet.</p>;

  const changeColor = pa.changePercent > 0 ? 'text-green-600' : pa.changePercent < 0 ? 'text-red-500' : 'text-gray-500';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Open',  value: usd(pa.open),  color: 'text-gray-800',  border: 'border-gray-200' },
          { label: 'High',  value: usd(pa.high),  color: 'text-green-600', border: 'border-green-200' },
          { label: 'Low',   value: usd(pa.low),   color: 'text-red-500',   border: 'border-red-200'   },
          { label: 'Close', value: usd(pa.close), color: changeColor,      border: 'border-gray-200'  },
        ].map(({ label, value, color, border }) => (
          <div key={label} className={`bg-white border ${border} rounded-xl p-4`}>
            <p className="text-sm text-gray-500 font-medium mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-sm font-medium">
        <span className="text-gray-600">Candles: <b className="text-gray-900">{pa.candleCount}</b></span>
        <span className="text-green-600">↑ {pa.bullishCandles} bullish</span>
        <span className="text-red-500">↓ {pa.bearishCandles} bearish</span>
        <span className="text-gray-600">Range: <b className="text-gray-900">{usd(pa.range)}</b></span>
        <span className={`font-bold ${changeColor}`}>Day change: {pct(pa.changePercent)}</span>
      </div>
    </div>
  );
}

/* ─── Breakouts ───────────────────────────────────────────── */
function BreakoutsSection({ breakouts }) {
  if (!breakouts) return null;
  const { volumeConfirmedBreakouts, falseBreakouts, bbBreakout, emaBreakout, volumeSpikes, summary } = breakouts;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 italic">{summary}</p>

      {/* Volume-confirmed S/R breakouts */}
      {volumeConfirmedBreakouts?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-700">Volume-Confirmed Breakouts</p>
          {volumeConfirmedBreakouts.map((b, i) => (
            <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${b.direction === 'bullish' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
              <div className="flex items-center gap-3">
                {b.direction === 'bullish'
                  ? <TrendingUp className="w-5 h-5 text-green-600" />
                  : <TrendingDown className="w-5 h-5 text-red-500" />}
                <div>
                  <p className={`text-base font-bold ${b.direction === 'bullish' ? 'text-green-700' : 'text-red-600'}`}>
                    {b.type === 'resistance_break' ? 'Resistance Break' : 'Support Breakdown'}
                  </p>
                  <p className="text-sm text-gray-500">{usd(b.level)} → {usd(b.breakoutPrice)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${b.direction === 'bullish' ? 'text-green-600' : 'text-red-500'}`}>+{b.strengthPct}%</p>
                <p className="text-sm text-gray-400">{ts(b.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* False breakouts */}
      {falseBreakouts?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-amber-700">⚠ False Breakouts (Traps)</p>
          {falseBreakouts.map((b, i) => (
            <div key={i} className="flex items-center justify-between bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-base font-bold text-amber-800">{b.trap === 'bull_trap' ? 'Bull Trap' : 'Bear Trap'}</p>
                  <p className="text-sm text-gray-500">Level: {usd(b.level)}</p>
                </div>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>Broke {ts(b.timestamp)}</p>
                <p>Reversed {ts(b.reverseTimestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BB status */}
      {bbBreakout && (
        <div className={`rounded-xl px-4 py-3 border ${bbBreakout.inSqueeze ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-base font-semibold ${bbBreakout.inSqueeze ? 'text-purple-700' : 'text-gray-600'}`}>
            BB: {bbBreakout.description}
          </p>
          {bbBreakout.breakoutDetected && (
            <p className={`text-base font-bold mt-1 ${bbBreakout.direction === 'bullish' ? 'text-green-600' : 'text-red-500'}`}>
              Breakout {bbBreakout.direction}!
            </p>
          )}
        </div>
      )}

      {/* EMA alignment */}
      {emaBreakout && (
        <div className={`rounded-xl px-4 py-3 border ${emaBreakout.alignedBull ? 'bg-green-50 border-green-300' : emaBreakout.alignedBear ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-base font-semibold ${emaBreakout.alignedBull ? 'text-green-700' : emaBreakout.alignedBear ? 'text-red-600' : 'text-gray-600'}`}>
            EMA: {emaBreakout.description}
          </p>
        </div>
      )}

      {/* Volume spikes */}
      {volumeSpikes?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-700">Volume Spikes (≥2× avg)</p>
          {volumeSpikes.slice(0, 4).map((s, i) => (
            <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${s.direction === 'bullish' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-base font-semibold ${s.direction === 'bullish' ? 'text-green-700' : 'text-red-600'}`}>
                {ts(s.timestamp)} — {s.ratio}× volume
              </p>
              <p className={`text-base font-bold ${s.priceChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {pct(s.priceChange)}
              </p>
            </div>
          ))}
        </div>
      )}

      {!volumeConfirmedBreakouts?.length && !falseBreakouts?.length && !bbBreakout?.inSqueeze && !volumeSpikes?.length && (
        <p className="text-sm text-gray-400 italic">No breakout events detected today.</p>
      )}
    </div>
  );
}

/* ─── Signal Performance ──────────────────────────────────── */
function SignalPerformanceSection({ sa }) {
  if (!sa) return null;
  const winRateColor = sa.winRate >= 60 ? 'text-green-600' : sa.winRate >= 40 ? 'text-amber-600' : 'text-red-500';
  const pnlColor = sa.totalPnlPercent > 0 ? 'text-green-600' : sa.totalPnlPercent < 0 ? 'text-red-500' : 'text-gray-500';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 font-medium mb-1">Trades</p>
          <p className="text-3xl font-bold text-gray-900">{sa.tradeable}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 font-medium mb-1">Win Rate</p>
          <p className={`text-3xl font-bold ${winRateColor}`}>{sa.winRate !== null ? `${sa.winRate}%` : '—'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 font-medium mb-1">Day PnL</p>
          <p className={`text-3xl font-bold ${pnlColor}`}>{pct(sa.totalPnlPercent)}</p>
        </div>
      </div>

      {sa.signals?.length > 0 && (
        <div className="space-y-2">
          {sa.signals.map((s) => {
            const rowBg = s.type === 'BUY'    ? 'bg-green-50 border-green-300'
              : s.type === 'SELL'   ? 'bg-red-50 border-red-300'
              : s.type === 'VETOED' ? 'bg-amber-50 border-amber-300'
              : 'bg-gray-50 border-gray-200';
            const typeColor = s.type === 'BUY' ? 'text-green-700' : s.type === 'SELL' ? 'text-red-600' : 'text-gray-600';

            return (
              <div key={s.id} className={`flex items-center justify-between border rounded-xl px-4 py-3 ${rowBg}`}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-3">
                    <span className={`text-base font-bold ${typeColor}`}>{s.type}</span>
                    <span className="text-base text-gray-700 font-semibold">{usd(s.entryPrice)}</span>
                  </div>
                  <div className="flex gap-3 text-sm text-gray-500">
                    {s.stopLoss && <span>SL {usd(s.stopLoss)}</span>}
                    {s.takeProfit1 && <span>TP {usd(s.takeProfit1)}</span>}
                    {s.riskReward && <span>RR {s.riskReward}</span>}
                  </div>
                  {s.vetoReason && <p className="text-sm text-amber-600">{s.vetoReason}</p>}
                </div>
                <div className="text-right">
                  {s.pnlPercent !== null ? (
                    <p className={`text-lg font-bold ${s.pnlPercent > 0 ? 'text-green-600' : 'text-red-500'}`}>{pct(s.pnlPercent)}</p>
                  ) : (
                    <p className="text-base font-bold text-amber-600">{s.status === 'active' ? 'Active' : s.vetoReason ? 'Vetoed' : 'Pending'}</p>
                  )}
                  <p className="text-sm text-gray-400">{s.confidence}% conf</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sa.tradeable === 0 && (
        <p className="text-sm text-gray-400 italic">No BUY/SELL signals generated today.</p>
      )}
    </div>
  );
}

/* ─── Patterns ────────────────────────────────────────────── */
function PatternsSection({ ps }) {
  if (!ps || ps.total === 0)
    return <p className="text-sm text-gray-400 italic">No candlestick patterns detected today.</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-5 text-sm font-semibold">
        <span className="text-green-600">↑ {ps.bullish} bullish</span>
        <span className="text-red-500">↓ {ps.bearish} bearish</span>
        <span className="text-gray-400">{ps.neutral} neutral</span>
      </div>
      <div className="space-y-2">
        {ps.patterns.map((p, i) => (
          <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${p.signal === 'bullish' ? 'bg-green-50 border-green-200' : p.signal === 'bearish' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
            <div>
              <p className={`text-base font-bold ${p.signal === 'bullish' ? 'text-green-700' : p.signal === 'bearish' ? 'text-red-600' : 'text-gray-700'}`}>
                {p.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </p>
              <p className="text-sm text-gray-500">{p.description}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-700">{p.strength}%</p>
              <p className="text-sm text-gray-400">{ts(p.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Missed Opportunities ────────────────────────────────── */
function MissedOpportunitiesSection({ missed }) {
  if (!missed || missed.length === 0)
    return <p className="text-sm text-gray-400 italic">No significant missed opportunities today.</p>;

  return (
    <div className="space-y-3">
      {missed.map((m, i) => (
        <div key={i} className="border border-orange-300 bg-orange-50 rounded-xl px-4 py-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <p className="text-base font-bold text-orange-800">{m.description}</p>
            </div>
            <p className={`text-lg font-bold flex-shrink-0 ${m.direction === 'bullish' ? 'text-green-600' : 'text-red-500'}`}>
              {m.direction === 'bullish' ? '+' : '-'}{m.potentialPnlPct}% potential
            </p>
          </div>
          <p className="text-sm text-orange-600 font-medium">Signal was {m.signalType} — {m.vetoReason}</p>
          <p className="text-sm text-gray-500">Entry: {usd(m.entryPrice)} · {ts(m.signalTimestamp)}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Loss Optimization ───────────────────────────────────── */
function LossOptimizationSection({ lo }) {
  if (!lo) return null;

  const pnlColor = lo.totalPnlPercent > 0 ? 'text-green-600' : lo.totalPnlPercent < 0 ? 'text-red-500' : 'text-gray-500';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 font-medium mb-1">Losses</p>
          <p className="text-3xl font-bold text-red-500">{lo.losers}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 font-medium mb-1">Win Rate</p>
          <p className={`text-3xl font-bold ${lo.winRate >= 50 ? 'text-green-600' : 'text-red-500'}`}>
            {lo.winRate !== null ? `${lo.winRate}%` : '—'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500 font-medium mb-1">Total PnL</p>
          <p className={`text-3xl font-bold ${pnlColor}`}>{pct(lo.totalPnlPercent)}</p>
        </div>
      </div>

      {lo.scenarios?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-700">Loss Root Causes</p>
          {lo.scenarios.map((s, i) => (
            <div key={i} className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-base text-red-700">{s.description}</p>
                {s.pnlPct !== undefined && <p className="text-base font-bold text-red-500 mt-0.5">{pct(s.pnlPct)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {lo.recommendations?.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-700">Recommendations</p>
          {lo.recommendations.map((r, i) => (
            <div key={i} className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-base text-blue-800">{r}</p>
            </div>
          ))}
        </div>
      )}

      {lo.worstLoss && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-sm font-bold text-gray-600 mb-2">Worst Trade Today</p>
          <div className="flex flex-wrap gap-4 text-base">
            <span className="font-semibold text-gray-700">{lo.worstLoss.type}</span>
            <span className="text-gray-500">Entry {usd(lo.worstLoss.entryPrice)}</span>
            {lo.worstLoss.exitPrice && <span className="text-gray-500">Exit {usd(lo.worstLoss.exitPrice)}</span>}
            <span className="font-bold text-red-500">{pct(lo.worstLoss.pnlPct)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Panel ──────────────────────────────────────────── */
export default function DailyReviewPanel({ data, loading, error, onRefresh }) {
  if (loading) {
    return (
      <div className="card flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-base text-gray-500">Building daily review…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border border-red-200 bg-red-50">
        <p className="text-base text-red-600 font-medium">Failed to load daily review.</p>
        <button onClick={onRefresh} className="mt-2 text-sm text-red-500 underline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const { date, priceAction, signalAnalysis, patternSummary, breakouts, marketStructure, supportResistance, missedOpportunities, lossOptimization, daySummary } = data;

  return (
    <div className="space-y-4">
      {/* ── Header card ── */}
      <div className="card bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Search className="w-6 h-6 text-slate-300" />
            <h3 className="text-xl font-bold">Daily Market Review</h3>
            <span className="text-sm text-slate-400">{date}</span>
          </div>
          <div className="flex items-center gap-3">
            {priceAction?.direction && <DirectionBadge direction={priceAction.direction} />}
            <button onClick={onRefresh} className="text-sm text-slate-400 hover:text-white underline">Refresh</button>
          </div>
        </div>

        {daySummary && (
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{daySummary}</p>
        )}

        <div className="flex flex-wrap gap-3">
          {supportResistance?.nearestSupport && (
            <span className="bg-green-900/50 text-green-300 px-3 py-1.5 rounded-lg text-sm font-semibold">
              Support: ${supportResistance.nearestSupport}
            </span>
          )}
          {supportResistance?.nearestResistance && (
            <span className="bg-red-900/50 text-red-300 px-3 py-1.5 rounded-lg text-sm font-semibold">
              Resistance: ${supportResistance.nearestResistance}
            </span>
          )}
          {marketStructure?.trend && marketStructure.trend !== 'unknown' && (
            <span className="bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-sm font-semibold capitalize">
              Structure: {marketStructure.trend}
            </span>
          )}
          {marketStructure?.summary && (
            <span className="bg-slate-700/60 text-slate-300 px-3 py-1.5 rounded-lg text-sm">
              {marketStructure.summary}
            </span>
          )}
        </div>
      </div>

      {/* ── Sections ── */}
      <Section title="Price Action" icon={BarChart2} iconColor="text-blue-500">
        <PriceActionBar pa={priceAction} />
      </Section>

      <Section title="Breakouts & Volume Events" icon={Zap} iconColor="text-yellow-500">
        <BreakoutsSection breakouts={breakouts} />
      </Section>

      <Section title={`Candlestick Patterns (${patternSummary?.total ?? 0})`} icon={TrendingUp} iconColor="text-purple-500" defaultOpen={false}>
        <PatternsSection ps={patternSummary} />
      </Section>

      <Section title="Signal Performance" icon={Target} iconColor="text-indigo-500">
        <SignalPerformanceSection sa={signalAnalysis} />
      </Section>

      <Section
        title={`Missed Opportunities (${missedOpportunities?.length ?? 0})`}
        icon={AlertTriangle}
        iconColor="text-orange-500"
        defaultOpen={(missedOpportunities?.length ?? 0) > 0}
      >
        <MissedOpportunitiesSection missed={missedOpportunities} />
      </Section>

      <Section title="Loss Optimization" icon={CheckCircle} iconColor="text-teal-500">
        <LossOptimizationSection lo={lossOptimization} />
      </Section>
    </div>
  );
}
