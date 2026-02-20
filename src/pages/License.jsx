import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function License({ onActivate }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleActivate() {
    if (!key.trim()) {
      setError('Please enter a license key.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const valid = await invoke('validate_license', { key: key.trim() });
      if (valid) {
        localStorage.setItem('license_key', key.trim());
        onActivate();
      } else {
        setError('Invalid license key. Please check and try again.');
      }
    } catch (e) {
      setError(e?.message || 'Verification failed. Check your connection.');
    }
    setLoading(false);
  }

  return (
    <div className="license-page">
      <div className="license-box">
        <h1>HL Signalbot</h1>
        <p>Enter your license key to get started.</p>
        <div className="form-group">
          <input
            className="form-input"
            type="text"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleActivate()}
            style={{ textAlign: 'center', fontSize: 16, letterSpacing: 1 }}
          />
        </div>
        {error && <div className="error-msg">{error}</div>}
        <button className="btn btn-primary btn-lg" onClick={handleActivate} disabled={loading} style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}>
          {loading ? 'Verifying...' : 'Activate'}
        </button>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          Don't have a key? Get one at hlsignalbot.netlify.app
        </p>
      </div>
    </div>
  );
}
