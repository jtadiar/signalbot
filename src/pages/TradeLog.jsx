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
      const closeEntries = raw.filter(t => t.action === 'CLOSE');
      const openEntries = raw.filter(t => t.action === 'OPEN');

      // Group CLOSE events by position (side + entryPx): a position can have multiple partial closes (TP1, TP2, runner)
      const closeGroups = {};
      for (const c of closeEntries) {
        const key = `${c.side}:${Math.round(Number(c.entryPx))}`;
        if (!closeGroups[key]) {
          closeGroups[key] = { side: c.side, entryPx: c.entryPx, sizeBtc: 0, exitPx: c.exitPx, pnlUsd: 0, ts: c.ts };
        }
        const g = closeGroups[key];
        g.sizeBtc = (Number(g.sizeBtc) || 0) + (Number(c.sizeBtc) || 0);
        g.pnlUsd = (Number(g.pnlUsd) || 0) + (Number(c.pnlUsd) || 0);
        g.exitPx = c.exitPx; // use last close price
        if (c.ts && (!g.ts || new Date(c.ts) > new Date(g.ts))) g.ts = c.ts;
      }
      const uniqueCloses = Object.values(closeGroups);

      // Only the MOST RECENT open (by timestamp) with no matching close can be "Live".
      // Any older open without a close was closed externally before the fix was in place.
      const sortedOpens = [...openEntries].sort((a, b) => new Date(b.ts) - new Date(a.ts));
      const liveOpens = [];
      if (sortedOpens.length > 0) {
        const newest = sortedOpens[0];
        const hasClose = uniqueCloses.some(c =>
          c.side === newest.side && Math.abs(Number(c.entryPx) - Number(newest.entryPx)) < 1
        );
        if (!hasClose) liveOpens.push(newest);
      }

      // Build final list: live opens + closed trades, sorted newest first
      const all = [
        ...liveOpens.map(o => ({ ...o, isLive: true })),
        ...uniqueCloses.map(c => ({ ...c, isLive: false })),
      ];
      all.sort((a, b) => new Date(b.ts) - new Date(a.ts));
      setTrades(all);
    } catch {
      setTrades([]);
    }
    setLoading(false);
  }

  const closedTrades = trades.filter(t => !t.isLive);
  const totalPnl = closedTrades.reduce((sum, t) => sum + (Number(t.pnlUsd) || 0), 0);
  const wins = closedTrades.filter(t => (Number(t.pnlUsd) || 0) > 0).length;
  const losses = closedTrades.filter(t => (Number(t.pnlUsd) || 0) < 0).length;

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
          <div className="stat-big">{closedTrades.length}</div>
          {trades.some(t => t.isLive) && (
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              + {trades.filter(t => t.isLive).length} live
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Status</th>
                <th>Side</th>
                <th>Size (BTC)</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 20 }}>Loading...</td></tr>
              ) : trades.length === 0 ? (
                <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No trades yet. Start the bot to begin trading.</td></tr>
              ) : (
                trades.map((t, i) => {
                  const pnl = Number(t.pnlUsd) || 0;
                  return (
                    <tr key={i}>
                      <td className="text-muted" style={{ fontSize: 12 }}>{t.ts ? new Date(t.ts).toLocaleString() : '--'}</td>
                      <td>
                        {t.isLive ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            background: 'var(--accent)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px',
                          }}>Live</span>
                        ) : (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                            background: pnl >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
                            color: pnl >= 0 ? 'var(--green)' : 'var(--red)',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                          }}>{pnl >= 0 ? 'Win' : 'Loss'}</span>
                        )}
                      </td>
                      <td><span className={t.side === 'long' ? 'text-green' : 'text-red'}>{t.side?.toUpperCase()}</span></td>
                      <td className="mono">{t.sizeBtc?.toFixed(5) || '--'}</td>
                      <td className="mono">{t.entryPx ? `$${Number(t.entryPx).toLocaleString()}` : '--'}</td>
                      <td className="mono">{t.exitPx ? `$${Number(t.exitPx).toLocaleString()}` : t.isLive ? <span className="text-muted">—</span> : '--'}</td>
                      <td className={`mono ${t.isLive ? '' : pnl >= 0 ? 'text-green' : 'text-red'}`}>
                        {t.isLive
                          ? <span className="text-muted">—</span>
                          : `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
