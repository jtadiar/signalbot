#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { allMids, spotClearinghouseState } from './hl_info.mjs';
import {
  printBanner, systemChecks, stepHeader, stepFooter,
  ok, info, line, blank, warning, fail, prompt,
  neon, cy, warn, dm, bd, isTTY,
} from './ui.mjs';
import chalk from 'chalk';

const noBanner = process.argv.includes('--no-banner');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));
const pause = async (msg) => { await ask(msg || dm('  Press Enter to continue...')); };

const ROOT = new URL('./', import.meta.url).pathname;
const keyDir = path.join(os.homedir(), '.config', 'hl-signalbot');

const TOTAL = 6;

if (!isTTY) {
  console.log('[setup] Non-interactive environment detected. Run in a TTY terminal.');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════
// BANNER
// ═══════════════════════════════════════════════════════════════════════

if (!noBanner) printBanner();

console.log(dm('  This wizard walks you through every step to get the bot running.'));
console.log(dm('  Takes about 5 minutes. LFG.'));
console.log('');

// ═══════════════════════════════════════════════════════════════════════
// STEP 1: Wallet address
// ═══════════════════════════════════════════════════════════════════════

stepHeader(1, TOTAL, 'Wallet Address');
info('The bot needs the wallet address you use on Hyperliquid.');
info('Same address you see in the HL UI top-right.');
blank();

let walletAddress = '';
while (true) {
  walletAddress = (await ask(prompt('Wallet address (0x...): '))).trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) break;
  fail('Invalid. Must be 0x + 40 hex characters.');
}
ok('Wallet address saved.');
stepFooter();

// ═══════════════════════════════════════════════════════════════════════
// STEP 2: Private key
// ═══════════════════════════════════════════════════════════════════════

stepHeader(2, TOTAL, 'Private Key');
info('The bot needs your private key to sign trades on Hyperliquid.');
line(cy('Your key never leaves this machine.') + ' Stored locally only.');
blank();
info('Where to find it:');
info('  MetaMask → Settings → Security → Reveal Private Key');
info('  64-character hex string (with or without 0x prefix)');
blank();

const keyMethod = (await ask(prompt('Store as [1] file (recommended) or [2] env var? (1/2): '))).trim();

let privateKeyEnvLine = '';

if (keyMethod === '2') {
  const pk = (await ask(prompt('Paste private key (hex): '))).trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(pk)) {
    warning('Key does not look like 64-char hex. Continuing anyway.');
  }
  privateKeyEnvLine = `HL_PRIVATE_KEY=${pk}`;
  ok('Key stored as env variable.');
} else {
  const pk = (await ask(prompt('Paste private key (hex): '))).trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(pk)) {
    warning('Key does not look like 64-char hex. Continuing anyway.');
  }
  const keyFile = path.join(keyDir, 'private_key');
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(keyFile, pk + '\n', { mode: 0o600 });
  ok(`Key saved to ${keyFile} (owner-only permissions)`);
  privateKeyEnvLine = `HL_PRIVATE_KEY_PATH=${keyFile}`;
}
stepFooter();

// ═══════════════════════════════════════════════════════════════════════
// STEP 3: Fund your HL account
// ═══════════════════════════════════════════════════════════════════════

stepHeader(3, TOTAL, 'Fund Your Hyperliquid Account');
info('The bot trades perps and needs USDC margin to open positions.');
line('Deposit USDC to Hyperliquid ' + bd('before') + ' starting the bot.');
blank();
line(bd('How to deposit:'));
line('1. Go to ' + cy('https://app.hyperliquid.xyz') + ' and connect your wallet');
info(`   (wallet: ${walletAddress})`);
line('2. Click ' + bd('"Deposit"') + ' in the top-right');
line('3. Bridge USDC from Arbitrum, another chain, or transfer internally');
line('4. Make sure USDC shows in ' + bd('Perps') + ' account (not just Spot)');
line('5. Confirm balance on the Portfolio page');
blank();
line(chalk.yellow('Tip: Start small. You can always add more later.'));
blank();

