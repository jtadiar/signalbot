import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { readConfig, writeConfig } from '../lib/config';

function Tip({ text }) {
  return (
    <span className="tip-wrap">
      <span className="tip-icon">?</span>
      <span className="tip-popup">{text}</span>
    </span>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('configure');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
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
    setHasEdits(true);
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
      setHasEdits(false);
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
      <div style={{ marginBottom: 20 }}>
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
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          marginBottom: 20, padding: 12, borderRadius: 8,
          background: hasEdits ? 'rgba(255, 107, 0, 0.06)' : 'transparent',
          border: hasEdits ? '1px solid rgba(255, 107, 0, 0.15)' : '1px solid transparent',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {saved ? 'Changes saved.' : hasEdits ? 'You have unsaved changes.' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && <span className="success-msg">Saved!</span>}
            {error && <span className="error-msg">{error}</span>}
            <button className="btn btn-primary" onClick={handleSaveConfig}>Save Changes</button>
          </div>
        </div>

        {/* Risk Meter */}
        {(() => {
          const leverage = Number(config.risk?.maxLeverage || 10);
          const riskPct = Number(config.risk?.riskPerTradePct || 0.03) * 100;
          const marginUse = Number(config.risk?.marginUsePct || 0.75) * 100;
          const reentryCooldown = Number(config.risk?.reentryCooldownSeconds || 300);
          const lossCooldown = Number(config.risk?.lossCooldownMinutes || 15);
          const trendMode = String(config.signal?.trendMode ?? 'both').toLowerCase();
          const candleClose = String(config.signal?.entryOnCandleClose ?? true).toLowerCase() !== 'false';
          const blockGreen = String(config.signal?.blockShortIfGreenCandle ?? true).toLowerCase() !== 'false';
          const stochEnabled = config.signal?.stochFilter?.enabled !== false;
          const confirmCandles = Number(config.signal?.confirmCandles ?? 1);
          const emaTrendBreak = String(config.exits?.emaTrendBreakExit?.enabled ?? false).toLowerCase() !== 'false';

          let score = 0;
          // Leverage: 1-3 = 0, 4-7 = 1, 8-12 = 2, 13+ = 3
          if (leverage <= 3) score += 0; else if (leverage <= 7) score += 1; else if (leverage <= 12) score += 2; else score += 3;
          // Risk per trade: 1% = 0, 2-3% = 1, 4-5% = 2, 6%+ = 3
          if (riskPct <= 1) score += 0; else if (riskPct <= 3) score += 1; else if (riskPct <= 5) score += 2; else score += 3;
          // Margin use: 25% = 0, 50% = 1, 75% = 2, 100% = 3
          if (marginUse <= 30) score += 0; else if (marginUse <= 55) score += 1; else if (marginUse <= 80) score += 2; else score += 3;
          // Cooldowns: long = safe, short = risky
          if (reentryCooldown >= 600) score += 0; else if (reentryCooldown >= 300) score += 0.5; else score += 1;
          if (lossCooldown >= 30) score += 0; else if (lossCooldown >= 15) score += 0.5; else score += 1;
          // Filters off = riskier
          if (trendMode === 'both') score += 1;
          if (!candleClose) score += 1;
          if (!blockGreen) score += 0.5;
          if (!stochEnabled) score += 1;
          if (confirmCandles < 2) score += 0.5;
          if (!emaTrendBreak) score += 0.5;

          // Max possible ~18, map to 4 levels
          let level, label, sublabel, color;
          if (score <= 5) { level = 0; label = 'Conservative'; sublabel = 'Fewer trades, tighter risk, capital preservation'; color = '#22c55e'; }
          else if (score <= 9) { level = 1; label = 'Moderate'; sublabel = 'Balanced risk and reward'; color = '#eab308'; }
          else if (score <= 13) { level = 2; label = 'Aggressive'; sublabel = 'Higher exposure, more frequent trades'; color = '#f97316'; }
          else { level = 3; label = 'High Risk'; sublabel = 'Maximum exposure, minimal filters'; color = '#ef4444'; }

          return (
            <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Risk Level</span>
                <span style={{ fontSize: 14, fontWeight: 700, color, fontStyle: 'italic' }}>{label}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 8, borderRadius: 4,
                    background: i <= level
                      ? (i === 0 ? '#22c55e' : i === 1 ? '#eab308' : i === 2 ? '#f97316' : '#ef4444')
                      : 'var(--bg-input)',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sublabel}</div>
            </div>
          );
        })()}

        <div className="grid-2">
          <div className="card">
            <div className="card-title">Signal Parameters</div>
            <div className="form-group">
              <label className="form-label">Poll interval (ms) <Tip text="How often the bot checks for new signals. Lower = faster reaction but more API calls. Default 20000ms (20s)." /></label>
              <input className="form-input" type="number" value={config.signal?.pollMs || 20000} onChange={e => update('signal.pollMs', Number(e.target.value))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">EMA trend period (1h) <Tip text="EMA period on the 1-hour chart. Determines the trend direction (long vs short). Lower = faster trend flips, higher = smoother." /></label>
                <input className="form-input" type="number" value={config.signal?.emaTrendPeriod || 50} onChange={e => update('signal.emaTrendPeriod', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">EMA trigger period (15m) <Tip text="EMA period on the 15-min chart. Used for pullback/reclaim entries. Lower = more sensitive, earlier entries." /></label>
                <input className="form-input" type="number" value={config.signal?.emaTriggerPeriod || 20} onChange={e => update('signal.emaTriggerPeriod', Number(e.target.value))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">ATR period <Tip text="Lookback period for Average True Range on the 15m chart. Used to size stops and filter low-volatility entries." /></label>
                <input className="form-input" type="number" value={config.signal?.atrPeriod || 14} onChange={e => update('signal.atrPeriod', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">ATR multiplier <Tip text="Stop distance = ATR × this multiplier. Higher = wider stops (more room, larger risk per trade). Lower = tighter stops." /></label>
                <input className="form-input" type="number" step="0.1" value={config.signal?.atrMult || 1.5} onChange={e => update('signal.atrMult', Number(e.target.value))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Max stop % <Tip text="If ATR suggests a stop wider than this, the signal is rejected. Prevents entries in extremely volatile conditions." /></label>
              <input className="form-input" type="number" step="0.1" min="0.1" max="20" value={Math.round((config.signal?.maxStopPct || 0.035) * 1000) / 10} onChange={e => update('signal.maxStopPct', Number(e.target.value) / 100)} />
              <div className="form-hint">Reject signals with stop distance above this (e.g. 3.5 = 3.5%)</div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
              <label className="form-label" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 12 }}>Signal Filters</label>

              <div className="form-group">
                <label className="form-label">Max EMA distance % <Tip text="Skip signals when price is too far from the 1h EMA. Prevents entering late in extended moves that are likely to reverse. 0 = disabled. 2 = reject if price is >2% from EMA." /></label>
                <input className="form-input" type="number" step="0.5" min="0" max="10" value={Math.round((config.signal?.maxEmaDistPct ?? 0.02) * 10000) / 100} onChange={e => update('signal.maxEmaDistPct', Number(e.target.value) / 100)} />
                <div className="form-hint">{(config.signal?.maxEmaDistPct ?? 0.02) > 0 ? `Skip if price is >${((config.signal?.maxEmaDistPct ?? 0.02) * 100).toFixed(1)}% from 1h EMA` : 'Disabled (0)'}</div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={config.signal?.stochFilter?.enabled !== false}
                    onChange={e => {
                      const sf = config.signal?.stochFilter || {};
                      update('signal.stochFilter', { overbought: sf.overbought ?? 80, oversold: sf.oversold ?? 20, enabled: e.target.checked });
                    }}
                  />
                  <span>Stochastic RSI filter <Tip text="Filters out entries when momentum is exhausted. Skips shorts when Stoch RSI is oversold (bounce likely) and longs when overbought (pullback likely)." /></span>
                </label>
                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Overbought level</label>
                    <input className="form-input" type="number" min="50" max="100" value={config.signal?.stochFilter?.overbought ?? 80} onChange={e => {
                      const sf = config.signal?.stochFilter || {};
                      update('signal.stochFilter', { enabled: sf.enabled !== false, oversold: sf.oversold ?? 20, overbought: Number(e.target.value) });
                    }} />
                    <div className="form-hint">Skip longs above this (default 80)</div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Oversold level</label>
                    <input className="form-input" type="number" min="0" max="50" value={config.signal?.stochFilter?.oversold ?? 20} onChange={e => {
                      const sf = config.signal?.stochFilter || {};
                      update('signal.stochFilter', { enabled: sf.enabled !== false, overbought: sf.overbought ?? 80, oversold: Number(e.target.value) });
                    }} />
                    <div className="form-hint">Skip shorts below this (default 20)</div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm candles <Tip text="How many consecutive 15m candles must be on the wrong side of EMA20 before a reclaim counts. 1 = default (single candle). 2 = stricter (filters fakeouts but enters later)." /></label>
                <input className="form-input" type="number" min="1" max="3" value={config.signal?.confirmCandles ?? 1} onChange={e => update('signal.confirmCandles', Number(e.target.value))} />
                <div className="form-hint">{(config.signal?.confirmCandles ?? 1) >= 2 ? `Require ${config.signal.confirmCandles} candles on wrong side before reclaim` : 'Single candle reclaim (default)'}</div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                <label className="form-label" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 12 }}>Entry Guards</label>

                <div className="form-group">
                  <label className="form-label">Trend mode <Tip text="Controls which trade directions are allowed based on the 1h EMA trend. 'Both' = current behavior. 'With trend only' = only longs in bullish, only shorts in bearish. 'Block countertrend shorts' = prevents shorting when trend is bullish (longs unaffected)." /></label>
                  <select
                    className="form-input"
                    value={config.signal?.trendMode ?? 'both'}
                    onChange={e => update('signal.trendMode', e.target.value)}
                  >
                    <option value="both">Both directions</option>
                    <option value="withTrendOnly">With trend only</option>
                    <option value="disableCountertrendShorts">Block countertrend shorts</option>
                  </select>
                  <div className="form-hint">
                    {(config.signal?.trendMode ?? 'both') === 'both' ? 'Trades both directions regardless of trend' : (config.signal?.trendMode ?? '') === 'withTrendOnly' ? 'Only longs in bullish trend, only shorts in bearish' : 'Shorts blocked when trend is bullish — longs always allowed'}
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={String(config.signal?.entryOnCandleClose ?? true).toLowerCase() !== 'false'}
                    onChange={e => update('signal.entryOnCandleClose', e.target.checked)}
                  />
                  <span>Enter on candle close <Tip text="Only enter trades after the 15m candle closes. Prevents entries based on incomplete candle signals that may reverse before close. Recommended: on." /></span>
                </label>
                <div className="form-hint" style={{ marginLeft: 24, marginBottom: 12 }}>Wait for the 15m candle to close before acting on the signal.</div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={String(config.signal?.blockShortIfGreenCandle ?? true).toLowerCase() !== 'false'}
                    onChange={e => update('signal.blockShortIfGreenCandle', e.target.checked)}
                  />
                  <span>Block shorts if trigger candle is green <Tip text="Skip short entries if the 15m trigger candle closed green (close > open). Prevents shorting into bullish momentum candles." /></span>
                </label>
                <div className="form-hint" style={{ marginLeft: 24 }}>Avoid shorting when the last 15m candle closed higher than it opened.</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Risk Management</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Max leverage <Tip text="Maximum cross leverage the bot will use on Hyperliquid. Higher leverage = larger positions relative to margin." /></label>
                <input className="form-input" type="number" value={config.risk?.maxLeverage || 10} onChange={e => update('risk.maxLeverage', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Max daily loss (USD) <Tip text="Bot halts for the day if cumulative losses exceed this amount. Protects against bad streaks." /></label>
                <input className="form-input" type="number" value={config.risk?.maxDailyLossUsd || 200} onChange={e => update('risk.maxDailyLossUsd', Number(e.target.value))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Risk per trade % <Tip text="% of your total account equity risked per trade. Used to calculate position size: size = (equity × risk%) / stop distance." /></label>
                <input className="form-input" type="number" step="0.5" min="0.5" max="100" value={Math.round((config.risk?.riskPerTradePct || 0.03) * 1000) / 10} onChange={e => update('risk.riskPerTradePct', Number(e.target.value) / 100)} />
                <div className="form-hint">% of equity risked per trade (e.g. 3 = 3%)</div>
              </div>
              <div className="form-group">
                <label className="form-label">Margin use % <Tip text="Max fraction of equity used as margin. 100% = use all equity. Lower values leave a buffer for drawdowns." /></label>
                <input className="form-input" type="number" step="1" min="1" max="100" value={Math.round((config.risk?.marginUsePct || 0.75) * 100)} onChange={e => update('risk.marginUsePct', Number(e.target.value) / 100)} />
                <div className="form-hint">How much of your equity to use (1–100%)</div>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Reentry cooldown (sec) <Tip text="Wait time after closing a position before entering a new trade. Prevents rapid re-entries on choppy signals." /></label>
                <input className="form-input" type="number" value={config.risk?.reentryCooldownSeconds || 300} onChange={e => update('risk.reentryCooldownSeconds', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Loss cooldown (min) <Tip text="Extra cooldown after a losing trade. Prevents revenge trading by forcing a pause before the next entry." /></label>
                <input className="form-input" type="number" value={config.risk?.lossCooldownMinutes || 15} onChange={e => update('risk.lossCooldownMinutes', Number(e.target.value))} />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Take-Profit / Stop-Loss</div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Stop-loss cap % <Tip text="Hard cap on how far the stop can be from entry as a % of price. Acts as a maximum stop distance regardless of ATR." /></label>
              <input className="form-input" type="number" step="0.5" min="0.5" max="50" value={Math.round((config.exits?.stopLossPct || 0.10) * 1000) / 10} onChange={e => update('exits.stopLossPct', Number(e.target.value) / 100)} />
              <div className="form-hint">Max stop distance from entry (e.g. 10 = 10%)</div>
            </div>
            <div className="form-group">
              <label className="form-label">Max margin loss % <Tip text="Max loss as a % of margin used (not account equity). Caps stop width relative to leverage. E.g. 3% with 10x leverage = stop at most 0.3% from entry." /></label>
              <input className="form-input" type="number" step="0.5" min="0.5" max="100" value={Math.round((config.exits?.maxMarginLossPct || 0.03) * 1000) / 10} onChange={e => update('exits.maxMarginLossPct', Number(e.target.value) / 100)} />
              <div className="form-hint">Max loss as % of margin used (e.g. 3 = 3%)</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Take-Profit Levels <Tip text="Define up to 2 TP targets. Each closes a % of your position at a set distance from entry. The remainder is the runner." /></label>
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
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={config.exits?.trailStopToTp1OnTp2 ?? true} onChange={e => update('exits.trailStopToTp1OnTp2', e.target.checked)} />
              <span>Trail stop to TP1 price after TP2</span>
            </label>
            <div className="form-hint">After TP2 fills, move SL up to the TP1 price (protects more profit)</div>
          </div>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Runner (remaining 50% after TP1/TP2)</label>
            <p className="form-hint" style={{ marginBottom: 12 }}>
              The runner exits when either (1) price hits the stop, or (2) signal reversal (if enabled below). They work together — whichever triggers first.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={String(config.exits?.trailingAfterTp2?.enabled ?? true).toLowerCase() !== 'false'}
                onChange={e => {
                  const tr = config.exits?.trailingAfterTp2 || {};
                  update('exits.trailingAfterTp2', { kind: tr.kind || 'pct', trailPct: tr.trailPct ?? 0.005, minUpdateSeconds: tr.minUpdateSeconds ?? 20, enabled: e.target.checked });
                }}
              />
              <span>Trailing stop</span>
            </label>
            <div className="form-hint" style={{ marginLeft: 24, marginBottom: 8 }}>
              When on: stop trails price (e.g. 0.5% behind). When off: stop stays at TP1 price.
            </div>
            <div className="grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Trail distance (%) <Tip text="How far behind price the trailing stop sits. 0.5% = tight (captures profit quickly, may stop on bounces). 1%+ = loose (more room to run)." /></label>
                <input
                  className="form-input"
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="5"
                  value={Math.round((config.exits?.trailingAfterTp2?.trailPct ?? 0.005) * 10000) / 100}
                  onChange={e => {
                    const tr = config.exits?.trailingAfterTp2 || {};
                    update('exits.trailingAfterTp2', { kind: tr.kind || 'pct', enabled: String(tr.enabled ?? true).toLowerCase() !== 'false', trailPct: Number(e.target.value) / 100, minUpdateSeconds: tr.minUpdateSeconds ?? 20 });
                  }}
                />
                <div className="form-hint">0.5% = tight, 1% = loose</div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Min update interval (sec) <Tip text="Minimum seconds between trailing stop updates. Prevents excessive API calls to Hyperliquid." /></label>
                <input
                  className="form-input"
                  type="number"
                  min="5"
                  max="120"
                  value={config.exits?.trailingAfterTp2?.minUpdateSeconds ?? 20}
                  onChange={e => {
                    const tr = config.exits?.trailingAfterTp2 || {};
                    update('exits.trailingAfterTp2', { kind: tr.kind || 'pct', enabled: String(tr.enabled ?? true).toLowerCase() !== 'false', trailPct: tr.trailPct ?? 0.005, minUpdateSeconds: Number(e.target.value) });
                  }}
                />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}>
              <input
                type="checkbox"
                checked={String(config.exits?.runnerExit || '').toLowerCase() === 'signal'}
                onChange={e => update('exits.runnerExit', e.target.checked ? 'signal' : '')}
              />
              <span>Exit on signal reversal</span>
            </label>
            <div className="form-hint" style={{ marginLeft: 24 }}>
              When on: close runner when trend flips (e.g. short → long). When off: runner only exits via stop.
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">EMA Trend-Break Exit</div>
          <p className="form-hint" style={{ marginBottom: 12 }}>
            Close the entire position early if price breaks the trigger EMA — catches reversals before the hard stop is hit.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={String(config.exits?.emaTrendBreakExit?.enabled ?? false).toLowerCase() !== 'false'}
              onChange={e => {
                const tbe = config.exits?.emaTrendBreakExit || {};
                update('exits.emaTrendBreakExit', { confirmCandles: tbe.confirmCandles ?? 1, enabled: e.target.checked });
              }}
            />
            <span>Enable trend-break exit</span>
            <Tip text="When enabled, the bot closes your position if the 15m candle closes on the wrong side of your trigger EMA (e.g. below EMA for longs, above for shorts). This exits before the hard stop loss is hit." />
          </label>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Confirm candles <Tip text="How many consecutive 15m candles must close on the wrong side of the EMA before the bot exits. 1 = exit on the first candle that breaks the EMA. 2 = wait for a second confirmation candle (reduces false exits but reacts slower)." /></label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="5"
              value={config.exits?.emaTrendBreakExit?.confirmCandles ?? 1}
              onChange={e => {
                const tbe = config.exits?.emaTrendBreakExit || {};
                update('exits.emaTrendBreakExit', { enabled: String(tbe.enabled ?? false).toLowerCase() !== 'false', confirmCandles: Number(e.target.value) });
              }}
            />
            <div className="form-hint">1 = fast exit on first break, 2+ = wait for confirmation</div>
          </div>
        </div>

        <div className="card" style={{ borderColor: 'rgba(248, 113, 113, 0.2)', background: 'rgba(248, 113, 113, 0.04)' }}>
          <div className="card-title" style={{ color: 'var(--red)' }}>Danger Zone</div>
          <button className="btn btn-outline" onClick={handleReset} style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>Reset All Settings &amp; Re-run Setup</button>
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
            <div style={{ fontSize: 32, marginBottom: 16, color: 'var(--accent)' }}>✓</div>
            <h3 style={{ fontSize: 16, fontWeight: 800, fontStyle: 'italic', marginBottom: 8 }}>Settings Saved</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
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
