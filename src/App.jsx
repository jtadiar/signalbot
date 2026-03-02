import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import License from './pages/License';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import TradeLog from './pages/TradeLog';
import Settings from './pages/Settings';
import { version as APP_VERSION } from '../package.json';

export default function App() {
  const [licensed, setLicensed] = useState(() => !!localStorage.getItem('license_key'));
  const [configured, setConfigured] = useState(null); // null = loading
  const [nodeOk, setNodeOk] = useState(null);
  const [nodeError, setNodeError] = useState('');
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    if (!licensed) return;
    Promise.all([
      invoke('bot_file_exists', { filename: 'config.json' }),
      invoke('bot_file_exists', { filename: '.env' }),
    ]).then(([hasConfig, hasEnv]) => {
      setConfigured(hasConfig && hasEnv);
      if (hasConfig && hasEnv) localStorage.setItem('configured', '1');
    }).catch(() => {
      setConfigured(!!localStorage.getItem('configured'));
    });
  }, [licensed]);

  useEffect(() => {
    invoke('check_node').then(path => {
      setNodeOk(true);
    }).catch(err => {
      setNodeOk(false);
      setNodeError(typeof err === 'string' ? err : err?.message || 'Node.js not found');
    });
  }, []);

  if (!licensed) {
    return <License onActivate={() => setLicensed(true)} />;
  }

  // Show Node.js missing screen
  if (nodeOk === false) {
    return (
      <div className="license-page">
        <div className="license-box">
          <h1>Node.js Required</h1>
          <p style={{ color: 'var(--red)', marginBottom: 16 }}>{nodeError}</p>
          <p>HL Signalbot needs Node.js to run the trading engine.</p>
          <div style={{ marginTop: 20 }}>
            <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="btn btn-primary btn-lg" style={{ textDecoration: 'none' }}>
              Download Node.js
            </a>
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            Install the LTS version, restart the app, and you're good to go.
          </p>
        </div>
      </div>
    );
  }

  if (configured === null) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--accent)' }}>Loading...</div>;
  }

  if (!configured) {
    return <Setup onComplete={() => { setConfigured(true); localStorage.setItem('configured', '1'); }} />;
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">HL Signalbot</div>
        <div className="sidebar-nav">
          <button className={`sidebar-link ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}>
            Dashboard
          </button>
          <button className={`sidebar-link ${page === 'tradelog' ? 'active' : ''}`} onClick={() => setPage('tradelog')}>
            Trade Log
          </button>
          <button className={`sidebar-link ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}>
            Settings
          </button>
        </div>
        <div className="sidebar-footer">
          <span className="text-muted" style={{ fontSize: 11 }}>v{APP_VERSION}</span>
        </div>
      </nav>
      <main className="main">
        <div style={{ display: page === 'dashboard' ? 'block' : 'none' }}><Dashboard /></div>
        <div style={{ display: page === 'tradelog' ? 'block' : 'none' }}><TradeLog /></div>
        <div style={{ display: page === 'settings' ? 'block' : 'none' }}><Settings /></div>
      </main>
    </div>
  );
}
