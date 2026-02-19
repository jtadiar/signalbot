const CONFIG_PATH = 'bot/config.json';
const CONFIG_EXAMPLE_PATH = 'bot/config.example.json';
const ENV_PATH = 'bot/.env';

export async function readConfig() {
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const text = await readTextFile(CONFIG_PATH, { baseDir: 11 }); // AppResource
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeConfig(config) {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(CONFIG_PATH, JSON.stringify(config, null, 2), { baseDir: 11 });
}

export async function readConfigExample() {
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const text = await readTextFile(CONFIG_EXAMPLE_PATH, { baseDir: 11 });
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function configExists() {
  try {
    const { exists } = await import('@tauri-apps/plugin-fs');
    return await exists(CONFIG_PATH, { baseDir: 11 });
  } catch {
    return false;
  }
}

export async function writeEnv(lines) {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(ENV_PATH, lines.join('\n'), { baseDir: 11 });
}

export async function readTradeLog() {
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const text = await readTextFile('bot/trades.jsonl', { baseDir: 11 });
    return text.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}
