import React, { useEffect, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  TrendingUp, TrendingDown, DollarSign, RotateCcw,
  X, Activity, PlusCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { paperAPI } from '../../services/api';

const f2   = (v) => v != null ? parseFloat(v).toFixed(2) : '—';
const usd  = (v) => v != null ? `$${parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const pct  = (v, sign = true) => v != null ? `${sign && v > 0 ? '+' : ''}${parseFloat(v).toFixed(2)}%` : '—';
const ts   = (v) => v ? dayjs(v).format('MM/DD HH:mm') : '—';

function BalanceBar({ portfolio }) {
  const p = portfolio;
  const up = (p?.totalReturn ?? 0) >= 0;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Paper Account</span>
        <span className="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full font-bold">VIRTUAL</span>
      </div>

      <div>
        <p className="text-3xl font-bold">{usd(p?.totalEquity)}</p>
        <p className={`text-sm font-semibold mt-0.5 ${up ? 'text-green-400' : 'text-red-400'}`}>
          {pct(p?.totalReturn)} overall return
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700">
        <div>
          <p className="text-xs text-slate-400">Deposited</p>
          <p className="text-sm font-bold text-white">{usd(p?.totalDeposited)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Free</p>
          <p className="text-sm font-bold text-green-400">{usd(p?.freeBalance)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">In Trades</p>
          <p className="text-sm font-bold text-amber-400">{usd(p?.allocatedUSD)}</p>
        </div>
      </div>

      {(p?.wins > 0 || p?.losses > 0) && (
        <div className="flex gap-3 text-xs border-t border-slate-700 pt-2">
          <span className="text-green-400 font-semibold">{p.wins}W</span>
          <span className="text-red-400 font-semibold">{p.losses}L</span>
          <span className="text-slate-400">Win rate: <b className="text-white">{p.winRate ?? '—'}%</b></span>
          <span className="text-slate-400">Realized: <b className={p.realizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>{p.realizedPnL >= 0 ? '+' : ''}{usd(p.realizedPnL)}</b></span>
        </div>
      )}
    </div>
  );
}

function DepositForm({ onDeposit }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    setLoading(true);
    await onDeposit(val);
    setAmount('');
    setLoading(false);
    setOpen(false);
  };

  const presets = [100, 500, 1000, 5000];

  return (
    <div className="border border-green-200 dark:border-green-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-bold text-green-800 dark:text-green-300">Deposit Virtual Funds</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-green-600 dark:text-green-400" /> : <ChevronDown className="w-4 h-4 text-green-600 dark:text-green-400" />}
      </button>

      {open && (
        <div className="p-4 bg-white dark:bg-gray-800 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {presets.map(p => (
              <button
                key={p}
                onClick={() => setAmount(String(p))}
                className="px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm font-semibold hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                ${p.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Custom amount"
                className="w-full pl-7 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <button
              onClick={submit}
              disabled={loading || !amount}
              className="px-4 py-2.5 bg-green-600 text-white font-bold rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '…' : 'Deposit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TradeForm({ currentPrice, freeBalance, onTrade }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState('BUY');
  const [entryPrice, setEntryPrice] = useState('');
  const [sizeUSD, setSizeUSD] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit1, setTakeProfit1] = useState('');
  const [takeProfit2, setTakeProfit2] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open && currentPrice && !entryPrice) {
      setEntryPrice(String(parseFloat(currentPrice).toFixed(2)));
    }
  }, [open, currentPrice]);

  const sizePct = (pct) => {
    const val = ((freeBalance ?? 0) * pct / 100).toFixed(2);
    setSizeUSD(val);
  };

  const suggestLevels = () => {
    const ep = parseFloat(entryPrice);
    if (!ep) return;
    const offset = ep * 0.01;
    if (direction === 'BUY') {
      if (!stopLoss)    setStopLoss((ep - offset).toFixed(2));
      if (!takeProfit1) setTakeProfit1((ep + offset * 2).toFixed(2));
    } else {
      if (!stopLoss)    setStopLoss((ep + offset).toFixed(2));
      if (!takeProfit1) setTakeProfit1((ep - offset * 2).toFixed(2));
    }
  };

  const ep  = parseFloat(entryPrice) || 0;
  const sl  = parseFloat(stopLoss)   || 0;
  const tp  = parseFloat(takeProfit1) || 0;
  const sz  = parseFloat(sizeUSD)    || 0;
  const riskUSD = sl && ep ? Math.abs(sz * ((ep - sl) / ep)) : null;
  const gainUSD = tp && ep ? Math.abs(sz * ((tp - ep) / ep)) : null;
  const rr = riskUSD && gainUSD ? (gainUSD / riskUSD).toFixed(2) : null;

  const submit = async () => {
    setErr('');
    if (!entryPrice || !sizeUSD) { setErr('Entry price and size are required'); return; }
    setLoading(true);
    try {
      await onTrade({ direction, entryPrice, sizeUSD, stopLoss: stopLoss || null, takeProfit1: takeProfit1 || null, takeProfit2: takeProfit2 || null });
      setEntryPrice(''); setSizeUSD(''); setStopLoss(''); setTakeProfit1(''); setTakeProfit2('');
      setOpen(false);
    } catch (e) {
      setErr(e.message || 'Failed to open trade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${direction === 'BUY' ? 'border-green-300 dark:border-green-700' : 'border-red-300 dark:border-red-700'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${direction === 'BUY' ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'}`}
      >
        <div className="flex items-center gap-2">
          {direction === 'BUY'
            ? <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            : <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400" />}
          <span className={`text-sm font-bold ${direction === 'BUY' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
            New Trade
          </span>
          {currentPrice && (
            <span className="text-xs text-gray-500 dark:text-gray-400">ETH {usd(currentPrice)}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
      </button>

      {open && (
        <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDirection('BUY')}
              className={`py-3 rounded-xl font-bold text-sm transition-colors ${direction === 'BUY' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
            >
              ▲ BUY / LONG
            </button>
            <button
              onClick={() => setDirection('SELL')}
              className={`py-3 rounded-xl font-bold text-sm transition-colors ${direction === 'SELL' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
            >
              ▼ SELL / SHORT
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Entry Price (USD)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)}
                  placeholder={currentPrice ? parseFloat(currentPrice).toFixed(2) : '0.00'}
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button onClick={() => setEntryPrice(parseFloat(currentPrice || 0).toFixed(2))}
                className="px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50">
                Current
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Amount to Invest (USD)</label>
              <span className="text-xs text-gray-400 dark:text-gray-500">Free: {usd(freeBalance)}</span>
            </div>
            <div className="relative mb-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" value={sizeUSD} onChange={e => setSizeUSD(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex gap-1">
              {[25, 50, 75, 100].map(p => (
                <button key={p} onClick={() => sizePct(p)}
                  className="flex-1 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-600 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 rounded-lg transition-colors">
                  {p}%
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-red-500 dark:text-red-400">Stop Loss</label>
                <button onClick={suggestLevels} className="text-xs text-blue-500 dark:text-blue-400 hover:underline">Suggest</button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
                  placeholder="optional"
                  className="w-full pl-7 pr-3 py-2.5 border border-red-200 dark:border-red-800 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1 block">Take Profit</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input type="number" value={takeProfit1} onChange={e => setTakeProfit1(e.target.value)}
                  placeholder="optional"
                  className="w-full pl-7 pr-3 py-2.5 border border-green-200 dark:border-green-800 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
            </div>
          </div>

          {rr && (
            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 flex gap-4 text-xs">
              <span>Risk: <b className="text-red-500 dark:text-red-400">-{usd(riskUSD)}</b></span>
              <span>Gain: <b className="text-green-600 dark:text-green-400">+{usd(gainUSD)}</b></span>
              <span>R:R <b className="text-blue-600 dark:text-blue-400">1:{rr}</b></span>
            </div>
          )}

          {err && <p className="text-sm text-red-500 dark:text-red-400 font-medium">{err}</p>}

          <button
            onClick={submit}
            disabled={loading || !entryPrice || !sizeUSD}
            className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-colors disabled:opacity-50 ${
              direction === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {loading ? 'Opening…' : `Open ${direction} Trade`}
          </button>
        </div>
      )}
    </div>
  );
}

function OpenTrades({ trades, onClose }) {
  if (!trades?.length) return (
    <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-2">No open positions</p>
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Open Positions ({trades.length})</p>
      {trades.map(t => {
        const isBuy = t.direction === 'BUY';
        const pnlPos = (t.livePnlUSD ?? 0) >= 0;
        return (
          <div key={t.id} className={`border rounded-xl p-3 space-y-2 ${isBuy ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isBuy ? <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400" />}
                <span className={`font-bold text-sm ${isBuy ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{t.direction}</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{usd(t.entryPrice)}</span>
              </div>
              <button onClick={() => onClose(t.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Close trade">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Size: <b className="text-gray-700 dark:text-gray-200">{usd(t.sizeUSD)}</b></span>
              <span>Units: <b className="text-gray-700 dark:text-gray-200">{parseFloat(t.sizeUnits).toFixed(4)}</b></span>
              {t.stopLoss    && <span>SL: <b className="text-red-500 dark:text-red-400">{usd(t.stopLoss)}</b></span>}
              {t.takeProfit1 && <span>TP: <b className="text-green-600 dark:text-green-400">{usd(t.takeProfit1)}</b></span>}
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">{ts(t.openedAt)}</span>
              <div className="text-right">
                <p className={`text-sm font-bold ${pnlPos ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {pnlPos ? '+' : ''}{f2(t.livePnlUSD)} ({pct(t.livePnlPercent)})
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TradeHistory({ trades }) {
  if (!trades?.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Trade History</p>
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
        {trades.map(t => {
          const won = (t.pnlUSD ?? 0) > 0;
          const reasonColor = t.closedReason === 'SL' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            : t.closedReason === 'TP' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
          return (
            <div key={t.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.direction === 'BUY' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                  {t.direction}
                </span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${reasonColor}`}>
                  {t.closedReason || 'Manual'}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{ts(t.closedAt)}</span>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${won ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {t.pnlUSD >= 0 ? '+' : ''}{usd(t.pnlUSD)}
                </p>
                <p className={`text-xs ${won ? 'text-green-400 dark:text-green-500' : 'text-red-400 dark:text-red-500'}`}>{pct(t.pnlPercent)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PaperTradingPanel({ livePortfolio, currentPrice }) {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const flash = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const res = await paperAPI.getPortfolio('ETHUSDT');
      setPortfolio(res.data.data);
    } catch (e) { console.error('Paper load error', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (livePortfolio) setPortfolio(livePortfolio);
  }, [livePortfolio]);

  useEffect(() => {
    if (!currentPrice || !portfolio?.openTrades?.length) return;
    const livePrice = parseFloat(currentPrice);
    let unrealizedPnL = 0;
    const updatedOpen = portfolio.openTrades.map(t => {
      const entry = parseFloat(t.entryPrice);
      const isBuy = t.direction === 'BUY';
      const pnlPct = isBuy
        ? ((livePrice - entry) / entry) * 100
        : ((entry - livePrice) / entry) * 100;
      const pnlUSD = parseFloat(t.sizeUSD) * (pnlPct / 100);
      unrealizedPnL += pnlUSD;
      return { ...t, livePrice, livePnlPercent: parseFloat(pnlPct.toFixed(2)), livePnlUSD: parseFloat(pnlUSD.toFixed(2)) };
    });
    setPortfolio(prev => ({
      ...prev,
      openTrades: updatedOpen,
      unrealizedPnL: parseFloat(unrealizedPnL.toFixed(2)),
      totalEquity: parseFloat((prev.effectiveBalance + unrealizedPnL).toFixed(2)),
      totalReturn: prev.totalDeposited > 0
        ? parseFloat(((prev.effectiveBalance + unrealizedPnL - prev.totalDeposited) / prev.totalDeposited * 100).toFixed(2))
        : 0,
    }));
  }, [currentPrice]);

  const handleDeposit = async (amount) => {
    try {
      const res = await paperAPI.deposit('ETHUSDT', amount);
      setPortfolio(res.data.data);
      flash(`Deposited ${usd(amount)} to your paper account`);
    } catch (e) { flash('Deposit failed', 'error'); }
  };

  const handleTrade = async ({ direction, entryPrice, sizeUSD, stopLoss, takeProfit1, takeProfit2 }) => {
    const res = await paperAPI.openTrade('ETHUSDT', direction, entryPrice, sizeUSD, stopLoss, takeProfit1, takeProfit2);
    if (!res.data.success) throw new Error(res.data.message);
    setPortfolio(res.data.data.portfolio);
    flash(`${direction} opened @ ${usd(entryPrice)}`);
  };

  const handleClose = async (tradeId) => {
    try {
      const res = await paperAPI.closeTrade(tradeId, 'ETHUSDT');
      if (res.data.success) {
        setPortfolio(res.data.data.portfolio);
        const t = res.data.data.trade;
        flash(`Closed ${t.direction}: ${t.pnlUSD >= 0 ? '+' : ''}${usd(t.pnlUSD)} (${pct(t.pnlPercent)})`);
      }
    } catch (e) { flash('Close failed', 'error'); }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset paper account? All trade history will be erased.')) return;
    try {
      const res = await paperAPI.resetAccount('ETHUSDT');
      setPortfolio(res.data.data);
      flash('Account reset');
    } catch (e) { flash('Reset failed', 'error'); }
  };

  if (loading) return (
    <div className="card flex items-center justify-center py-10">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const p = portfolio;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Paper Trading</h3>
        </div>
        <button onClick={handleReset} className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {msg && (
        <div className={`text-sm rounded-xl px-3 py-2 font-medium ${
          msg.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : msg.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        }`}>{msg.text}</div>
      )}

      <BalanceBar portfolio={p} />
      <DepositForm onDeposit={handleDeposit} />

      {(p?.totalDeposited > 0) && (
        <TradeForm
          currentPrice={currentPrice}
          freeBalance={p?.freeBalance}
          onTrade={handleTrade}
        />
      )}

      {p?.totalDeposited === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center">Deposit funds above to start trading</p>
      )}

      <OpenTrades trades={p?.openTrades} onClose={handleClose} />
      <TradeHistory trades={p?.recentTrades} />
    </div>
  );
}
