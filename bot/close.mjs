#!/usr/bin/env node
// Standalone script to market-close the current position and cancel all TP/SL orders.
// Invoked by the Tauri app's "Close Trade" button.
// Outputs JSON result to stdout for the Rust backend to parse.

import fs from 'fs';
import { Hyperliquid } from 'hyperliquid';
import { homedir } from 'os';

// Load .env (same as cli.mjs)
try {
  const envPath = process.env.DOTENV_CONFIG_PATH || new URL('./.env', import.meta.url).pathname;
  if (fs.existsSync(envPath)) {
    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });
  }
} catch {}

function expandHome(p) {
  if (p && p.startsWith('~/')) return p.replace('~', homedir());
  return p;
}
function readSecret(p) {
  try { return fs.readFileSync(expandHome(p), 'utf8').trim(); } catch { return null; }
}

const configPath = process.argv[2] || new URL('./config.json', import.meta.url).pathname;
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const TRADE_LOG = process.env.TRADE_LOG || new URL('./trades.jsonl', import.meta.url).pathname;

if (process.env.HL_WALLET_ADDRESS) cfg.wallet.address = String(process.env.HL_WALLET_ADDRESS).trim();

const pk = (
  (process.env.HL_PRIVATE_KEY && String(process.env.HL_PRIVATE_KEY).trim()) ||
  (process.env.HL_PRIVATE_KEY_PATH && readSecret(String(process.env.HL_PRIVATE_KEY_PATH).trim())) ||
  (cfg?.wallet?.privateKeyPath && readSecret(String(cfg.wallet.privateKeyPath).trim())) ||
  null
);

if (!pk || !cfg?.wallet?.address) {
  console.log(JSON.stringify({ ok: false, error: 'Missing wallet address or private key' }));
  process.exit(1);
}

const sdk = new Hyperliquid({ privateKey: pk, enableWs: false, testnet: false, walletAddress: cfg.wallet.address, disableAssetMapRefresh: true });
const coin = cfg.market?.coin || 'BTC';
const coinPerp = `${coin}-PERP`;

try {
  const ch = await sdk.info.perpetuals.getClearinghouseState(cfg.wallet.address, true);
  const pos = (ch?.assetPositions || []).map(p => p.position).find(p => p?.coin === coin);
  const szi = pos ? Number(pos.szi || 0) : 0;
  const entryPx = pos ? Number(pos.entryPx || 0) : 0;

  if (Math.abs(szi) === 0) {
    console.log(JSON.stringify({ ok: true, message: 'No open position', closed: false }));
    process.exit(0);
  }

  const side = szi > 0 ? 'long' : 'short';

  // Cancel all TP/SL trigger orders
  try {
    const oo = await sdk.info.getFrontendOpenOrders(cfg.wallet.address, true);
    const triggers = (oo || []).filter(o =>
      (o.coin === coin || o.coin === coinPerp) && o.reduceOnly === true
    );
    if (triggers.length) {
      await sdk.exchange.cancelOrder(triggers.map(o => ({ coin: coinPerp, o: o.oid }))).catch(() => {});
    }
  } catch {}

  // Market close entire position
  const resp = await sdk.custom.marketClose(coinPerp);
  let exitPx = 0;
  let exitSz = Math.abs(szi);
  let pnlUsd = null;
  try {
    const fill = resp?.response?.data?.statuses?.[0]?.filled;
    exitPx = Number(fill?.avgPx || 0);
    exitSz = Number(fill?.totalSz || Math.abs(szi));
    if (exitPx && entryPx) {
      pnlUsd = (side === 'short' ? (entryPx - exitPx) : (exitPx - entryPx)) * exitSz;
    }
  } catch {}

  // Log the close event
  try {
    const ev = { ts: new Date().toISOString(), action: 'CLOSE', side, sizeBtc: exitSz, entryPx, exitPx, pnlUsd, leader: 'manual_close', partial: false };
    fs.appendFileSync(TRADE_LOG, JSON.stringify(ev) + '\n');
  } catch {}

  // Clear bot state so it doesn't think position is still open
  try {
    const statePath = new URL('./state.json', import.meta.url).pathname;
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.activeSide = null;
    state.entryPx = null;
    state.entryNotionalUsd = null;
    state.initialSz = null;
    state.marginUsd = null;
    state.stopPct = null;
    state.stopPx = null;
    state.tp1Done = false;
    state.tp2Done = false;
    state.exitsPlacedForPosKey = null;
    state.lastExitAtMs = Date.now();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch {}

  console.log(JSON.stringify({ ok: true, closed: true, side, exitPx, exitSz, pnlUsd, entryPx }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e?.message || String(e) }));
  process.exit(1);
}
