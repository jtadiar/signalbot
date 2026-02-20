import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { startBot, stopBot, onBotEvent, isBotRunning } from '../lib/bot';

export default function Dashboard() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('stopped');
  const [position, setPosition] = useState(null);
  const [lastSignal, setLastSignal] = useState(null);
  const [dailyPnl, setDailyPnl] = useState(null);
  const [dailyFees, setDailyFees] = useState(0);
  const [lastError, setLastError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [starting, setStarting] = useState(false);
  const [healthSecs, setHealthSecs] = useState(null);
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [equity, setEquity] = useState(null);

  // Sync with actual bot state on mount
  useEffect(() => {
    isBotRunning().then(isRunning => {
      if (isRunning) {
        setRunning(true);
        setStatus('running');
      }
    });
  }, []);

  // Poll health every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [isRunning, secs, lastErr] = await invoke('get_health');
        setRunning(isRunning);
        if (isRunning) {
          setStatus('running');
          setHealthSecs(secs ?? null);
        }
        if (lastErr && !lastError) setLastError(lastErr);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [lastError]);

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
          if (event.fees !== undefined) setDailyFees(event.fees);
          break;
        case 'equity':
          setEquity(event.value);
          break;
        case 'halt':
          setStatus('halted');
          break;
        case 'error':
          setLastError(event.message);
          break;
        case 'log':
          setLogs(prev => [...prev.slice(-100), event.message]);
          break;
        default:
          break;
      }
    });
    return unsub;
  }, []);

  const handleStart = useCallback(async () => {
    setStarting(true);
    setLastError(null);
    const ok = await startBot();
    setStarting(false);
    if (ok) { setRunning(true); setStatus('running'); }
  }, []);

  const handleStop = useCallback(async () => {
    await stopBot();
    setRunning(false);
    setStatus('stopped');
  }, []);

  const handleRestart = useCallback(async () => {
    setStarting(true);
    setLastError(null);
    try {
      await invoke('restart_bot');
      setRunning(true);
      setStatus('running');
    } catch (e) {
      setLastError(typeof e === 'string' ? e : e?.message || 'Restart failed');
    }
    setStarting(false);
  }, []);

  const handleCloseTrade = useCallback(async () => {
    setClosing(true);
    setCloseResult(null);
    setLastError(null);
    try {
      const raw = await invoke('close_position');
      const result = JSON.parse(raw);
      if (result.ok && result.closed) {
        const pnl = Number(result.pnlUsd || 0);
        setCloseResult({
          pnl,
          exitPx: result.exitPx,
          side: result.side,
          won: pnl >= 0,
        });
        setPosition(null);
      } else if (result.ok && !result.closed) {
        setCloseResult({ noPosition: true });
      } else {
        setLastError(result.error || 'Close failed');
      }
    } catch (e) {
      setLastError(typeof e === 'string' ? e : e?.message || 'Close failed');
    }
    setClosing(false);
    setConfirmClose(false);
  }, []);

  const hasPosition = position && position.size !== 0;
  const statusClass = status === 'running' ? 'status-running' : status === 'halted' ? 'status-halted' : 'status-stopped';
  const statusLabel = status === 'running' ? 'Running' : status === 'halted' ? 'Halted' : 'Stopped';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-badge ${statusClass}`}>
            <span className="status-dot" />
            {statusLabel}
          </span>
          {running ? (
            <>
              <button className="btn btn-outline" onClick={handleRestart} disabled={starting}>
                {starting ? 'Restarting...' : 'Restart'}
              </button>
              <button className="btn btn-danger" onClick={handleStop}>Stop</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleStart} disabled={starting}>
              {starting ? 'Starting...' : 'Start Bot'}
            </button>
          )}
        </div>
      </div>

      {lastError && (
        <div className="card" style={{ borderColor: 'var(--red)', background: 'var(--red-bg)', marginBottom: 16 }}>
          <div style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>Error: {lastError}</div>
        </div>
      )}

      {closeResult && !closeResult.noPosition && (
        <div className="card" style={{ borderColor: closeResult.won ? 'var(--green)' : 'var(--red)', background: closeResult.won ? 'var(--green-bg)' : 'var(--red-bg)', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: closeResult.won ? 'var(--green)' : 'var(--red)' }}>
            Trade Closed — {closeResult.won ? 'WIN' : 'LOSS'}: {closeResult.pnl >= 0 ? '+' : ''}${closeResult.pnl?.toFixed(2)} @ ${closeResult.exitPx?.toLocaleString()}
          </div>
        </div>
      )}

      {confirmClose && (
        <div className="card" style={{ borderColor: 'var(--yellow)', background: 'rgba(255, 193, 7, 0.08)', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Close this trade at market price?</div>
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>This will immediately market-close your position and cancel all TP/SL orders.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger" onClick={handleCloseTrade} disabled={closing}>
              {closing ? 'Closing...' : 'Yes, Close Trade'}
            </button>
            <button className="btn btn-outline" onClick={() => setConfirmClose(false)} disabled={closing}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid-3">
        <div className="card">
          <div className="card-title">Daily PnL</div>
          <div className={`stat-big ${dailyPnl > 0 ? 'text-green' : dailyPnl < 0 ? 'text-red' : ''}`}>
            {dailyPnl !== null ? `${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toFixed(2)}` : '--'}
          </div>
          {dailyFees > 0 && (
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Fees paid today: -${dailyFees.toFixed(2)}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Health</div>
          <div className="stat-big">{statusLabel}</div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            {running && healthSecs !== null
              ? `Last heartbeat: ${healthSecs}s ago`
              : running ? 'Waiting for heartbeat...' : 'Bot is stopped'}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Equity</div>
          <div className="stat-big">
            {equity !== null ? `$${equity.toFixed(2)}` : '--'}
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Live HL balance
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Current Position</div>
            {hasPosition && !confirmClose && (
              <button
                className="btn btn-danger"
                style={{ padding: '4px 12px', fontSize: 12 }}
                onClick={() => { setCloseResult(null); setConfirmClose(true); }}
                disabled={closing}
              >
                Close Trade
              </button>
            )}
          </div>
          {hasPosition ? (
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
              {position.marginUsed > 0 && (
                <div className="card-row">
                  <span className="card-label">Margin</span>
                  <span className="card-value mono">${position.marginUsed.toFixed(2)}</span>
                </div>
              )}
              <div className="card-row">
                <span className="card-label">Unrealized PnL</span>
                <span className={`card-value ${position.unrealizedPnl >= 0 ? 'text-green' : 'text-red'}`}>
                  ${position.unrealizedPnl?.toFixed(2)}
                </span>
              </div>
              {position.fees > 0 && (
                <div className="card-row" style={{ opacity: 0.7, fontSize: 13 }}>
                  <span className="card-label">Fees (open + close)</span>
                  <span className="card-value text-red">-${position.fees.toFixed(2)}</span>
                </div>
              )}
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
        <div className="card-title">Bot Activity</div>
        {running && !hasPosition ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
            <div className="scan-ring" />
            <div style={{ marginTop: 16, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              Scanning for entry...
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              Analysing EMA/ATR signals on BTC-PERP every {Math.round((position?.pollMs || 20000) / 1000)}s
            </div>
            {lastSignal && (
              <div style={{ marginTop: 12, fontSize: 12, padding: '6px 12px', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                Last signal: <span className={lastSignal.side === 'long' ? 'text-green' : 'text-red'} style={{ fontWeight: 600 }}>{lastSignal.side?.toUpperCase()}</span>
                <span className="text-muted"> — {lastSignal.reason?.slice(0, 60)}</span>
              </div>
            )}
          </div>
        ) : running && hasPosition ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
            <div className="pulse-dot-active" />
            <div style={{ marginTop: 16, fontSize: 14, fontWeight: 500, color: 'var(--green)' }}>
              Managing open position
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
              Monitoring TP/SL triggers and trailing stop
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--text-muted)' }} />
            </div>
            <div className="text-muted" style={{ marginTop: 16, fontSize: 14 }}>
              Bot is stopped
            </div>
          </div>
        )}

        {logs.length > 0 && (
          <details style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <summary className="text-muted" style={{ fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
              Logs ({logs.length})
            </summary>
            <div style={{ maxHeight: 160, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: 8 }}>
              {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
