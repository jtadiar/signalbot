// BTC15 Pair-Arb worker: non-directional cost-basis strategy on Polymarket BTC Up/Down 15m.
//
// Idea:
// - Accumulate BOTH sides over the window when each side is "cheap".
// - Target: avg(Up) + avg(Down) < 1.00 (minus a safety buffer for fees/slippage).
// - Once locked, stop trading the window.
//
// Usage:
//   cd apps/polymarket-trader
//   node src/btc15_pairarb_worker.js
//
// Secrets:
//   ~/.config/polymarket/trader.env
//
// Arming:
//   Uses ~/.config/polymarket/arm_until_ms (same as other workers).

const fs = require('fs');
const path = require('path');
const { makeClient, Side, OrderType } = require('./polymarket');
const { AssetType } = require('@polymarket/clob-client');
const { log } = require('./log');

function num(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function loadSecretsEnv(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const k = m[1];
    const v = m[2];
    if (!process.env[k]) process.env[k] = v;
  }
}

function armedUntilMs() {
  const p = path.join(process.env.HOME, '.config/polymarket/arm_until_ms');
  if (!fs.existsSync(p)) return 0;
  const until = Number(String(fs.readFileSync(p, 'utf8')).trim());
  return Number.isFinite(until) ? until : 0;
}
function isArmed(){ return armedUntilMs() > Date.now(); }

async function fetchJson(url, timeoutMs=8000){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchSeries(){
  return fetchJson('https://polymarket.com/api/series?slug=btc-up-or-down-15m');
}

async function fetchMarket(slug){
  return fetchJson(`https://polymarket.com/api/market?slug=${encodeURIComponent(slug)}`);
}

async function fetchBook(tokenId, timeoutMs=4000){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenId)}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`book ${res.status}`);
    return res.json();
  } finally { clearTimeout(t); }
}

function bestBidAsk(book){
  let bid = 0, ask = 0, bidSz = 0, askSz = 0;
  for (const lvl of (book?.bids || [])) {
    const p = num(lvl?.price);
    const s = num(lvl?.size);
    if (p > bid) { bid = p; bidSz = s; }
  }
  for (const lvl of (book?.asks || [])) {
    const p = num(lvl?.price);
    const s = num(lvl?.size);
    if (!ask || (p > 0 && p < ask)) { ask = p; askSz = s; }
  }
  const mid = bid && ask ? (bid + ask)/2 : 0;
  const spread = bid && ask ? (ask - bid) : 0;
  const relSpread = mid ? (spread / mid) : 0;
  return { bid, ask, mid, spread, relSpread, bidNotional: bid*bidSz, askNotional: ask*askSz };
}

