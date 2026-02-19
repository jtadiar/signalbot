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
const pause = async (msg) => { await ask(msg || '  Press Enter to continue...'); };

function bold(s){ return `\x1b[1m${s}\x1b[0m`; }
function green(s){ return `\x1b[32m${s}\x1b[0m`; }
function yellow(s){ return `\x1b[33m${s}\x1b[0m`; }
function red(s){ return `\x1b[31m${s}\x1b[0m`; }
function dim(s){ return `\x1b[2m${s}\x1b[0m`; }
function cyan(s){ return `\x1b[36m${s}\x1b[0m`; }

const ROOT = new URL('./', import.meta.url).pathname;
const keyDir = path.join(os.homedir(), '.config', 'hl-signalbot');

console.log('');
console.log(bold('  HL Signalbot Setup Wizard'));
console.log(dim('  ────────────────────────'));
console.log('');
console.log(dim('  This wizard will walk you through every step to get the bot running.'));
console.log(dim('  It takes about 5 minutes.'));
console.log('');

// ═════════════════════════════════════════════════════════════════════════════
// STEP 1: Wallet address
// ═════════════════════════════════════════════════════════════════════════════

console.log(bold('  Step 1 of 6: Wallet Address'));
console.log(dim('  ─────────────────────────────'));
console.log('');
console.log('  The bot needs the wallet address you use on Hyperliquid.');
console.log('  This is the same address you see in the Hyperliquid UI top-right.');
console.log('');

let walletAddress = '';
while (true) {
  walletAddress = (await ask('  Wallet address (0x...): ')).trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) break;
  console.log(red('  Invalid address. Must be 0x followed by 40 hex characters.'));
}
console.log(green('  Wallet address saved.'));

// ═════════════════════════════════════════════════════════════════════════════
// STEP 2: Private key
// ═════════════════════════════════════════════════════════════════════════════

console.log('');
console.log(bold('  Step 2 of 6: Private Key'));
console.log(dim('  ─────────────────────────'));
console.log('');
console.log('  The bot needs your private key to sign trades on Hyperliquid.');
console.log(cyan('  Your key never leaves this machine.') + ' It is stored locally only.');
console.log('');
console.log(dim('  Where to find it:'));
console.log(dim('    - If you use MetaMask: Settings > Security > Reveal Private Key'));
console.log(dim('    - It is a 64-character hex string (with or without 0x prefix)'));
console.log('');

const keyMethod = (await ask('  Store key as [1] file (recommended) or [2] env variable? (1/2): ')).trim();

