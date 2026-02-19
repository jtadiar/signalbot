import { invoke } from '@tauri-apps/api/core';

let childProcess = null;
let eventListeners = [];

export function onBotEvent(callback) {
  eventListeners.push(callback);
  return () => { eventListeners = eventListeners.filter(l => l !== callback); };
}

function emitEvent(event) {
  eventListeners.forEach(cb => cb(event));
}

export async function startBot() {
  try {
    const { Command } = await import('@tauri-apps/plugin-shell');
    const cmd = Command.create('node', ['./bot/index.mjs'], { env: { TAURI: '1' } });

    cmd.stdout.on('data', (line) => {
      try {
        const event = JSON.parse(line);
        emitEvent(event);
      } catch {
        emitEvent({ type: 'log', message: line });
      }
    });

    cmd.stderr.on('data', (line) => {
      emitEvent({ type: 'error', message: line });
    });

    cmd.on('close', (data) => {
      emitEvent({ type: 'stopped', code: data.code });
      invoke('set_bot_running', { running: false });
      invoke('set_bot_pid', { pid: null });
      childProcess = null;
    });

    childProcess = await cmd.spawn();
    await invoke('set_bot_running', { running: true });
    await invoke('set_bot_pid', { pid: childProcess.pid });
    emitEvent({ type: 'started' });
    return true;
  } catch (e) {
    emitEvent({ type: 'error', message: e?.message || String(e) });
    return false;
  }
}

export async function stopBot() {
  if (childProcess) {
    await childProcess.kill();
    childProcess = null;
    await invoke('set_bot_running', { running: false });
    await invoke('set_bot_pid', { pid: null });
    emitEvent({ type: 'stopped', code: 0 });
  }
}

export async function isBotRunning() {
  try {
    return await invoke('is_bot_running');
  } catch {
    return false;
  }
}
