#!/usr/bin/env node

import fs from 'fs';

function parseArgs(argv){
  const out = { config: null };
  for (let i=0; i<argv.length; i++){
    const a = argv[i];
    if (a === '--config' || a === '-c') out.config = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function usage(){
  console.log(`HL Signalbot (OpenClaw + Hyperliquid)\n\nUsage:\n  hl-signalbot --config ./config.json\n\nOptions:\n  -c, --config   Path to config.json (optional if CONFIG env is set)\n  -h, --help     Show help\n\nEnv (recommended via .env):\n  HL_WALLET_ADDRESS\n  HL_PRIVATE_KEY or HL_PRIVATE_KEY_PATH\n  TG_ENABLED (optional)\n  TG_CHAT (optional)\n  TG_TOKEN or TG_TOKEN_PATH (optional)\n`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help){
  usage();
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
