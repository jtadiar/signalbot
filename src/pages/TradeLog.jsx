import { useState, useEffect } from 'react';
import { readTradeLog, readConfig } from '../lib/config';

async function fetchUserFills(wallet, coin, startMs, endMs) {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'userFillsByTime', user: wallet, startTime: startMs, endTime: endMs }),
    });
    const fills = await res.json();
    const perp = (fills || []).filter(f =>
      String(f.coin || '').includes(`${coin}-PERP`) || String(f.coin || '').includes(coin)
    );
    return perp;
  } catch {
    return [];
  }
}

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
      const [raw, cfg] = await Promise.all([readTradeLog(), readConfig()]);
      const wallet = cfg?.wallet?.address;
      const coin = cfg?.market?.coin || 'BTC';
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
        g.exitPx = c.exitPx;
        if (c.ts && (!g.ts || new Date(c.ts) > new Date(g.ts))) g.ts = c.ts;
      }
      let uniqueCloses = Object.values(closeGroups);

      // Enrich with HL fill history for past trades (native TP triggers don't write TP1/TP2 to trades.jsonl)
      if (wallet && openEntries.length > 0) {
        const oldestTs = Math.min(...openEntries.map(o => new Date(o.ts || 0).getTime()));
        const startMs = Math.max(0, oldestTs - 24 * 60 * 60 * 1000);
        const endMs = Date.now() + 60000;
        const fills = await fetchUserFills(wallet, coin, startMs, endMs);
        const closeFills = (fills || []).filter(f => String(f.dir || '').toLowerCase().includes('close'));
        const opensChronological = [...openEntries].sort((a, b) => new Date(a.ts) - new Date(b.ts));

        for (let i = 0; i < opensChronological.length; i++) {
          const o = opensChronological[i];
          const oTime = new Date(o.ts || 0).getTime();
          const nextOTime = i + 1 < opensChronological.length
            ? new Date(opensChronological[i + 1].ts || 0).getTime()
            : endMs;
          const side = (o.side || '').toLowerCase();
          const posCloses = closeFills.filter(f => {
            const t = Number(f.time || 0);
            if (t <= oTime || t > nextOTime) return false;
            const d = String(f.dir || '').toLowerCase();
            return (side === 'short' && d.includes('short')) || (side === 'long' && d.includes('long'));
          });

          if (posCloses.length > 0) {
            const totalPnl = posCloses.reduce((s, f) => {
              const cp = f.closedPnl != null ? Number(f.closedPnl) : 0;
              const fee = f.fee != null ? Number(f.fee) : 0;
              return s + (cp - fee);
            }, 0);
            const totalSz = posCloses.reduce((s, f) => s + Number(f.sz || 0), 0);
            const lastFill = posCloses.sort((a, b) => Number(b.time) - Number(a.time))[0];
            const exitPx = Number(lastFill?.px || 0);
            const closeTs = lastFill ? new Date(Number(lastFill.time)).toISOString() : null;

            const key = `${o.side}:${Math.round(Number(o.entryPx))}`;
            const existing = closeGroups[key];
            if (existing) {
              existing.pnlUsd = totalPnl;
              existing.sizeBtc = totalSz;
              if (exitPx > 0) existing.exitPx = exitPx;
              if (closeTs) existing.ts = closeTs;
            } else {
              closeGroups[key] = {
                side: o.side,
                entryPx: o.entryPx,
                sizeBtc: totalSz,
                exitPx: exitPx || null,
                pnlUsd: totalPnl,
                ts: closeTs,
              };
            }
          }
        }
        uniqueCloses = Object.values(closeGroups);
      }

      // Only the MOST RECENT open (by timestamp) with no matching close can be "Live".
      const sortedOpens = [...openEntries].sort((a, b) => new Date(b.ts) - new Date(a.ts));
      const liveOpens = [];
      if (sortedOpens.length > 0) {
        const newest = sortedOpens[0];
        const hasClose = uniqueCloses.some(c =>
          c.side === newest.side && Math.abs(Number(c.entryPx) - Number(newest.entryPx)) < 1
        );
        if (!hasClose) liveOpens.push(newest);
      }

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
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                            background: 'rgba(255, 107, 0, 0.12)', color: 'var(--accent)',
                            border: '1px solid rgba(255, 107, 0, 0.2)',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                            boxShadow: '0 0 8px rgba(255, 107, 0, 0.1)',
                          }}>Live</span>
                        ) : (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
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
