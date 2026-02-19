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
      const data = await readTradeLog();
      setTrades(data);
    } catch {
      setTrades([]);
    }
    setLoading(false);
  }

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnlUsd || 0), 0);
  const wins = trades.filter(t => t.action === 'CLOSE' && t.pnlUsd > 0).length;
  const losses = trades.filter(t => t.action === 'CLOSE' && t.pnlUsd < 0).length;

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
                <th>Action</th>
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
                trades.map((t, i) => (
                  <tr key={i}>
                    <td className="text-muted" style={{ fontSize: 12 }}>{t.ts ? new Date(t.ts).toLocaleString() : '--'}</td>
                    <td><span className={t.action === 'OPEN' ? 'text-accent' : 'text-muted'}>{t.action}</span></td>
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