info('Checking Hyperliquid balance...');
let hasFunds = false;
try {
  const mids = await allMids();
  const btcPx = Number(mids?.BTC || mids?.['BTC-PERP'] || 0);
  if (btcPx > 0) ok(`API connected. BTC mid: $${btcPx.toLocaleString()}`);

  const spot = await spotClearinghouseState(walletAddress);
  const usdc = (spot?.balances || []).find(b => b.coin === 'USDC');
  const bal = Number(usdc?.total ?? 0);
  if (bal > 0) {
    ok(`USDC balance: $${bal.toFixed(2)}`);
    hasFunds = true;
  } else {
    warning('No USDC balance detected for this wallet.');
  }
} catch (e) {
  warning(`Could not reach HL API (${e?.message || e}).`);
}

if (!hasFunds) {
  blank();
  warning('You can continue setup now and deposit USDC before running the bot.');
}
stepFooter();
await pause();

// ═══════════════════════════════════════════════════════════════════════
// STEP 4: Telegram pings
// ═══════════════════════════════════════════════════════════════════════

stepHeader(4, TOTAL, 'Telegram Notifications');
info('The bot can ping you on Telegram when it opens or closes trades.');
info('Optional but strongly recommended.');
blank();

const wantTg = (await ask(prompt('Enable Telegram pings? (y/N): '))).trim().toLowerCase();
let tgLines = 'TG_ENABLED=false';

if (wantTg === 'y' || wantTg === 'yes') {
  blank();
  line(bd('Telegram setup:'));
  line('1. Open Telegram → search for ' + cy('@BotFather'));
  line('2. Send ' + bd('/newbot') + ' to BotFather');
  line('3. Choose a name (e.g. "My HL Signalbot")');
  line('4. Choose a username (must end in "bot")');
  line('5. Copy the token BotFather gives you');
  info('   e.g. 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw');
  blank();

  const tgToken = (await ask(prompt('Paste your bot token: '))).trim();

  blank();
  line(bd('Now set up a channel:'));
  line('1. Create a Channel in Telegram (or use an existing one)');
  line('2. Settings → Administrators → Add your bot');
  line('3. Give it ' + bd('Post Messages') + ' permission');
  info('   Public channel: @channelname');
  info('   Private: numeric ID (add @RawDataBot to find it)');
  blank();

  const tgChat = (await ask(prompt('Channel @username or chat ID: '))).trim();

  info('Sending test message...');
  try {
    const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text: '✓ SIGNALBOT: setup test ping', disable_web_page_preview: true }),
    });
    const data = await res.json();
    if (data.ok) {
      ok('Test message sent! Check your Telegram.');
    } else {
      warning(`Telegram error: ${data.description || 'unknown'}`);
      warning('Make sure the bot is an admin in the channel.');
    }
  } catch (e) {
    warning(`Could not send: ${e?.message || e}`);
  }

  const tokenFile = path.join(keyDir, 'tg_token');
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(tokenFile, tgToken + '\n', { mode: 0o600 });
  tgLines = `TG_ENABLED=true\nTG_CHAT=${tgChat}\nTG_TOKEN_PATH=${tokenFile}`;
  ok(`Token saved to ${tokenFile}`);
}
stepFooter();

// ═══════════════════════════════════════════════════════════════════════
// STEP 5: Risk parameters
// ═══════════════════════════════════════════════════════════════════════

stepHeader(5, TOTAL, 'Risk Parameters');
info('These control how much the bot can risk. Defaults are conservative.');
info('Press Enter to accept the default in [brackets].');
blank();

const maxLevInput = (await ask(prompt('Max leverage [10]: '))).trim();
const maxLev = Number(maxLevInput) || 10;

const maxDailyLossInput = (await ask(prompt('Max daily loss USD [200]: '))).trim();
const maxDailyLoss = Number(maxDailyLossInput) || 200;

const coinInput = (await ask(prompt('Trading coin [BTC]: '))).trim().toUpperCase();
const coin = coinInput || 'BTC';

blank();
line(bd('Trailing stop settings'));
info('TP1 closes 25% at 2R → SL → breakeven');
info('TP2 closes 25% at 4R → SL → TP1');
info('Remaining ~50% is a runner with trailing stop after TP2');
blank();

const trailAfterTp2Input = (await ask(prompt('Enable trailing stop after TP2? [Y/n]: '))).trim().toLowerCase();
const trailAfterTp2Enabled = !(trailAfterTp2Input === 'n' || trailAfterTp2Input === 'no');

