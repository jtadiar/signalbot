import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { readConfig, writeConfig } from '../lib/config';

export default function Settings() {
  const [tab, setTab] = useState('configure');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Telegram state
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgToken, setTgToken] = useState('');
  const [tgChat, setTgChat] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [tgSaving, setTgSaving] = useState(false);
  const [tgSaved, setTgSaved] = useState(false);
  const [tgError, setTgError] = useState('');
  const [tgTestMsg, setTgTestMsg] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const cfg = await readConfig();
    if (cfg) {
      setConfig(cfg);
      // Hydrate telegram fields
      if (cfg.telegram) {
        setTgEnabled(cfg.telegram.enabled === true || String(cfg.telegram.enabled) === 'true');
        setTgChat(cfg.telegram.channel || '');
      }
    } else {
      try {
        const stored = localStorage.getItem('bot_config');
        if (stored) {
          const parsed = JSON.parse(stored);
          setConfig(parsed);
          if (parsed.telegram) {
            setTgEnabled(parsed.telegram.enabled === true);
            setTgChat(parsed.telegram.channel || '');
          }
        }
      } catch {}
    }
    // Try to read the saved token file
    try {
      const storedToken = await invoke('read_bot_file', { filename: 'tg_token' });
      if (storedToken && storedToken.trim()) setTgToken(storedToken.trim());
    } catch {}
    // Fallback: read chat from .env if not in config
    try {
      const envContents = await invoke('read_bot_file', { filename: '.env' });
      for (const line of envContents.split('\n')) {
        if (line.startsWith('TG_CHAT=') && !tgChat) setTgChat(line.split('=')[1]?.trim());
      }
    } catch {}
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

  const [showRestartNotice, setShowRestartNotice] = useState(false);

  async function handleSaveConfig() {
    setError('');
    try {
      await writeConfig(config);
      localStorage.setItem('bot_config', JSON.stringify(config));
      setSaved(true);
      setShowRestartNotice(true);
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

  async function handleTgTest() {
    if (!tgToken.trim() || !tgChat.trim()) {
      setTgTestMsg('Enter both token and chat ID first.');
      return;
    }
    setTgTestMsg('Sending...');
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgToken.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat.trim(), text: 'HL Signalbot: test ping', disable_web_page_preview: true }),
      });
      const data = await res.json();
      setTgTestMsg(data.ok ? 'Message sent! Check your Telegram.' : `Error: ${data.description || 'unknown'}`);
    } catch (e) {
      setTgTestMsg(`Failed: ${e?.message || e}`);
    }
  }

  async function handleTgSave() {
    setTgSaving(true);
    setTgError('');
    setTgSaved(false);
    try {
      const configDir = await invoke('get_config_dir');
      const tgTokenPath = `${configDir}/tg_token`;

      const cfg = await readConfig();
      if (!cfg.telegram) cfg.telegram = {};
      cfg.telegram.enabled = tgEnabled;
      cfg.telegram.channel = tgChat.trim() || '@your_channel';
      cfg.telegram.tokenPath = tgTokenPath;
      await writeConfig(cfg);
      setConfig(cfg);

      if (tgToken.trim()) {
        await invoke('write_secret_file', { path: tgTokenPath, contents: tgToken.trim() + '\n' });
      }

      try {
        const envContents = await invoke('read_bot_file', { filename: '.env' });
        const lines = envContents.split('\n');
        const filtered = lines.filter(l =>
          !l.startsWith('TG_ENABLED=') &&
          !l.startsWith('TG_CHAT=') &&
          !l.startsWith('TG_TOKEN_PATH=') &&
          !l.startsWith('TG_TOKEN=')
        );
        filtered.push('', `TG_ENABLED=${tgEnabled}`);
        if (tgEnabled && tgChat.trim()) filtered.push(`TG_CHAT=${tgChat.trim()}`);
        if (tgEnabled) filtered.push(`TG_TOKEN_PATH=${tgTokenPath}`);
        filtered.push('');
        await invoke('write_bot_file', { filename: '.env', contents: filtered.join('\n') });
      } catch {}

      localStorage.setItem('bot_config', JSON.stringify(cfg));
      setTgSaved(true);
      setTimeout(() => setTgSaved(false), 3000);
    } catch (e) {
      setTgError(e?.message || 'Failed to save.');
    }
    setTgSaving(false);
  }

  function maskToken(t) {
    if (!t || t.length < 12) return t;
    return t.slice(0, 6) + '••••••' + t.slice(-4);
  }

  if (loading) return <div className="text-muted">Loading...</div>;
  if (!config) return <div className="text-muted">No configuration found. Run setup first.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Settings</h1>
      </div>

      {/* Sub-tabs */}
      <div className="settings-tabs" style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <button
          className={`settings-tab ${tab === 'configure' ? 'active' : ''}`}
          onClick={() => setTab('configure')}
          style={{
            padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', borderBottom: tab === 'configure' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'configure' ? 'var(--accent)' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
        >
          Configure
        </button>
        <button
          className={`settings-tab ${tab === 'telegram' ? 'active' : ''}`}
          onClick={() => setTab('telegram')}
          style={{
            padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', borderBottom: tab === 'telegram' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'telegram' ? 'var(--accent)' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
        >
          Telegram
        </button>
      </div>

      {/* Configure tab */}
      <div style={{ display: tab === 'configure' ? 'block' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
          {saved && <span className="success-msg">Saved!</span>}
          {error && <span className="error-msg">{error}</span>}
          <button className="btn btn-primary" onClick={handleSaveConfig}>Save Changes</button>
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
              <input className="form-input" type="number" step="0.1" min="0.1" max="20" value={Math.round((config.signal?.maxStopPct || 0.035) * 1000) / 10} onChange={e => update('signal.maxStopPct', Number(e.target.value) / 100)} />
              <div className="form-hint">Reject signals with stop distance above this (e.g. 3.5 = 3.5%)</div>
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
                <input className="form-input" type="number" step="0.5" min="0.5" max="100" value={Math.round((config.risk?.riskPerTradePct || 0.03) * 1000) / 10} onChange={e => update('risk.riskPerTradePct', Number(e.target.value) / 100)} />
                <div className="form-hint">% of equity risked per trade (e.g. 3 = 3%)</div>
              </div>
              <div className="form-group">
                <label className="form-label">Margin use %</label>
                <input className="form-input" type="number" step="1" min="1" max="100" value={Math.round((config.risk?.marginUsePct || 0.75) * 100)} onChange={e => update('risk.marginUsePct', Number(e.target.value) / 100)} />
                <div className="form-hint">How much of your equity to use (1–100%)</div>
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
              <input className="form-input" type="number" step="0.5" min="0.5" max="50" value={Math.round((config.exits?.stopLossPct || 0.10) * 1000) / 10} onChange={e => update('exits.stopLossPct', Number(e.target.value) / 100)} />
              <div className="form-hint">Max stop distance from entry (e.g. 10 = 10%)</div>
            </div>
            <div className="form-group">
              <label className="form-label">Max margin loss %</label>
              <input className="form-input" type="number" step="0.5" min="0.5" max="100" value={Math.round((config.exits?.maxMarginLossPct || 0.03) * 1000) / 10} onChange={e => update('exits.maxMarginLossPct', Number(e.target.value) / 100)} />
              <div className="form-hint">Max loss as % of margin used (e.g. 3 = 3%)</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Take-Profit Levels</label>
            {(config.exits?.tp || []).map((tp, i) => (
              <div key={i} className="grid-2" style={{ marginBottom: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>TP{i + 1} distance (%)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    value={tp.pct ? (tp.pct * 100) : (tp.rMultiple || 0)}
                    onChange={e => {
                      const val = Number(e.target.value);
                      const next = JSON.parse(JSON.stringify(config));
                      next.exits.tp[i] = { pct: val / 100, closeFrac: tp.closeFrac };
                      delete next.exits.tp[i].rMultiple;
                      setConfig(next);
                      setSaved(false);
                    }}
                  />
                  <div className="form-hint">{tp.pct ? `${(tp.pct * 100).toFixed(1)}% from entry` : `${tp.rMultiple}R (legacy)`}</div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>TP{i + 1} close size (%)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="5"
                    value={Math.round((tp.closeFrac || 0) * 100)}
                    onChange={e => {
                      const val = Number(e.target.value) / 100;
                      const next = JSON.parse(JSON.stringify(config));
                      next.exits.tp[i].closeFrac = val;
                      setConfig(next);
                      setSaved(false);
                    }}
                  />
                  <div className="form-hint">Close {Math.round((tp.closeFrac || 0) * 100)}% of position</div>
                </div>
              </div>
            ))}
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

      {/* Telegram tab */}
      <div style={{ display: tab === 'telegram' ? 'block' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
          {tgSaved && <span className="success-msg">Saved!</span>}
          {tgError && <span className="error-msg">{tgError}</span>}
          <button className="btn btn-primary" onClick={handleTgSave} disabled={tgSaving}>
            {tgSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: tgEnabled && tgToken ? 'var(--green)' : 'var(--text-muted)',
            }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {tgEnabled && tgToken ? 'Telegram pings enabled' : 'Telegram pings disabled'}
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={tgEnabled} onChange={e => setTgEnabled(e.target.checked)} />
              <span>Enable Telegram notifications</span>
            </label>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Setup Guide</div>
          <div className="info-box">
            <div style={{ lineHeight: 1.8 }}>
              <strong>Step 1:</strong> Open Telegram and search for <strong>@BotFather</strong><br />
              <strong>Step 2:</strong> Send <strong>/newbot</strong> and follow the prompts to name your bot<br />
              <strong>Step 3:</strong> BotFather will give you a <strong>bot token</strong> — copy it below<br />
              <strong>Step 4:</strong> Create a Telegram channel or group for notifications<br />
              <strong>Step 5:</strong> Add your bot as an <strong>admin</strong> to that channel/group<br />
              <strong>Step 6:</strong> Enter the channel <strong>@username</strong> (e.g. @my_signals) or <strong>chat ID</strong> below
            </div>
          </div>
          <div className="form-hint" style={{ marginTop: 8 }}>
            To find your chat ID: send a message in the channel, then visit<br />
            <code style={{ fontSize: 11 }}>https://api.telegram.org/bot{'<'}YOUR_TOKEN{'>'}/getUpdates</code>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Credentials</div>
          <div className="form-group">
            <label className="form-label">Bot Token</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input mono"
                type={showToken ? 'text' : 'password'}
                placeholder="123456789:AAHdqTc..."
                value={tgToken}
                onChange={e => setTgToken(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-outline"
                style={{ whiteSpace: 'nowrap', padding: '0 12px' }}
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            {tgToken && !showToken && (
              <div className="form-hint" style={{ marginTop: 4 }}>
                Current: {maskToken(tgToken)}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Channel @username or Chat ID</label>
            <input
              className="form-input"
              placeholder="@my_channel or -100123456789"
              value={tgChat}
              onChange={e => setTgChat(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-outline" onClick={handleTgTest} disabled={!tgToken || !tgChat}>
              Send Test Message
            </button>
            {tgTestMsg && (
              <span className={tgTestMsg.includes('sent') ? 'success-msg' : 'warning-msg'} style={{ alignSelf: 'center', fontSize: 13 }}>
                {tgTestMsg}
              </span>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">What you'll receive</div>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            <div><span style={{ fontWeight: 600, color: 'var(--green)' }}>OPEN</span> — When the bot enters a new position (side, size, entry price, SL/TP levels)</div>
            <div><span style={{ fontWeight: 600, color: 'var(--green)' }}>TP/CLOSE</span> — When a take-profit triggers (exit price, net PnL)</div>
            <div><span style={{ fontWeight: 600, color: 'var(--red)' }}>STOP/LOSS</span> — When the stop-loss triggers (exit price, net PnL)</div>
          </div>
        </div>
      </div>

      {showRestartNotice && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowRestartNotice(false)}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '32px 40px', maxWidth: 400, textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>&#x26A0;&#xFE0F;</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Settings Saved</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Restart the bot for your changes to take effect.
            </p>
            <button className="btn btn-primary" onClick={() => setShowRestartNotice(false)} style={{ minWidth: 120 }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
