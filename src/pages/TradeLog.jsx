import { useState, useEffect } from 'react';
import { readTradeLog } from '../lib/config';

export default function TradeLog() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrades();
    const interval = setInterval(loadTrades, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadTrades() {
    try {
      const raw = await readTradeLog();

      // Pair OPEN+CLOSE into completed trades, show only completed (CLOSE) rows.
      // Each CLOSE already has entryPx, exitPx, pnlUsd, side, sizeBtc.
      const closes = raw.filter(t => t.action === 'CLOSE' && !t.partial);
      const partials = raw.filter(t => t.action === 'CLOSE' && t.partial);

      // Group partials by entryPx+side to sum their PnL into one row per position
      const grouped = [];
      const seen = new Set();

      for (const c of closes) {
        const key = `${c.side}:${c.entryPx}`;
        if (!seen.has(key)) {
          seen.add(key);
          // Sum partials for this same entry
          const relatedPartials = partials.filter(p => p.side === c.side && p.entryPx === c.entryPx);
          const partialPnl = relatedPartials.reduce((s, p) => s + (p.pnlUsd || 0), 0);
          grouped.push({ ...c, pnlUsd: (c.pnlUsd || 0) + partialPnl });
        } else {
          grouped.push(c);
        }
      }

      // If there are only partials and no full close yet, show them as in-progress
      setTrades(grouped.length > 0 ? grouped : closes.length > 0 ? closes : raw.filter(t => t.action === 'CLOSE'));
    } catch {
      setTrades([]);
    }
    setLoading(false);
  }

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnlUsd || 0), 0);
  const wins = trades.filter(t => (t.pnlUsd || 0) > 0).length;
  const losses = trades.filter(t => (t.pnlUsd || 0) < 0).length;

  return (
    <div>
      <h1 className="page-title">Trade Log</h1>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Total PnL</div>
          <div className={`stat-big ${totalPnl >= 0 ? 'text-green' : 'text-red'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Wins / Losses</div>
          <div className="stat-big">
            <span className="text-green">{wins}</span>
            <span className="text-muted" style={{ fontSize: 20 }}> / </span>
            <span className="text-red">{losses}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Total Trades</div>
          <div className="stat-big">{trades.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Side</th>
                <th>Size (BTC)</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 20 }}>Loading...</td></tr>
              ) : trades.length === 0 ? (
                <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No trades yet. Start the bot to begin trading.</td></tr>
              ) : (
                trades.map((t, i) => (
                  <tr key={i}>
                    <td className="text-muted" style={{ fontSize: 12 }}>{t.ts ? new Date(t.ts).toLocaleString() : '--'}</td>
                    <td><span className={t.side === 'long' ? 'text-green' : 'text-red'}>{t.side?.toUpperCase()}</span></td>
                    <td className="mono">{t.sizeBtc?.toFixed(5) || '--'}</td>
                    <td className="mono">{t.entryPx ? `$${Number(t.entryPx).toLocaleString()}` : '--'}</td>
                    <td className="mono">{t.exitPx ? `$${Number(t.exitPx).toLocaleString()}` : '--'}</td>
                    <td className={`mono ${(t.pnlUsd || 0) >= 0 ? 'text-green' : 'text-red'}`}>
                      {t.pnlUsd !== undefined && t.pnlUsd !== null ? `${t.pnlUsd >= 0 ? '+' : ''}$${t.pnlUsd.toFixed(2)}` : '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
