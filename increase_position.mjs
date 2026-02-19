#!/usr/bin/env node

// Utility: add margin to an existing BTC-PERP position.
// Usage: ADD_MARGIN_USD=73 LEV=15 node increase_position.mjs

import fs from 'fs';
import { Hyperliquid } from 'hyperliquid';

try {
  const envPath = new URL('./.env', import.meta.url).pathname;
  if (fs.existsSync(envPath)){
    const dotenv = await import('dotenv');
    dotenv.config({ path: envPath });
  }
} catch {}

const CONFIG_PATH = process.env.CONFIG || new URL('./config.json', import.meta.url).pathname;
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

if (process.env.HL_WALLET_ADDRESS) cfg.wallet.address = String(process.env.HL_WALLET_ADDRESS).trim();

function readSecretFromPath(p){
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return null; }
}

const pk = (
  (process.env.HL_PRIVATE_KEY && String(process.env.HL_PRIVATE_KEY).trim()) ||
  (process.env.HL_PRIVATE_KEY_PATH && readSecretFromPath(String(process.env.HL_PRIVATE_KEY_PATH).trim())) ||
  (cfg?.wallet?.privateKeyPath && readSecretFromPath(String(cfg.wallet.privateKeyPath).trim())) ||
  null
);

if (!pk) {
  console.error('Missing private key. Set HL_PRIVATE_KEY or HL_PRIVATE_KEY_PATH in .env');
  process.exit(1);
}

const sdk = new Hyperliquid({
  privateKey: pk,
  enableWs: false,
  testnet: false,
  walletAddress: cfg.wallet.address,
  disableAssetMapRefresh: true,
});

async function allMids(){
  const res = await fetch('https://api-ui.hyperliquid.xyz/info', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ type:'allMids' }) });
  return await res.json();
}

async function main(){
  const addMargin = Number(process.env.ADD_MARGIN_USD || '73');
  const lev = Number(process.env.LEV || '15');
  const addNotional = addMargin * lev;

  const mids = await allMids();
  const px = Number(mids.BTC || mids['BTC-PERP']);
  if (!px) throw new Error('no mid');

  const ch = await sdk.info.perpetuals.getClearinghouseState(cfg.wallet.address, true);
  const pos = (ch?.assetPositions||[]).map(p=>p.position).find(p=>p.coin===cfg.market.coin);
  const szi = Number(pos?.szi||0);
  if (!szi) throw new Error('no open BTC position');

  const side = szi > 0 ? 'long' : 'short';
  const isBuy = side === 'long';

  let addSz = addNotional / px;
  addSz = Number(addSz.toFixed(5));

  await sdk.exchange.updateLeverage('BTC-PERP', 'cross', lev);
  const slippage = 0.001;
  const resp = await sdk.custom.marketOpen('BTC-PERP', isBuy, addSz, px, slippage);

  console.log(JSON.stringify({ ok:true, side, addMargin, lev, px, addNotional, addSz, resp }, null, 2));
}

main().catch(e=>{ console.error('ERR', e?.message||e); process.exit(1); });
