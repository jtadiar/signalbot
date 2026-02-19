#!/usr/bin/env node

// Interactive setup wizard for HL Signalbot.
// Walks the user through creating .env and config.json.

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { allMids, spotClearinghouseState } from './hl_info.mjs';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

function bold(s){ return `\x1b[1m${s}\x1b[0m`; }
function green(s){ return `\x1b[32m${s}\x1b[0m`; }
function yellow(s){ return `\x1b[33m${s}\x1b[0m`; }
function red(s){ return `\x1b[31m${s}\x1b[0m`; }
function dim(s){ return `\x1b[2m${s}\x1b[0m`; }

const ROOT = new URL('./', import.meta.url).pathname;

console.log('');
console.log(bold('  HL Signalbot Setup Wizard'));
console.log(dim('  ────────────────────────'));
console.log('');

// ── Step 1: Wallet address ──────────────────────────────────────────────────

let walletAddress = '';
while (true) {
  walletAddress = (await ask('  Wallet address (0x...): ')).trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) break;
  console.log(red('  Invalid address. Must be 0x followed by 40 hex characters.'));
}

// ── Step 2: Private key ─────────────────────────────────────────────────────

console.log('');
console.log(dim('  Your private key never leaves this machine.'));
const keyMethod = (await ask('  Store key as [1] file (recommended) or [2] env variable? (1/2): ')).trim();

let privateKeyEnvLine = '';
const keyDir = path.join(os.homedir(), '.config', 'hl-signalbot');

if (keyMethod === '2') {
  const pk = (await ask('  Paste private key (hex): ')).trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(pk)) {
    console.log(red('  Warning: key does not look like a 64-char hex string. Continuing anyway.'));
  }
  privateKeyEnvLine = `HL_PRIVATE_KEY=${pk}`;
} else {
  const pk = (await ask('  Paste private key (hex): ')).trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(pk)) {
    console.log(red('  Warning: key does not look like a 64-char hex string. Continuing anyway.'));
  }
  const keyFile = path.join(keyDir, 'private_key');
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(keyFile, pk + '\n', { mode: 0o600 });
  console.log(green(`  Key saved to ${keyFile}`));
  privateKeyEnvLine = `HL_PRIVATE_KEY_PATH=${keyFile}`;
}

// ── Step 3: Test connection ─────────────────────────────────────────────────

console.log('');
console.log(dim('  Testing Hyperliquid API connection...'));
try {
  const mids = await allMids();
  const btcPx = Number(mids?.BTC || mids?.['BTC-PERP'] || 0);
  if (btcPx > 0) {
    console.log(green(`  Connected. BTC mid price: $${btcPx.toLocaleString()}`));
  } else {
    console.log(yellow('  Connected but could not read BTC price. Check later.'));
  }

  const spot = await spotClearinghouseState(walletAddress);
  const usdc = (spot?.balances||[]).find(b=>b.coin==='USDC');
  const bal = Number(usdc?.total ?? 0);
  if (bal > 0) {
    console.log(green(`  Wallet USDC balance: $${bal.toFixed(2)}`));
  } else {
    console.log(yellow('  No USDC balance detected. Fund your Hyperliquid account before starting.'));
  }
} catch (e) {
  console.log(yellow(`  Could not reach Hyperliquid API (${e?.message || e}). You can still continue.`));
}

// ── Step 4: Telegram (optional) ─────────────────────────────────────────────

console.log('');
const wantTg = (await ask('  Enable Telegram pings? (y/N): ')).trim().toLowerCase();
let tgLines = 'TG_ENABLED=false';

if (wantTg === 'y' || wantTg === 'yes') {
  const tgToken = (await ask('  Telegram bot token (from @BotFather): ')).trim();
  const tgChat = (await ask('  Telegram chat ID or @channel: ')).trim();

  console.log(dim('  Sending test message...'));
  try {
    const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text: 'HL Signalbot: setup test ping', disable_web_page_preview: true }),
    });
    const data = await res.json();
    if (data.ok) {
      console.log(green('  Test message sent successfully.'));
    } else {
      console.log(yellow(`  Telegram API responded with: ${data.description || 'unknown error'}. Check token/chat.`));
    }
  } catch (e) {
    console.log(yellow(`  Could not send test message: ${e?.message || e}`));
  }

  const tokenFile = path.join(keyDir, 'tg_token');
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(tokenFile, tgToken + '\n', { mode: 0o600 });
  tgLines = `TG_ENABLED=true\nTG_CHAT=${tgChat}\nTG_TOKEN_PATH=${tokenFile}`;
}

// ── Step 5: Risk parameters ─────────────────────────────────────────────────

console.log('');
console.log(bold('  Risk parameters') + dim(' (press Enter to accept defaults)'));

const maxLevInput = (await ask(`  Max leverage [10]: `)).trim();
const maxLev = Number(maxLevInput) || 10;

const maxDailyLossInput = (await ask(`  Max daily loss USD [200]: `)).trim();
const maxDailyLoss = Number(maxDailyLossInput) || 200;

const coinInput = (await ask(`  Trading coin [BTC]: `)).trim().toUpperCase();
const coin = coinInput || 'BTC';

// ── Step 6: Write .env ──────────────────────────────────────────────────────

const envContent = [
  '# HL Signalbot - generated by setup wizard',
  '',
  `HL_WALLET_ADDRESS=${walletAddress}`,
  privateKeyEnvLine,
  '',
  tgLines,
  '',
].join('\n');

const envPath = path.join(ROOT, '.env');
fs.writeFileSync(envPath, envContent);
console.log('');
console.log(green(`  .env written to ${envPath}`));

// ── Step 7: Write config.json ───────────────────────────────────────────────

const examplePath = path.join(ROOT, 'config.example.json');
const cfgObj = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

cfgObj.wallet.address = walletAddress;
cfgObj.market.coin = coin;
cfgObj.risk.maxLeverage = maxLev;
cfgObj.risk.maxDailyLossUsd = maxDailyLoss;

if (wantTg === 'y' || wantTg === 'yes') {
  cfgObj.telegram.enabled = true;
} else {
  cfgObj.telegram.enabled = false;
}

const cfgPath = path.join(ROOT, 'config.json');
fs.writeFileSync(cfgPath, JSON.stringify(cfgObj, null, 2));
console.log(green(`  config.json written to ${cfgPath}`));

// ── Done ────────────────────────────────────────────────────────────────────

console.log('');
console.log(bold('  Setup complete.'));
console.log('');
console.log(`  ${dim('Coin:')}          ${coin}-PERP`);
console.log(`  ${dim('Max leverage:')}  ${maxLev}x`);
console.log(`  ${dim('Max daily loss:')} $${maxDailyLoss}`);
console.log(`  ${dim('Telegram:')}      ${(wantTg === 'y' || wantTg === 'yes') ? 'enabled' : 'disabled'}`);
console.log('');
console.log(`  Start the bot with: ${bold('npm start')}`);
console.log('');

rl.close();
