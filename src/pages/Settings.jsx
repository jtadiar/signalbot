import { useState, useEffect } from 'react';
import { readConfig, writeConfig } from '../lib/config';

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    const cfg = await readConfig();
    if (cfg) {
      setConfig(cfg);
    } else {
      try {
        const stored = localStorage.getItem('bot_config');
        if (stored) setConfig(JSON.parse(stored));
      } catch {}
    }
    setLoading(false);
  }

  function update(path, value) {
    setSaved(false);
    setConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  }

  async function handleSave() {
    setError('');
    try {
      await writeConfig(config);
      localStorage.setItem('bot_config', JSON.stringify(config));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e?.message || 'Failed to save.');
    }
  }

  function handleReset() {
    localStorage.removeItem('license_key');
    localStorage.removeItem('configured');
    localStorage.removeItem('bot_config');
    window.location.reload();
  }

  if (loading) return <div className="text-muted">Loading...</div>;
  if (!config) return <div className="text-muted">No configuration found. Run setup first.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Settings</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {saved && <span className="success-msg">Saved!</span>}
          {error && <span className="error-msg">{error}</span>}
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Signal Parameters</div>
          <div className="form-group">
            <label className="form-label">Poll interval (ms)</label>
            <input className="form-input" type="number" value={config.signal?.pollMs || 20000} onChange={e => update('signal.pollMs', Number(e.target.value))} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">EMA trend period (1h)</label>
              <input className="form-input" type="number" value={config.signal?.emaTrendPeriod || 50} onChange={e => update('signal.emaTrendPeriod', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">EMA trigger period (15m)</label>
              <input className="form-input" type="number" value={config.signal?.emaTriggerPeriod || 20} onChange={e => update('signal.emaTriggerPeriod', Number(e.target.value))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">ATR period</label>
              <input className="form-input" type="number" value={config.signal?.atrPeriod || 14} onChange={e => update('signal.atrPeriod', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">ATR multiplier</label>
              <input className="form-input" type="number" step="0.1" value={config.signal?.atrMult || 1.5} onChange={e => update('signal.atrMult', Number(e.target.value))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Max stop %</label>
            <input className="form-input" type="number" step="0.001" value={config.signal?.maxStopPct || 0.035} onChange={e => update('signal.maxStopPct', Number(e.target.value))} />
            <div className="form-hint">e.g. 0.035 = 3.5%</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Risk Management</div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Max leverage</label>
              <input className="form-input" type="number" value={config.risk?.maxLeverage || 10} onChange={e => update('risk.maxLeverage', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Max daily loss (USD)</label>
              <input className="form-input" type="number" value={config.risk?.maxDailyLossUsd || 200} onChange={e => update('risk.maxDailyLossUsd', Number(e.target.value))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Risk per trade %</label>
              <input className="form-input" type="number" step="0.01" value={config.risk?.riskPerTradePct || 0.03} onChange={e => update('risk.riskPerTradePct', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Margin use %</label>
              <input className="form-input" type="number" step="0.05" value={config.risk?.marginUsePct || 0.75} onChange={e => update('risk.marginUsePct', Number(e.target.value))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Reentry cooldown (sec)</label>
              <input className="form-input" type="number" value={config.risk?.reentryCooldownSeconds || 300} onChange={e => update('risk.reentryCooldownSeconds', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Loss cooldown (min)</label>
              <input className="form-input" type="number" value={config.risk?.lossCooldownMinutes || 15} onChange={e => update('risk.lossCooldownMinutes', Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Take-Profit / Stop-Loss</div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Stop-loss cap %</label>
            <input className="form-input" type="number" step="0.01" value={config.exits?.stopLossPct || 0.10} onChange={e => update('exits.stopLossPct', Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label className="form-label">Max margin loss %</label>
            <input className="form-input" type="number" step="0.01" value={config.exits?.maxMarginLossPct || 0.03} onChange={e => update('exits.maxMarginLossPct', Number(e.target.value))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">TP ladder</label>
          <div className="info-box" style={{ marginBottom: 0 }}>
            {(config.exits?.tp || []).map((tp, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                TP{i + 1}: {tp.rMultiple}R &mdash; close {Math.round(tp.closeFrac * 100)}%
              </div>
            ))}
          </div>
          <div className="form-hint">Edit config.json directly for advanced TP ladder changes.</div>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={config.exits?.trailToBreakevenOnTp1 ?? true} onChange={e => update('exits.trailToBreakevenOnTp1', e.target.checked)} />
            <span>Trail stop to breakeven after TP1</span>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Danger Zone</div>
        <button className="btn btn-outline" onClick={handleReset}>Reset All Settings &amp; Re-run Setup</button>
        <div className="form-hint" style={{ marginTop: 8 }}>This clears your local configuration. Your license key, private key files, and Telegram tokens on disk are not deleted.</div>
      </div>
    </div>
  );
}
