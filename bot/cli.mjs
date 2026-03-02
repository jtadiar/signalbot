#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';

const DATA_DIR = path.join(homedir(), '.config', 'hl-signalbot');
const LICENSE_FILE = path.join(DATA_DIR, 'license.key');
const LICENSE_API = 'https://hlsignalbot.netlify.app/api/validate';

function parseArgs(argv){
  const out = { config: null };
  for (let i=0; i<argv.length; i++){
    const a = argv[i];
    if (a === '--config' || a === '-c') out.config = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--no-banner') out.noBanner = true;
    else if (a === 'setup') out.setup = true;
  }
  return out;
}

function usage(){
  console.log(`HL Signalbot (Hyperliquid)

Usage:
  hl-signalbot [options]
  hl-signalbot setup          Interactive setup wizard

Options:
  -c, --config     Path to config.json (optional if CONFIG env is set)
  --no-banner      Skip ASCII banner during setup
  -h, --help       Show help

Env (recommended via .env):
  HL_WALLET_ADDRESS
  HL_PRIVATE_KEY or HL_PRIVATE_KEY_PATH
  TG_ENABLED (optional)
  TG_CHAT (optional)
  TG_TOKEN or TG_TOKEN_PATH (optional)
`);
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function validKeyFormat(key) {
  const k = key.trim().toUpperCase();
  return k.startsWith('SB-') && k.length === 22 && k.split('-').length === 5
    && k.split('-').slice(1).every(s => s.length === 4 && /^[A-Z0-9]+$/.test(s));
}

async function validateOnline(key) {
  try {
    const res = await fetch(LICENSE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim().toUpperCase() }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return data.valid === true;
  } catch {
    return null;
  }
}

async function checkLicense() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(LICENSE_FILE)) {
    const saved = fs.readFileSync(LICENSE_FILE, 'utf-8').trim();
    if (validKeyFormat(saved)) {
      const online = await validateOnline(saved);
      if (online === true || (online === null && validKeyFormat(saved))) return true;
      if (online === false) {
        console.log('\x1b[31m✗ License key is no longer valid.\x1b[0m');
        fs.unlinkSync(LICENSE_FILE);
      }
    }
  }

  console.log('\n\x1b[36m╔══════════════════════════════════════════╗');
  console.log('║         LICENSE KEY REQUIRED              ║');
  console.log('╚══════════════════════════════════════════╝\x1b[0m\n');
  console.log('  Get your key at: \x1b[32mhttps://hlsignalbot.netlify.app\x1b[0m\n');

  for (let attempt = 0; attempt < 3; attempt++) {
    const key = await prompt('  Enter license key: ');
    if (!key) continue;

    if (!validKeyFormat(key)) {
      console.log('  \x1b[31m✗ Invalid format. Keys look like: SB-XXXX-XXXX-XXXX-XXXX\x1b[0m\n');
      continue;
    }

    const online = await validateOnline(key);
    if (online === false) {
      console.log('  \x1b[31m✗ Invalid license key. Please check and try again.\x1b[0m\n');
      continue;
    }

    fs.writeFileSync(LICENSE_FILE, key.trim().toUpperCase(), { mode: 0o600 });
    console.log('  \x1b[32m✓ License activated!\x1b[0m\n');
    return true;
  }

  console.log('\n  \x1b[31mToo many failed attempts. Get a key at https://hlsignalbot.netlify.app\x1b[0m\n');
  return false;
}

const args = parseArgs(process.argv.slice(2));
if (args.help){
  usage();
  process.exit(0);
}

if (args.setup){
  await import('./setup.mjs');
  process.exit(0);
}

// Skip license check when launched from Tauri (desktop app has its own gate)
if (!process.env.TAURI) {
  const licensed = await checkLicense();
  if (!licensed) process.exit(1);
}

// Load .env from user data dir (best-effort)
try {
  const envPath = path.join(DATA_DIR, '.env');
  if (fs.existsSync(envPath)){
    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });
  }
} catch (e) { console.warn('dotenv load failed:', e?.message); }

if (args.config) process.env.CONFIG = args.config;
else process.env.CONFIG = process.env.CONFIG || path.join(DATA_DIR, 'config.json');

// Load the runner (it reads CONFIG/env at import time)
await import('./index.mjs');
