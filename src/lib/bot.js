import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

let eventListeners = [];
let unlisten = null;

export function onBotEvent(callback) {
  eventListeners.push(callback);

  // Set up Tauri event listener on first subscriber
  if (!unlisten) {
    listen('bot-event', (event) => {
      const raw = event.payload;
      let parsed;
      try {
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        parsed = { type: 'log', message: String(raw) };
      }
      eventListeners.forEach(cb => cb(parsed));
    }).then(fn => { unlisten = fn; });
  }

  return () => {
    eventListeners = eventListeners.filter(l => l !== callback);
  };
}

export async function startBot() {
  try {
    await invoke('start_bot');
    eventListeners.forEach(cb => cb({ type: 'started' }));
    return true;
  } catch (e) {
    const msg = typeof e === 'string' ? e : e?.message || String(e);
    eventListeners.forEach(cb => cb({ type: 'error', message: msg }));
    return false;
  }
}

export async function stopBot() {
  try {
    await invoke('stop_bot');
    eventListeners.forEach(cb => cb({ type: 'stopped', code: 0 }));
  } catch (e) {
    const msg = typeof e === 'string' ? e : e?.message || String(e);
    eventListeners.forEach(cb => cb({ type: 'error', message: msg }));
  }
}

export async function isBotRunning() {
  try {
    return await invoke('is_bot_running');
  } catch {
    return false;
  }
}
