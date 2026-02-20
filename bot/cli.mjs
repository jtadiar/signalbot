#!/usr/bin/env node

import fs from 'fs';

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

const args = parseArgs(process.argv.slice(2));
if (args.help){
  usage();
  process.exit(0);
}

if (args.setup){
  await import('./setup.mjs');
  process.exit(0);
}

// Load .env if present (best-effort)
try {
  const envPath = new URL('./.env', import.meta.url).pathname;
  if (fs.existsSync(envPath)){
    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });
  }
} catch {}

if (args.config) process.env.CONFIG = args.config;

// Load the runner (it reads CONFIG/env at import time)
await import('./index.mjs');
