import { invoke } from '@tauri-apps/api/core';

export async function readConfig() {
  try {
    const text = await invoke('read_bot_file', { filename: 'config.json' });
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeConfig(config) {
  await invoke('write_bot_file', { filename: 'config.json', contents: JSON.stringify(config, null, 2) });
}

export async function configExists() {
  try {
    return await invoke('bot_file_exists', { filename: 'config.json' });
  } catch {
    return false;
  }
}

export async function writeEnv(content) {
  await invoke('write_bot_file', { filename: '.env', contents: content });
}

export async function readTradeLog() {
  try {
    const text = await invoke('read_bot_file', { filename: 'trades.jsonl' });
    return text.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}