const STATE_PATH = '/Users/jt/.openclaw/workspace/memory/btc15_pairarb_state.json';
function loadState(){
  try { return JSON.parse(fs.readFileSync(STATE_PATH,'utf8')); } catch { return { windows: {} }; }
}
function saveState(s){
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

function winState(state, slug){
  if (!state.windows) state.windows = {};
  if (!state.windows[slug]) {
    state.windows[slug] = {
      ts: new Date().toISOString(),
      up: { q: 0, cost: 0 },
      down: { q: 0, cost: 0 },
      spent: 0,
      orders: [],
      locked: false,
    };
  }
  return state.windows[slug];
}

function avgPrice(side){
  return (side.q > 0 && side.cost > 0) ? (side.cost / side.q) : 0;
}

function pairCost(w){
  const aU = avgPrice(w.up);
  const aD = avgPrice(w.down);
  if (!(aU > 0) || !(aD > 0)) return 0;
  return aU + aD;
}

function lockedProfitEstimate(w){
  // Locked (hedged) portion is min(qU, qD) shares.
  const m = Math.min(num(w.up.q), num(w.down.q));
  if (!(m > 0)) return 0;
  return m - (num(w.up.cost) + num(w.down.cost));
}

async function main(){
  // Secrets/config file for this worker.
  // Default: ~/.config/polymarket/pairarb.env (so it can use a separate wallet)
  // Fallback: ~/.config/polymarket/trader.env
  const secretsPath = process.env.PAIRARB_ENV_PATH
    ? String(process.env.PAIRARB_ENV_PATH)
    : path.join(process.env.HOME, '.config/polymarket/pairarb.env');
  const fallbackSecretsPath = path.join(process.env.HOME, '.config/polymarket/trader.env');
  if (fs.existsSync(secretsPath)) loadSecretsEnv(secretsPath);
  else if (fs.existsSync(fallbackSecretsPath)) loadSecretsEnv(fallbackSecretsPath);

  const signatureType = Number(process.env.SIGNATURE_TYPE ?? 0);
  const funder = process.env.FUNDER_ADDRESS;
  const { client, address } = await makeClient({ host: 'https://clob.polymarket.com', chainId: 137, privateKey: process.env.POLYMARKET_PRIVATE_KEY, signatureType, funder });

  // Budget per 15m window (USDC). This is the main control knob.
  const windowBudget = num(process.env.PAIRARB_WINDOW_BUDGET_USDC || '10');
  const sliceNotional = num(process.env.PAIRARB_SLICE_USDC || '2.5');
  const maxEntryPrice = num(process.env.PAIRARB_MAX_ENTRY_PRICE || process.env.MAX_ENTRY_PRICE || '0.78');

  // Pair-arb controls
  // - We only "seed" a first leg when ask is genuinely cheap (prevents digging a hole)
  // - After we have both legs, only trade if pairCost improves by a minimum step
  const seedMaxAsk = num(process.env.PAIRARB_SEED_MAX_ASK || '0.45');
  const minImprovement = num(process.env.PAIRARB_MIN_IMPROVEMENT || '0.002');
  const maxOverhangShares = num(process.env.PAIRARB_MAX_OVERHANG_SHARES || '5');

  // Safety buffer below 1.00 to account for fees/slippage.
  const targetPairCost = num(process.env.PAIRARB_TARGET_PAIR_COST || '0.985');

  // Book quality.
  const maxRelSpread = num(process.env.PAIRARB_MAX_REL_SPREAD || '0.10');
  const minTopDepthUsdc = num(process.env.PAIRARB_MIN_TOP_DEPTH_USDC || '150');

  // Timing gates
  const startAfterMin = num(process.env.PAIRARB_START_AFTER_MIN || '5'); // minutes after window start
  const latestToEndSec = num(process.env.PAIRARB_LATEST_ENTRY_TO_END_SEC || '120');
  const pollMs = num(process.env.PAIRARB_POLL_MS || '4000');

  // Balance kill-switch (shared semantics with BTC15 worker).
  const minBalanceUsdc = num(process.env.MIN_BALANCE_USDC || '0');
  const stopAction = String(process.env.BALANCE_STOP_ACTION || 'skip').toLowerCase();

  log.info({
    address,
    armed: isArmed(),
    armedUntil: new Date(armedUntilMs()).toISOString(),
    pairArb: { windowBudget, sliceNotional, maxEntryPrice, targetPairCost, maxRelSpread, minTopDepthUsdc, latestToEndSec, pollMs },
    kill: { minBalanceUsdc, stopAction },
  }, 'BTC15_PAIRARB_START');

  const state = loadState();

  while (true) {
    if (!isArmed()) {
      log.warn('Disarmed; exiting worker.');
      break;
    }

    // Kill switch on cash collateral.
    if (minBalanceUsdc > 0) {
      try {
        const ba = await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
        const bal = num(ba?.balance) / 1e6;
        if (bal > 0 && bal < minBalanceUsdc) {
          log.warn({ bal, minBalanceUsdc, stopAction }, 'PAIRARB_BALANCE_TOO_LOW');
          if (stopAction === 'exit') process.exit(0);
          await sleep(10_000);
          continue;
        }
      } catch (e) {
        log.warn({ err: String(e) }, 'PAIRARB_BALANCE_CHECK_FAILED');
      }
    }

    // Determine current 15m window.
    let series;
    try { series = await fetchSeries(); } catch (e) {
      log.warn({ err: String(e) }, 'PAIRARB_FETCH_SERIES_FAILED');
      await sleep(2000);
      continue;
    }

    const now = Date.now();
    const ev = (series.events||[])
      .filter(e=>e.active && !e.closed && !e.archived)
      .map(e=>({ slug: e.slug, endMs: Date.parse(e.endDate||e.endDateIso||''), endDate: e.endDate }))
      .filter(e=>Number.isFinite(e.endMs))
      .sort((a,b)=>a.endMs-b.endMs);

    const cur = ev.find(e=> now < e.endMs);
    if (!cur) { await sleep(5000); continue; }

    const startMs = cur.endMs - 15*60*1000;
    const msLeft = cur.endMs - now;

    // Don't start too early in the window (avoid reset noise / thin books).
    if (startAfterMin > 0 && now < (startMs + startAfterMin*60*1000)) {
      await sleep(Math.min(5000, pollMs));
      continue;
    }

    // Don't initiate new entries too close to window end.
    if (msLeft < latestToEndSec*1000) {
      await sleep(Math.min(5000, pollMs));
      continue;
    }

    const w = winState(state, cur.slug);

    // Stop if locked (we don't add more risk once we have edge).
    const pc = pairCost(w);
    const lockedEst = lockedProfitEstimate(w);
    if (pc > 0 && pc <= targetPairCost) {
      if (!w.locked) {
        w.locked = true;
        saveState(state);
        log.warn({ slug: cur.slug, pairCost: +pc.toFixed(4), targetPairCost, lockedProfitEst: +lockedEst.toFixed(3) }, 'PAIRARB_LOCKED_STOP_TRADING_WINDOW');
      }
      await sleep(Math.min(5000, pollMs));
      continue;
    }

    if (w.spent >= windowBudget) {
      log.warn({ slug: cur.slug, spent: +w.spent.toFixed(2), windowBudget }, 'PAIRARB_BUDGET_REACHED');
      await sleep(Math.min(5000, pollMs));
      continue;
    }

    // Fetch market and books.
    let market;
    try { market = await fetchMarket(cur.slug); } catch (e) {
      log.warn({ slug: cur.slug, err: String(e) }, 'PAIRARB_FETCH_MARKET_FAILED');
      await sleep(1500);
      continue;
    }

    const outcomes = market.outcomes || ['Up','Down'];
    const tokenIds = market.clobTokenIds || [];
    if (tokenIds.length < 2) {
      log.warn({ slug: cur.slug }, 'PAIRARB_MISSING_TOKEN_IDS');
      await sleep(1500);
      continue;
    }

    let b0,b1;
    try { [b0,b1] = await Promise.all([fetchBook(tokenIds[0]), fetchBook(tokenIds[1])]); }
    catch (e) { log.warn({ slug: cur.slug, err: String(e) }, 'PAIRARB_BOOK_FETCH_FAILED'); await sleep(1000); continue; }

    const sUp = bestBidAsk(b0);
    const sDown = bestBidAsk(b1);

    // Basic book gates.
    if (!(sUp.ask > 0 && sDown.ask > 0)) { await sleep(pollMs); continue; }
    if (sUp.relSpread > maxRelSpread || sDown.relSpread > maxRelSpread) { await sleep(pollMs); continue; }
    if (sUp.askNotional < minTopDepthUsdc || sDown.askNotional < minTopDepthUsdc) { await sleep(pollMs); continue; }

    // Decide which side to add.
    // Rules:
    // - Avoid building a huge unhedged overhang.
    // - Seed first leg only when it's genuinely cheap.
    // - Once both legs exist, only trade if it improves pairCost by minImprovement.
    const qU = num(w.up.q);
    const qD = num(w.down.q);
    const haveUp = qU > 0;
    const haveDown = qD > 0;
    const haveBoth = haveUp && haveDown;

    // Overhang guard: if one side leads by too many shares, only consider buying the other.
    const overhang = qU - qD; // + means Up heavy

    let pick;
    if (Math.abs(overhang) >= maxOverhangShares && maxOverhangShares > 0) {
      pick = overhang > 0 ? 'Down' : 'Up';
    } else {
      // Default: buy the underweight side; if balanced, buy the cheaper ask.
      if (qU > qD + 1e-9) pick = 'Down';
      else if (qD > qU + 1e-9) pick = 'Up';
      else pick = (sDown.ask < sUp.ask) ? 'Down' : 'Up';
    }

    const ask = pick === 'Up' ? sUp.ask : sDown.ask;
    const bid = pick === 'Up' ? sUp.bid : sDown.bid;

    // Maker bidding: we place post-only BUYs at (or below) best bid to avoid crossing spread.
    // If there's no real bid, skip (don't pay the ask).
    if (!(bid > 0 && bid < 1) || !(ask > 0 && ask < 1) || bid >= ask) {
      log.debug({ slug: cur.slug, pick, bid, ask, note: 'BAD_BOOK_FOR_MAKER' }, 'PAIRARB_SKIP_BOOK');
      await sleep(pollMs);
      continue;
    }

    const price = bid;

    // General price cap (based on what we are willing to pay as maker).
    if (price > maxEntryPrice) {
      log.info({ slug: cur.slug, pick, price, maxEntryPrice, qU, qD, pairCost: pc || null }, 'PAIRARB_SKIP_PRICE');
      await sleep(pollMs);
      continue;
    }

    // Seed gate: if we DON'T yet have both legs, only seed when price is cheap enough.
    if (!haveBoth && price > seedMaxAsk) {
      log.info({ slug: cur.slug, pick, price, seedMaxAsk, haveUp, haveDown, note: 'SEED_TOO_EXPENSIVE' }, 'PAIRARB_SKIP_SEED');
      await sleep(pollMs);
      continue;
    }

    // Simulate if adding this slice improves pair cost meaningfully.
    const spend = Math.min(sliceNotional, Math.max(0, windowBudget - w.spent));
    const addQ = spend / price;

    // New averages if we add to one side.
    const up2 = { q: qU, cost: num(w.up.cost) };
    const dn2 = { q: qD, cost: num(w.down.cost) };
    if (pick === 'Up') { up2.q += addQ; up2.cost += spend; }
    else { dn2.q += addQ; dn2.cost += spend; }

    const avgU2 = avgPrice(up2);
    const avgD2 = avgPrice(dn2);
    const pc2 = (avgU2 > 0 && avgD2 > 0) ? (avgU2 + avgD2) : 0;

    // Improvement gate: once both legs exist, only trade when it improves pairCost.
    if (haveBoth) {
      const ok = (pc2 > 0) && (pc === 0 || pc2 <= targetPairCost || pc2 < (pc - minImprovement));
      if (!ok) {
        log.debug({ slug: cur.slug, pick, pc, pc2, minImprovement, targetPairCost, avgU: avgPrice(w.up), avgD: avgPrice(w.down), price, bid, ask, spend }, 'PAIRARB_SKIP_NO_IMPROVEMENT');
        await sleep(pollMs);
        continue;
      }
    }

    // Execute BUY at ask (simple, fill-seeking). Conservative order type: GTC.
    const tokenID = pick === 'Up' ? tokenIds[0] : tokenIds[1];

    // Enforce market minimum size (CLOB rejects too-small orders; observed min is 5 shares on BTC15).
    const minSize = num(process.env.PAIRARB_MIN_SIZE || '5');
    const size = Math.max(minSize, Math.floor(addQ * 100) / 100); // 2 decimals

    try {
      const tickSize = await Promise.race([client.getTickSize(tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
      const negRisk = await Promise.race([client.getNegRisk(tokenID), sleep(4000).then(()=>{ throw new Error('negRisk timeout'); })]);

      log.info({ slug: cur.slug, pick, outcome: pick, tokenID, price, bid, ask, postOnly: true, size, spendMax: +spend.toFixed(3), estNotional: +(price*size).toFixed(3), pc, pc2, targetPairCost }, 'PAIRARB_ORDER_ATTEMPT');

      const resp = await Promise.race([
        client.createAndPostOrder({ tokenID, side: Side.BUY, price, size }, { tickSize, negRisk }, OrderType.GTC, false, true),
        sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
      ]);

      const st = String(resp?.status || '').toLowerCase();
      if (!resp?.orderID || !(st === 'matched' || st === 'live')) {
        log.warn({ slug: cur.slug, resp }, 'PAIRARB_ORDER_REJECTED');
        await sleep(pollMs);
        continue;
      }

      // Best-effort: treat matched/live as executed; update cost/qty by intended amounts.
      // NOTE: for production we should reconcile fills; keep this worker conservative with small slices.
      const filledQ = size;
      const filledCost = price * filledQ;

      if (pick === 'Up') { w.up.q += filledQ; w.up.cost += filledCost; }
      else { w.down.q += filledQ; w.down.cost += filledCost; }
      w.spent += filledCost;
      w.orders.push({ ts: new Date().toISOString(), pick, tokenID, price: ask, size: filledQ, orderID: resp.orderID, status: resp.status });

      // Append to shared trades log so pinger can alert.
      try {
        fs.appendFileSync('/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl', JSON.stringify({ ts: new Date().toISOString(), series: 'btc-up-or-down-15m', event: cur.slug, action: 'BUY_PAIRARB', outcome: pick, tokenID, price, bid, ask, postOnly: true, size: filledQ, estNotional: filledCost, orderID: resp.orderID, status: resp.status }) + '\n');
      } catch {}

      saveState(state);
      log.info({ slug: cur.slug, spent: +w.spent.toFixed(2), windowBudget, avgUp: +avgPrice(w.up).toFixed(4), avgDown: +avgPrice(w.down).toFixed(4), pairCost: +(pairCost(w)||0).toFixed(4), lockedProfitEst: +lockedProfitEstimate(w).toFixed(3) }, 'PAIRARB_STATE');

    } catch (e) {
      log.warn({ slug: cur.slug, err: String(e) }, 'PAIRARB_ORDER_FAILED');
    }

    await sleep(pollMs);
  }

  log.info('BTC15_PAIRARB_END');
}

main().catch((e) => {
  log.error({ err: String(e), stack: e?.stack }, 'BTC15_PAIRARB_CRASH');
  process.exit(1);
});