let trailPreset = '2';
if (trailAfterTp2Enabled) {
  blank();
  line('Trailing tightness (BTC):');
  line('  [1] Tight   — 0.25%  ' + dm('(may stop out on bounces)'));
  line('  [2] Medium  — 0.50%  ' + dm('(default)'));
  line('  [3] Loose   — 0.80%  ' + dm('(more room, more giveback)'));
  trailPreset = (await ask(prompt('Select [1/2/3] (default 2): '))).trim() || '2';
}

const trailPct = (trailPreset === '1') ? 0.0025 : (trailPreset === '3') ? 0.008 : 0.005;

const moveStopToTp1Input = (await ask(prompt('After TP2, move stop to TP1 price? [Y/n]: '))).trim().toLowerCase();
const moveStopToTp1 = !(moveStopToTp1Input === 'n' || moveStopToTp1Input === 'no');

ok('Risk parameters configured.');
stepFooter();

// ═══════════════════════════════════════════════════════════════════════
// STEP 6: Write config files
// ═══════════════════════════════════════════════════════════════════════

stepHeader(6, TOTAL, 'Saving Configuration');

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
ok('.env written');

const examplePath = path.join(ROOT, 'config.example.json');
const cfgObj = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

cfgObj.wallet.address = walletAddress;
cfgObj.market.coin = coin;
cfgObj.risk.maxLeverage = maxLev;
cfgObj.risk.maxDailyLossUsd = maxDailyLoss;
cfgObj.exits = cfgObj.exits || {};
cfgObj.exits.trailStopToTp1OnTp2 = moveStopToTp1;
cfgObj.exits.trailingAfterTp2 = {
  enabled: trailAfterTp2Enabled,
  kind: 'pct',
  trailPct,
  minUpdateSeconds: 20,
};

if (wantTg === 'y' || wantTg === 'yes') {
  cfgObj.telegram.enabled = true;
} else {
  cfgObj.telegram.enabled = false;
}

const cfgPath = path.join(ROOT, 'config.json');
fs.writeFileSync(cfgPath, JSON.stringify(cfgObj, null, 2));
ok('config.json written');
stepFooter();

// ═══════════════════════════════════════════════════════════════════════
// SYSTEM CHECKS (degen boot sequence)
// ═══════════════════════════════════════════════════════════════════════

console.log('');
await systemChecks();

// ═══════════════════════════════════════════════════════════════════════
// READY SCREEN
// ═══════════════════════════════════════════════════════════════════════

const cols = process.stdout.columns || 80;
const w = Math.min(cols, 72);
const hr = '═'.repeat(w);

console.log(neon(hr));
console.log('');
console.log(bd(neon('  SETUP COMPLETE')));
console.log('');

const summary = [
  ['Wallet',         walletAddress],
  ['Coin',           `${coin}-PERP`],
  ['Max leverage',   `${maxLev}x`],
  ['Max daily loss', `$${maxDailyLoss}`],
  ['Telegram',       (wantTg === 'y' || wantTg === 'yes') ? chalk.green('enabled') : dm('disabled')],
  ['Funded',         hasFunds ? chalk.green('yes') : chalk.yellow('not yet')],
];

const maxLabel = Math.max(...summary.map(([l]) => l.length));
for (const [label, val] of summary) {
  console.log(dm(`  ${label.padEnd(maxLabel)}  `) + val);
}

console.log('');

if (!hasFunds) {
  console.log(chalk.yellow('  Before you start:'));
  console.log(chalk.yellow(`    1. Go to ${cy('https://app.hyperliquid.xyz')}`));
  console.log(chalk.yellow('    2. Deposit USDC to your Perps trading account'));
  console.log(chalk.yellow('    3. Confirm balance on the Portfolio page'));
  console.log('');
}

console.log('  Start the bot with: ' + bd(neon('npm start')));
console.log('');
console.log(dm('  The bot checks for signals every 20s.'));
console.log(dm('  Trades appear in your HL UI under Positions & Orders.'));
if (wantTg === 'y' || wantTg === 'yes') {
  console.log(dm('  Telegram pings for every open and close.'));
}
console.log('');
console.log(neon(hr));
console.log('');

rl.close();
