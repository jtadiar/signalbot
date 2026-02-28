import { useState, useEffect } from 'react';
import { readConfig } from '../lib/config';

function mergeSubFills(fills) {
  const sorted = [...fills].sort((a, b) => Number(a.time) - Number(b.time));
  const merged = [];
  for (const f of sorted) {
    const dir = String(f.dir || '').toLowerCase();
    const side = dir.includes('long') ? 'long' : 'short';
    const isOpen = dir.includes('open');
    const time = Number(f.time || 0);
    const oid = f.oid ?? null;
    const last = merged[merged.length - 1];
    const same = last && last._isOpen === isOpen && last._side === side && (
      (oid && last._oid === oid) || Math.abs(time - last.time) < 5000
    );
    if (same) {
      const sz = Number(f.sz || 0);
      last.sz += sz;
      last._wpx += Number(f.px || 0) * sz;
      last.px = last._wpx / last.sz;
      if (f.closedPnl != null) last.closedPnl = (last.closedPnl || 0) + Number(f.closedPnl);
      if (f.fee != null) last.fee = (last.fee || 0) + Number(f.fee);
      last.time = Math.max(last.time, time);
    } else {
      const sz = Number(f.sz || 0);
      const px = Number(f.px || 0);
      merged.push({
        ...f,
        sz, px, time,
        closedPnl: f.closedPnl != null ? Number(f.closedPnl) : null,
        fee: f.fee != null ? Number(f.fee) : null,
        _wpx: px * sz, _isOpen: isOpen, _side: side, _oid: oid,
      });
    }
  }
  return merged;
}

function buildPositions(fills) {
  const merged = mergeSubFills(fills);
  const positions = [];
  let pos = null;
  let netSz = 0;

  for (const f of merged) {
    const dir = String(f.dir || '').toLowerCase();
    const isOpen = dir.includes('open');
    const isClose = dir.includes('close');
    const side = dir.includes('long') ? 'long' : 'short';
    const px = Number(f.px || 0);
    const sz = Number(f.sz || 0);
    const time = Number(f.time || 0);

    if (isOpen) {
      if (pos && pos.side !== side && netSz > 0.00001) {
        positions.push(pos);
        pos = null;
        netSz = 0;
      }
      if (!pos) {
        pos = { side, entryWeighted: 0, entrySz: 0, exitWeighted: 0, closeSz: 0, pnl: 0, fees: 0, openTime: time, closeTime: 0 };
      }
      pos.entryWeighted += px * sz;
      pos.entrySz += sz;
      netSz += sz;
    } else if (isClose) {
      if (!pos) {
        pos = { side, entryWeighted: 0, entrySz: 0, exitWeighted: 0, closeSz: 0, pnl: 0, fees: 0, openTime: time, closeTime: 0 };
      }
      pos.exitWeighted += px * sz;
      pos.closeSz += sz;
      if (f.closedPnl != null) pos.pnl += Number(f.closedPnl);
      if (f.fee != null) pos.fees += Number(f.fee);
      pos.closeTime = time;
      netSz = Math.max(0, netSz - sz);

      if (netSz < 0.00001) {
        positions.push(pos);
        pos = null;
        netSz = 0;
      }
    }
  }

  if (pos && (pos.closeSz > 0 || netSz > 0.00001)) {
    pos.isLive = netSz > 0.00001;
    positions.push(pos);
  }

  return positions;
}

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

      const [fillsRes, posRes] = await Promise.all([
        fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'userFillsByTime', user: wallet, startTime: startMs, endTime: endMs }),
        }).then(r => r.json()),
        fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'clearinghouseState', user: wallet }),
        }).then(r => r.json()),
      ]);

      const coinFills = (fillsRes || []).filter(f =>
        String(f.coin || '').includes(coin)
      );

      const hlPositions = buildPositions(coinFills);

      const rows = hlPositions.map(p => ({
        side: p.side,
        entryPx: p.entrySz > 0 ? Math.round(p.entryWeighted / p.entrySz) : 0,
        exitPx: p.closeSz > 0 ? Math.round(p.exitWeighted / p.closeSz) : null,
        sizeBtc: p.entrySz || p.closeSz,
        pnlUsd: p.pnl,
        ts: p.closeTime ? new Date(p.closeTime).toISOString() : new Date(p.openTime).toISOString(),
        isLive: !!p.isLive,
      })).reverse();

      // Override live position data from HL clearinghouse (authoritative)
      const hlAssets = posRes?.assetPositions || [];
      for (const a of hlAssets) {
        const ap = a?.position || a;
        if (String(ap.coin || '').includes(coin) && Math.abs(Number(ap.szi || 0)) > 0) {
          const liveSide = Number(ap.szi) > 0 ? 'long' : 'short';
          const liveRow = rows.find(r => r.isLive);
          if (liveRow) {
            liveRow.entryPx = Number(ap.entryPx || liveRow.entryPx);
            liveRow.sizeBtc = Math.abs(Number(ap.szi));
            liveRow.pnlUsd = Number(ap.unrealizedPnl || 0);
          } else {
            rows.unshift({
              side: liveSide,
              entryPx: Number(ap.entryPx || 0),
              exitPx: null,
              sizeBtc: Math.abs(Number(ap.szi)),
              pnlUsd: Number(ap.unrealizedPnl || 0),
              ts: new Date().toISOString(),
              isLive: true,
            });
          }
          break;
        }
      }

      setTrades(rows);
    } catch (err) {
      console.error('[TradeLog] Failed to load from HL:', err);
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
