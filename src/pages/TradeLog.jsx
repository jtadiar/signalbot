import { useState, useEffect } from 'react';
import { readConfig } from '../lib/config';

export default function TradeLog() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrades();
    const interval = setInterval(loadTrades, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadTrades() {
    try {
      const cfg = await readConfig();
      const wallet = cfg?.wallet?.address;
      const coin = cfg?.market?.coin || 'BTC';
      if (!wallet) { setTrades([]); setLoading(false); return; }

      const startMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const endMs = Date.now() + 60000;

      // Fetch fills and position from HL in parallel
      const [fillsRes, posRes] = await Promise.all([
        fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'userFillsByTime', user: wallet, startTime: startMs, endTime: endMs }),
        }).then(r => r.json()).catch(() => []),
        fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'clearinghouseState', user: wallet }),
        }).then(r => r.json()).catch(() => null),
      ]);

      const coinFills = (fillsRes || []).filter(f =>
        String(f.coin || '').includes(coin)
      );

      // Close fills → trade rows (each close fill = one row, exactly like HL)
      const closeFills = coinFills
        .filter(f => String(f.dir || '').toLowerCase().includes('close'))
        .sort((a, b) => Number(b.time) - Number(a.time));

      const rows = closeFills.map(f => {
        const dir = String(f.dir || '').toLowerCase();
        const side = dir.includes('long') ? 'long' : 'short';
        const pnl = Number(f.closedPnl || 0);
        const fee = Number(f.fee || 0);
        return {
          side,
          exitPx: Number(f.px || 0),
          sizeBtc: Number(f.sz || 0),
          pnlUsd: pnl - fee,
          ts: new Date(Number(f.time)).toISOString(),
          isLive: false,
        };
      });

      // Check for live position
      const positions = posRes?.assetPositions || [];
      for (const p of positions) {
        const pos = p?.position || p;
        if (String(pos.coin || '').includes(coin) && Math.abs(Number(pos.szi || 0)) > 0) {
          const side = Number(pos.szi) > 0 ? 'long' : 'short';
          rows.unshift({
            side,
            entryPx: Number(pos.entryPx || 0),
            exitPx: null,
            sizeBtc: Math.abs(Number(pos.szi)),
            pnlUsd: Number(pos.unrealizedPnl || 0),
            ts: new Date().toISOString(),
            isLive: true,
          });
          break;
        }
      }

      setTrades(rows);
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
                <th>Price</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 20 }}>Loading...</td></tr>
              ) : trades.length === 0 ? (
                <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No trades yet. Start the bot to begin trading.</td></tr>
              ) : (
                trades.map((t, i) => {
                  const pnl = Number(t.pnlUsd) || 0;
                  const price = t.isLive ? t.entryPx : t.exitPx;
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
                      <td><span className={t.side === 'long' ? 'text-green' : 'text-red'}>{t.isLive ? t.side?.toUpperCase() : `Close ${t.side}`}</span></td>
                      <td className="mono">{t.sizeBtc?.toFixed(5) || '--'}</td>
                      <td className="mono">{price ? `$${Number(price).toLocaleString()}` : '--'}</td>
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
