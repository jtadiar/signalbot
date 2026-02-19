import { useState, useEffect, useCallback } from 'react';
import { startBot, stopBot, onBotEvent, isBotRunning } from '../lib/bot';

export default function Dashboard() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('stopped');
  const [position, setPosition] = useState(null);
  const [lastSignal, setLastSignal] = useState(null);
  const [dailyPnl, setDailyPnl] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [logs, setLogs] = useState([]);

  // Sync with actual bot state on mount
  useEffect(() => {
    isBotRunning().then(isRunning => {
      if (isRunning) {
        setRunning(true);
        setStatus('running');
      }
    });
  }, []);

  useEffect(() => {
    const unsub = onBotEvent((event) => {
      switch (event.type) {
        case 'started':
          setRunning(true);
          setStatus('running');
          setLastError(null);
          break;
        case 'stopped':
          setRunning(false);
          setStatus('stopped');
          break;
        case 'position':
          setPosition(event.data);
          break;
        case 'signal':
          setLastSignal(event);
          break;
        case 'pnl':
          setDailyPnl(event.value);
          break;
        case 'halt':
          setStatus('halted');
          break;
        case 'error':
          setLastError(event.message);
          break;
        case 'log':
          setLogs(prev => [...prev.slice(-50), event.message]);
          break;
        default:
          break;
      }
    });
    return unsub;
  }, []);

  const [starting, setStarting] = useState(false);

  const handleToggle = useCallback(async () => {
    if (running) {
      await stopBot();
      setRunning(false);
      setStatus('stopped');
    } else {
      setStarting(true);
      setLastError(null);
      const ok = await startBot();
      setStarting(false);
      if (ok) {
        setRunning(true);
        setStatus('running');
      }
    }
  }, [running]);

  const statusClass = status === 'running' ? 'status-running' : status === 'halted' ? 'status-halted' : 'status-stopped';
  const statusLabel = status === 'running' ? 'Running' : status === 'halted' ? 'Halted' : 'Stopped';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`status-badge ${statusClass}`}>
            <span className="status-dot" />
            {statusLabel}
          </span>
          <button className={`btn ${running ? 'btn-danger' : 'btn-primary'}`} onClick={handleToggle} disabled={starting}>
            {starting ? 'Starting...' : running ? 'Stop Bot' : 'Start Bot'}
          </button>
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <div className="card-title">Daily PnL</div>
          <div className={`stat-big ${dailyPnl > 0 ? 'text-green' : dailyPnl < 0 ? 'text-red' : ''}`}>
            {dailyPnl !== null ? `${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toFixed(2)}` : '--'}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Status</div>
          <div className="stat-big">{statusLabel}</div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            {lastError ? `Last error: ${lastError.slice(0, 60)}` : 'No errors'}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Last Signal</div>
          <div className="stat-big">
            {lastSignal ? (
              <span className={lastSignal.side === 'long' ? 'text-green' : 'text-red'}>
                {lastSignal.side?.toUpperCase()}
              </span>
            ) : '--'}
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            {lastSignal?.reason?.slice(0, 60) || 'Waiting for signal...'}
          </div>
        </div>
      </div>

      {lastError && (
        <div className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-bg)', marginBottom: 16 }}>
          <div style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>Error: {lastError}</div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Current Position</div>
          {position && position.size !== 0 ? (
            <>
              <div className="card-row">
                <span className="card-label">Side</span>
                <span className={`card-value ${position.side === 'long' ? 'text-green' : 'text-red'}`}>
                  {position.side?.toUpperCase()}
                </span>
              </div>
              <div className="card-row">
                <span className="card-label">Size</span>
                <span className="card-value mono">{position.size}</span>
              </div>
              <div className="card-row">
                <span className="card-label">Entry Price</span>
                <span className="card-value mono">${position.entryPx?.toLocaleString()}</span>
              </div>
              <div className="card-row">
                <span className="card-label">Unrealized PnL</span>
                <span className={`card-value ${position.unrealizedPnl >= 0 ? 'text-green' : 'text-red'}`}>
                  ${position.unrealizedPnl?.toFixed(2)}
                </span>
              </div>
            </>
          ) : (
            <div className="text-muted" style={{ padding: '20px 0', textAlign: 'center' }}>No open position</div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Open Orders (TP/SL)</div>
          {position && position.orders?.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Type</th><th>Trigger</th><th>Size</th></tr></thead>
                <tbody>
                  {position.orders.map((o, i) => (
                    <tr key={i}>
                      <td><span className={o.type === 'sl' ? 'text-red' : 'text-green'}>{o.type?.toUpperCase()}</span></td>
                      <td className="mono">${o.triggerPx?.toLocaleString()}</td>
                      <td className="mono">{o.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-muted" style={{ padding: '20px 0', textAlign: 'center' }}>No open orders</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Bot Log</div>
        <div style={{ maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {logs.length > 0 ? logs.map((l, i) => <div key={i}>{l}</div>) : <div className="text-muted">Logs will appear here when the bot is running...</div>}
        </div>
      </div>
    </div>
  );
}