let privateKeyEnvLine = '';

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
  console.log(green(`  Key saved to ${keyFile} (permissions: owner-only)`));
  privateKeyEnvLine = `HL_PRIVATE_KEY_PATH=${keyFile}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 3: Fund your Hyperliquid account
// ═════════════════════════════════════════════════════════════════════════════

console.log('');
console.log(bold('  Step 3 of 6: Fund Your Hyperliquid Account'));
console.log(dim('  ────────────────────────────────────────────'));
console.log('');
console.log('  The bot trades perpetual futures and needs USDC margin to open positions.');
console.log('  You must deposit USDC to Hyperliquid ' + bold('before') + ' starting the bot.');
console.log('');
console.log(bold('  How to deposit:'));
console.log('');
console.log('  1. Go to ' + cyan('https://app.hyperliquid.xyz') + ' and connect your wallet');
console.log(`     (the same wallet: ${dim(walletAddress)})`);
console.log('');
console.log('  2. Click ' + bold('"Deposit"') + ' in the top-right of the Hyperliquid app');
console.log('');
console.log('  3. Choose your deposit method:');
console.log('     ' + dim('a)') + ' Bridge USDC from Arbitrum directly to Hyperliquid');
console.log('     ' + dim('b)') + ' Deposit from another chain via the built-in bridge');
console.log('     ' + dim('c)') + ' Transfer USDC from another Hyperliquid account');
console.log('');
console.log('  4. Make sure your USDC shows up in the ' + bold('Perps / Trading') + ' account');
console.log('     (not just Spot). If it is in Spot, use "Transfer" to move it to Perps.');
console.log('');
console.log('  5. You should see your balance on the Portfolio page before continuing.');
console.log('');
console.log(yellow('  Tip: Start small. You can always add more funds later.'));
console.log('');

// Check balance
console.log(dim('  Checking your current Hyperliquid balance...'));
let hasFunds = false;
try {
  const mids = await allMids();
  const btcPx = Number(mids?.BTC || mids?.['BTC-PERP'] || 0);
  if (btcPx > 0) {
    console.log(green(`  API connected. BTC mid price: $${btcPx.toLocaleString()}`));
  }

  const spot = await spotClearinghouseState(walletAddress);
  const usdc = (spot?.balances||[]).find(b=>b.coin==='USDC');
  const bal = Number(usdc?.total ?? 0);
  if (bal > 0) {
    console.log(green(`  USDC balance: $${bal.toFixed(2)}`));
    hasFunds = true;
  } else {
    console.log(yellow('  No USDC balance detected for this wallet.'));
  }
} catch (e) {
  console.log(yellow(`  Could not reach Hyperliquid API (${e?.message || e}).`));
}

if (!hasFunds) {
  console.log('');
  console.log(yellow('  You can continue setup now and deposit USDC before running the bot.'));
  console.log(yellow('  The bot will not trade until it detects a USDC balance.'));
}

console.log('');
await pause();

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4: Telegram pings
// ═════════════════════════════════════════════════════════════════════════════

console.log('');
console.log(bold('  Step 4 of 6: Telegram Notifications'));
console.log(dim('  ─────────────────────────────────────'));
console.log('');
console.log('  The bot can send you Telegram messages when it opens or closes a trade.');
console.log('  This is optional but strongly recommended so you know what the bot is doing.');
console.log('');

const wantTg = (await ask('  Enable Telegram pings? (y/N): ')).trim().toLowerCase();
let tgLines = 'TG_ENABLED=false';

if (wantTg === 'y' || wantTg === 'yes') {
  console.log('');
  console.log(bold('  Telegram setup — follow these steps:'));
  console.log('');
  console.log('  1. Open Telegram and search for ' + cyan('@BotFather'));
  console.log('  2. Send ' + bold('/newbot') + ' to BotFather');
  console.log('  3. Choose a name (e.g. "My HL Signalbot")');
  console.log('  4. Choose a username (e.g. "my_hl_signalbot_bot" — must end in "bot")');
  console.log('  5. BotFather will give you a token like: ' + dim('123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw'));
  console.log('     ' + bold('Copy this token.'));
  console.log('');

  const tgToken = (await ask('  Paste your bot token here: ')).trim();

  console.log('');
  console.log(bold('  Now create a channel for the bot to post in:'));
  console.log('');
  console.log('  1. In Telegram, create a new ' + bold('Channel') + ' (or use an existing one)');
  console.log('  2. Go to Channel Settings > ' + bold('Administrators') + ' > ' + bold('Add Administrator'));
  console.log('  3. Search for your bot by its username and add it');
  console.log('  4. Give it permission to ' + bold('Post Messages'));
  console.log('');
  console.log(dim('  For the chat ID:'));
  console.log(dim('    - Public channel: use @channelname (e.g. @my_trading_pings)'));
  console.log(dim('    - Private channel: use the numeric ID (starts with -100...)'));
  console.log(dim('      To find it: add @RawDataBot to the channel, it will print the chat ID'));
  console.log('');

  const tgChat = (await ask('  Channel @username or chat ID: ')).trim();

  console.log('');
  console.log(dim('  Sending test message...'));
  try {
    const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text: 'HL Signalbot: setup test ping ✓', disable_web_page_preview: true }),
    });
    const data = await res.json();
    if (data.ok) {
      console.log(green('  Test message sent! Check your Telegram channel.'));
    } else {
      console.log(yellow(`  Telegram error: ${data.description || 'unknown'}`));
      console.log(yellow('  Common fixes: make sure the bot is an admin in the channel,'));
      console.log(yellow('  and the @username / chat ID is correct.'));
    }
  } catch (e) {
    console.log(yellow(`  Could not send test message: ${e?.message || e}`));
  }

  const tokenFile = path.join(keyDir, 'tg_token');
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(tokenFile, tgToken + '\n', { mode: 0o600 });
  tgLines = `TG_ENABLED=true\nTG_CHAT=${tgChat}\nTG_TOKEN_PATH=${tokenFile}`;
  console.log(green(`  Telegram token saved to ${tokenFile}`));
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 5: Risk parameters
// ═════════════════════════════════════════════════════════════════════════════

console.log('');
console.log(bold('  Step 5 of 6: Risk Parameters'));
console.log(dim('  ─────────────────────────────'));
console.log('');
console.log('  These control how much the bot can risk. The defaults are conservative.');
console.log(dim('  Press Enter to accept the default value shown in [brackets].'));
console.log('');

const maxLevInput = (await ask(`  Max leverage [10]: `)).trim();
const maxLev = Number(maxLevInput) || 10;

const maxDailyLossInput = (await ask(`  Max daily loss in USD — bot halts if exceeded [200]: `)).trim();
const maxDailyLoss = Number(maxDailyLossInput) || 200;

const coinInput = (await ask(`  Trading coin [BTC]: `)).trim().toUpperCase();
const coin = coinInput || 'BTC';

console.log('');
console.log(bold('  Runner / trailing stop settings'));
console.log(dim('  ─────────────────────────────'));
console.log('');
console.log('  Default behavior:');
console.log(dim('    • TP1 closes 25% at 2R, then SL → breakeven'));
console.log(dim('    • TP2 closes 25% at 4R, then SL → TP1'));
console.log(dim('    • Remaining ~50% is a runner with trailing stop after TP2'));
console.log('');

const trailAfterTp2Input = (await ask(`  Enable trailing stop after TP2? [Y/n]: `)).trim().toLowerCase();
const trailAfterTp2Enabled = !(trailAfterTp2Input === 'n' || trailAfterTp2Input === 'no');

let trailPreset = '2';
if (trailAfterTp2Enabled){
  console.log('');
  console.log('  Choose trailing tightness (BTC):');
  console.log('    [1] Tight   — 0.25% (may stop out on bounces)');
  console.log('    [2] Medium  — 0.50% (default)');
  console.log('    [3] Loose   — 0.80% (more room, more giveback)');
  trailPreset = (await ask(`  Select [1/2/3] (default 2): `)).trim() || '2';
}

const trailPct = (trailPreset === '1') ? 0.0025 : (trailPreset === '3') ? 0.008 : 0.005;

const moveStopToTp1Input = (await ask(`  After TP2, move stop to TP1 price? [Y/n]: `)).trim().toLowerCase();
const moveStopToTp1 = !(moveStopToTp1Input === 'n' || moveStopToTp1Input === 'no');

// ═════════════════════════════════════════════════════════════════════════════
// STEP 6: Write config files
// ═════════════════════════════════════════════════════════════════════════════

console.log('');
console.log(bold('  Step 6 of 6: Saving Configuration'));
console.log(dim('  ──────────────────────────────────'));

// Write .env
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
console.log(green(`  .env written`));

// Write config.json
const examplePath = path.join(ROOT, 'config.example.json');
const cfgObj = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

cfgObj.wallet.address = walletAddress;
cfgObj.market.coin = coin;
cfgObj.risk.maxLeverage = maxLev;
cfgObj.risk.maxDailyLossUsd = maxDailyLoss;

// Apply trailing/runner options chosen in the wizard
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
console.log(green(`  config.json written`));

// ═════════════════════════════════════════════════════════════════════════════
// DONE
// ═════════════════════════════════════════════════════════════════════════════

console.log('');
console.log(dim('  ════════════════════════════════════════'));
console.log(bold('  Setup complete!'));
console.log(dim('  ════════════════════════════════════════'));
console.log('');
console.log(`  ${dim('Wallet:')}         ${walletAddress}`);
console.log(`  ${dim('Coin:')}           ${coin}-PERP`);
console.log(`  ${dim('Max leverage:')}   ${maxLev}x`);
console.log(`  ${dim('Max daily loss:')} $${maxDailyLoss}`);
console.log(`  ${dim('Telegram:')}       ${(wantTg === 'y' || wantTg === 'yes') ? green('enabled') : 'disabled'}`);
console.log(`  ${dim('Funded:')}         ${hasFunds ? green('yes') : yellow('not yet — deposit USDC before starting')}`);
console.log('');

if (!hasFunds) {
  console.log(yellow('  Before you start:'));
  console.log(yellow(`    1. Go to ${cyan('https://app.hyperliquid.xyz')}`));
  console.log(yellow('    2. Deposit USDC to your Perps trading account'));
  console.log(yellow('    3. Confirm your balance shows on the Portfolio page'));
  console.log('');
}

console.log(`  Start the bot with: ${bold('npm start')}`);
console.log('');
console.log(dim('  The bot will check for signals every 20 seconds.'));
console.log(dim('  Trades will appear in your Hyperliquid UI under Positions & Orders.'));
if (wantTg === 'y' || wantTg === 'yes') {
  console.log(dim('  You will also get Telegram pings for every open and close.'));
}
console.log('');

rl.close();
