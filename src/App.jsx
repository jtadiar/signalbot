import { useState, useEffect } from 'react';
import License from './pages/License';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import TradeLog from './pages/TradeLog';
import Settings from './pages/Settings';

const PAGES = { dashboard: Dashboard, tradelog: TradeLog, settings: Settings };

export default function App() {
  const [licensed, setLicensed] = useState(() => !!localStorage.getItem('license_key'));
  const [configured, setConfigured] = useState(() => !!localStorage.getItem('configured'));
  const [page, setPage] = useState('dashboard');

  if (!licensed) {
    return <License onActivate={() => setLicensed(true)} />;
  }

  if (!configured) {
    return <Setup onComplete={() => { setConfigured(true); localStorage.setItem('configured', '1'); }} />;
  }

  const Page = PAGES[page] || Dashboard;

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
          <span className="text-muted" style={{ fontSize: 11 }}>v1.0.0</span>
        </div>
      </nav>
      <main className="main">
        <Page />
      </main>
    </div>
  );
}
