import { useState, useEffect } from 'react';
import { readConfig } from '../lib/config';

async function fetchUserFills(wallet, coin, startMs, endMs) {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'userFillsByTime', user: wallet, startTime: startMs, endTime: endMs }),
    });
    const fills = await res.json();
    return (fills || []).filter(f =>
      String(f.coin || '').includes(`${coin}-PERP`) || String(f.coin || '').includes(coin)
    );
  } catch {
    return [];
  }
}

async function fetchOpenPosition(wallet, coin) {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: wallet }),
    });
    const data = await res.json();
    const positions = data?.assetPositions || [];
    for (const p of positions) {
      const pos = p?.position || p;
      if (String(pos.coin || '').includes(coin) && Math.abs(Number(pos.szi || 0)) > 0) {
        return pos;
      }
    }
  } catch {}
  return null;
}

function buildTradesFromFills(fills) {
  const sorted = [...fills].sort((a, b) => Number(a.time) - Number(b.time));
  const trades = [];
  let avgEntryPx = 0;
  let positionSz = 0;
  let positionSide = null;

  for (const f of sorted) {
    const dir = String(f.dir || '').toLowerCase();
    const isOpen = dir.includes('open');
    const isClose = dir.includes('close');
    const side = dir.includes('long') ? 'long' : 'short';
    const px = Number(f.px || 0);
    const sz = Number(f.sz || 0);
    const time = Number(f.time || 0);

    if (isOpen) {
      if (positionSide && positionSide !== side) {
        positionSz = 0;
        avgEntryPx = 0;
      }
      positionSide = side;
      avgEntryPx = (avgEntryPx * positionSz + px * sz) / (positionSz + sz);
      positionSz += sz;
    } else if (isClose) {
      const closedPnl = f.closedPnl != null ? Number(f.closedPnl) : 0;
      const fee = f.fee != null ? Number(f.fee) : 0;

      // Merge sub-fills from the same order (happen within ~2s, same direction)
      const last = trades[trades.length - 1];
      const sameEvent = last && !last.isLive && last.side === side
        && Math.abs(time - new Date(last.ts).getTime()) < 2000;

      if (sameEvent) {
        const prevSz = last.sizeBtc;
        last.sizeBtc += sz;
        last.exitPx = (last.exitPx * prevSz + px * sz) / last.sizeBtc;
        last.pnlUsd += (closedPnl - fee);
      } else {
        trades.push({
          side,
          entryPx: avgEntryPx,
          exitPx: px,
          sizeBtc: sz,
          pnlUsd: closedPnl - fee,
          ts: new Date(time).toISOString(),
          isLive: false,
        });
      }

      positionSz = Math.max(0, positionSz - sz);
      if (positionSz < 0.00001) {
        positionSz = 0;
        avgEntryPx = 0;
        positionSide = null;
      }
    }
  }

  // Open position with no close = live
  if (positionSz > 0.00001 && positionSide) {
    trades.push({
      side: positionSide,
      entryPx: avgEntryPx,
      exitPx: null,
      sizeBtc: positionSz,
      pnlUsd: 0,
      ts: null,
      isLive: true,
    });
  }

  return trades;
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

      // Fetch last 30 days of fills from HL — single source of truth
      const startMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const endMs = Date.now() + 60000;
      const [fills, livePos] = await Promise.all([
        fetchUserFills(wallet, coin, startMs, endMs),
        fetchOpenPosition(wallet, coin),
      ]);

      const hlTrades = buildTradesFromFills(fills);

      // If HL shows an open position, update or add a live entry
      if (livePos && Math.abs(Number(livePos.szi || 0)) > 0) {
        const last = hlTrades[hlTrades.length - 1];
        if (last && last.isLive) {
          last.entryPx = Number(livePos.entryPx || last.entryPx);
          last.sizeBtc = Math.abs(Number(livePos.szi));
        } else {
          const side = Number(livePos.szi) > 0 ? 'long' : 'short';
          hlTrades.push({
            side,
            entryPx: Number(livePos.entryPx || 0),
            exitPx: null,
            sizeBtc: Math.abs(Number(livePos.szi)),
            pnlUsd: 0,
            ts: new Date().toISOString(),
            isLive: true,
          });
        }
      }

      setTrades(hlTrades.reverse());
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
