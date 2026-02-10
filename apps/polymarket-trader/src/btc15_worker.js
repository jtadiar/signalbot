// Dedicated BTC15 worker: deterministic scheduling + persistent per-window state.
// Goal: ALWAYS attempt a trade at T+5 of each active window.
//
// Usage:
//   node src/btc15_worker.js

const fs = require('fs');
const path = require('path');
const { makeClient, Side, OrderType } = require('./polymarket');
const { AssetType } = require('@polymarket/clob-client');
const { log } = require('./log');

function num(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

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

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

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
  // Polymarket book arrays are not guaranteed to be sorted the way we want.
  // Compute best bid (max price) + best ask (min price).
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
  const spread = bid && ask ? (ask-bid) : 0;
  const mid = bid && ask ? (ask+bid)/2 : 0;
  return { bid, ask, mid, spread, bidNotional: bid*bidSz, askNotional: ask*askSz };
}

function depthNotionalTopAsks(book, maxLevels=5){
  const asks = (book?.asks || [])
    .map(l=>({ p: num(l?.price), s: num(l?.size) }))
    .filter(l=>l.p > 0 && l.s > 0)
    .sort((a,b)=>a.p-b.p)
    .slice(0, maxLevels);
  return asks.reduce((acc, l)=> acc + (l.p * l.s), 0);
}

const STATE_PATH = '/Users/jt/.openclaw/workspace/memory/btc15_worker_state.json';
function loadState(){
  try { return JSON.parse(fs.readFileSync(STATE_PATH,'utf8')); } catch { return { traded: {}, baseline: {} }; }
}
function saveState(s){
  fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

function relSpread(stats){
  return stats.mid ? (stats.spread / stats.mid) : 0;
}

async function main(){
  const secretsPath = path.join(process.env.HOME, '.config/polymarket/trader.env');
  if (fs.existsSync(secretsPath)) loadSecretsEnv(secretsPath);

  const signatureType = Number(process.env.SIGNATURE_TYPE ?? 0);
  const funder = process.env.FUNDER_ADDRESS;
  const { client, address } = await makeClient({ host: 'https://clob.polymarket.com', chainId: 137, privateKey: process.env.POLYMARKET_PRIVATE_KEY, signatureType, funder });

  const baseNotional = num(process.env.BTC15_BASE_NOTIONAL_USDC || '5');
  const maxOrder = num(process.env.MAX_ORDER_USDC || '10');
  const maxEntryPrice = num(process.env.MAX_ENTRY_PRICE || '0.65');
  const maxRelSpread = num(process.env.MAX_REL_SPREAD || '0.08');
  const minDepthUsdc = num(process.env.MIN_DEPTH_USDC || '150');
  const entryScanMs = num(process.env.ENTRY_SCAN_MS || '4000');
  const latestEntryToEndSec = num(process.env.LATEST_ENTRY_TO_END_SEC || '90');
  const entryMode = String(process.env.ENTRY_MODE || 't5').toLowerCase(); // t5 | t10 | opportunistic
  const minBalanceUsdc = num(process.env.MIN_BALANCE_USDC || '0'); // stop trading if balance falls below this
  const secondCheckMin = num(process.env.SECOND_CHECK_MIN || '0'); // e.g. 10 => second tranche at T+10
  const secondCheckAlways = String(process.env.SECOND_CHECK_ALWAYS || '0') === '1'; // if 1, run second tranche even if first traded

  // Per-attempt sizing (J):
  // - T+5: $10 only when criteria met, otherwise fall back to $5
  // - T+SECOND_CHECK_MIN: add $5 if conditions ok
  const t5NotionalBig = num(process.env.T5_NOTIONAL_USDC_BIG || process.env.T5_NOTIONAL_USDC || '10');
  const t5NotionalSmall = num(process.env.T5_NOTIONAL_USDC_SMALL || '5');
  const secondNotional = num(process.env.SECOND_NOTIONAL_USDC || '5');

  // T+5 “big entry” criteria (env-tunable)
  const t5BigConf = num(process.env.T5_BIG_CONF || '90');
  const t5BigMinDelta = num(process.env.T5_BIG_MIN_DELTA || '0.06');
  const t5BigMaxSpread = num(process.env.T5_BIG_MAX_SPREAD || '0.018');
  const t5BigMinDepth = num(process.env.T5_BIG_MIN_DEPTH_USDC || '5000');
  const t5BigMaxAsk = num(process.env.T5_BIG_MAX_ASK || '0.70');
  const tier1Notional = num(process.env.BTC15_NOTIONAL_TIER_1 || '10');
  const tier1Conf = num(process.env.BTC15_CONF_TIER_1 || '70');
  const tier2Notional = num(process.env.BTC15_NOTIONAL_TIER_2 || '15');
  const tier2Conf = num(process.env.BTC15_CONF_TIER_2 || '85');
  const tier3Notional = num(process.env.BTC15_NOTIONAL_TIER_3 || '25');
  const tier3Conf = num(process.env.BTC15_CONF_TIER_3 || '95');
  const minDeltaForScale = num(process.env.BTC15_MIN_DELTA_FOR_SCALE || '0.10');
  const t5RetryMs = num(process.env.T5_RETRY_BEFORE_FALLBACK_MS || '20000');
  const t5RecheckSec = num(process.env.T5_RECHECK_SEC || '60'); // J: recheck once between T+5 and T+6
  const fallbackPrice = num(process.env.T5_FALLBACK_LIMIT_PRICE || '0.99');
  const forceSideMode = String(process.env.FORCE_SIDE_MODE || 'trend').toLowerCase();
  const trendDeadzone = num(process.env.TREND_DEADZONE || '0.005');
  // Exit rules (J):
  // - CAP_EXIT: if best bid is close to 1.00, exit fully (bounded payoff; don't "ride the window")
  // - TP_HARD: if profit >= +90%, sell 100% remaining (hard rule)
  // - TP1: sell 50% at +50%
  // - TP2: sell 100% remaining at +75%
  // - SL: sell 50% at -50% (partial cut)
  const capExitBid = num(process.env.CAP_EXIT_BID || '0.95');
  const tpHardPct = num(process.env.TP_HARD_PCT || '0.90');
  const tp1Pct = num(process.env.TP1_PCT || '0.50');
  const tp1SellFrac = num(process.env.TP1_SELL_FRAC || '0.50');
  const tp2Pct = num(process.env.TP2_PCT || '0.75');
  const tp2SellFrac = num(process.env.TP2_SELL_FRAC || '1.00');
  const slPct = num(process.env.SL_PCT || '0.50');
  const slSellFrac = num(process.env.SL_SELL_FRAC || '0.50');
  const exitPollMs = num(process.env.EXIT_POLL_MS || '4000');
  const addOnProfitPct = num(process.env.ADD_ON_PROFIT_PCT || '0.30');
  const addOnNotional = num(process.env.ADD_ON_NOTIONAL_USDC || '5');
  const addOnTimeToEndSec = num(process.env.ADD_ON_TIME_TO_END_SEC || '300');

  // When trend-vs-baseline is flat (inside deadzone), we use spot momentum to break ties.
  // Default: last 3 minutes of Coinbase BTC-USD 1m candles.
  const spotMomentumMin = num(process.env.SPOT_MOMENTUM_MIN || '3');
  const spotMomentumDeadzone = num(process.env.SPOT_MOMENTUM_DEADZONE || '0.0002'); // 2 bps

  async function fetchCoinbase1mCandles(limit=3){
    const url = `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60&limit=${encodeURIComponent(limit)}`;
    return fetchJson(url, 6000);
  }

  async function spotMomentumPick(){
    // Returns { pick, ret } where pick: 0=Up,1=Down
    const n = Math.max(1, Math.min(15, Math.floor(spotMomentumMin)));
    const candles = await fetchCoinbase1mCandles(n);
    // Coinbase returns: [ time, low, high, open, close, volume ]
    const rows = Array.isArray(candles) ? candles : [];
    if (rows.length < 1) throw new Error('no candles');
    // Sort oldest->newest by time
    rows.sort((a,b)=> num(a?.[0]) - num(b?.[0]));
    const firstOpen = num(rows[0]?.[3]);
    const lastClose = num(rows[rows.length-1]?.[4]);
    if (!(firstOpen > 0 && lastClose > 0)) throw new Error('bad candle');
    const ret = (lastClose / firstOpen) - 1;
    if (Math.abs(ret) <= spotMomentumDeadzone) return { pick: null, ret };
    return { pick: ret > 0 ? 0 : 1, ret };
  }

  log.info({ address, baseNotional, maxOrder, maxEntryPrice, entryMode, exits: { tpHardPct, tp1Pct, tp1SellFrac, tp2Pct, tp2SellFrac, slPct, slSellFrac }, spotMomentumMin, spotMomentumDeadzone, armed: isArmed(), armedUntil: new Date(armedUntilMs()).toISOString() }, 'BTC15_WORKER_START');

  const state = loadState();

  while (isArmed()) {
    // 1) Determine current window + T+5 target.
    let series;
    try { series = await fetchSeries(); } catch (e) {
      log.warn({ err: String(e) }, 'FETCH_SERIES_FAILED');
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
    const t5Ms = startMs + 5*60*1000;
    const t5RecheckMs = t5Ms + (t5RecheckSec*1000);
    const t10Ms = startMs + 10*60*1000;
    const t8Ms = startMs + 8*60*1000;
    const tEntryMs = (entryMode === 't10') ? t10Ms : t5Ms;
    const tSecondMs = (secondCheckMin > 0) ? (startMs + secondCheckMin*60*1000) : 0;

    // 2) Capture baseline early in the window (used for trend-vs-baseline side selection).
    // We take one snapshot per window and persist it to disk.
    if (!state.baseline) state.baseline = {};
    if (!state.baseline[cur.slug] && now > startMs + 2000 && now < tEntryMs - 2000) {
      try {
        const market0 = await fetchMarket(cur.slug);
        const tokenIds0 = market0.clobTokenIds || [];
        if (tokenIds0.length >= 2) {
          const [bb0, bb1] = await Promise.all([fetchBook(tokenIds0[0]), fetchBook(tokenIds0[1])]);
          const ss0 = bestBidAsk(bb0);
          const ss1 = bestBidAsk(bb1);
          if (ss0.mid > 0 && ss1.mid > 0) {
            state.baseline[cur.slug] = {
              ts: new Date().toISOString(),
              upMid: ss0.mid,
              downMid: ss1.mid,
              upAsk: ss0.ask,
              downAsk: ss1.ask,
            };
            saveState(state);
            log.info({ slug: cur.slug, baseline: state.baseline[cur.slug] }, 'BTC15_BASELINE_SET');
          }
        }
      } catch (e) {
        log.warn({ slug: cur.slug, err: String(e) }, 'BTC15_BASELINE_SET_FAILED');
      }
    }

    // 3) If already traded this window, only start monitoring exits AFTER entry attempts are done.
    // This allows a second tranche (e.g. T+10) even if we already bought at T+5.
    let allowSecondEntry = false;
    if (state.traded?.[cur.slug]) {
      const t = state.traded[cur.slug];
      const attempts = t?.attempts || {};
      const secondDue = (entryMode === 't5' && secondCheckMin > 0);
      const secondPending = secondDue && !attempts.second;
      const secondAtMs = (cur.endMs - 15*60*1000) + (secondCheckMin*60*1000);
      const isLiveUnfilled = (String(t?.status || '').toLowerCase() === 'live') && !(num(t?.filledSize) > 0);
      const canStillSecond = secondPending && (secondCheckAlways || (!t?.orderID) || isLiveUnfilled);

      const recheckDue = (entryMode === 't5' && t5RecheckSec > 0);
      const recheckPending = recheckDue && !attempts.t5re;
      const canStillRecheck = recheckPending && (!t?.orderID);

      // If we still have a T+5 recheck pending and it's not time yet, wait.
      if (canStillRecheck && Date.now() < t5RecheckMs - 1500) {
        await sleep(2000);
        continue;
      }

      // If recheck is due now, fall through to entry logic.
      if (canStillRecheck && Date.now() >= t5RecheckMs - 1500) {
        allowSecondEntry = true;
      }

      // If we still have a second tranche pending and it's not time yet, wait.
      if (!allowSecondEntry && canStillSecond && Date.now() < secondAtMs - 1500) {
        await sleep(2000);
        continue;
      }

      // If second tranche is due now, fall through to entry logic.
      if (!allowSecondEntry && canStillSecond && Date.now() >= secondAtMs - 1500) {
        allowSecondEntry = true;
      }

      // Otherwise, proceed to exit monitoring as before.
      if (!allowSecondEntry && !t?.skipped && t?.tokenID && t?.refAsk && t?.size) {
        const entryPx = (t.fillPrice && t.fillPrice > 0) ? t.fillPrice : t.refAsk;
        try {
          const book = await fetchBook(t.tokenID);
          const stats = bestBidAsk(book);
          const bid = num(stats.bid);
          const ask = num(stats.ask);
          const mid = num(stats.mid);
          const spreadRel = relSpread(stats);
          const saneBook = (bid > 0.05) && (ask > 0) && (mid > 0) && (spreadRel < 0.20);
          // For stop-loss we allow thinner books (capital preservation), but still require a real bid.
          const saneBookForSL = (bid > 0) && (ask > 0) && (mid > 0) && (spreadRel < 0.80);

          const soldFrac = num(t?.exit?.soldFrac || 0);
          const baseSize = num(t.filledSize || t.size); // use filled size if known to avoid overselling
          const remainingFrac = Math.max(0, 1 - soldFrac);
          const remainingSize = Math.floor((baseSize * remainingFrac) * 100) / 100;
          const profitPct = (bid > 0 && entryPx > 0) ? (bid / entryPx - 1) : 0;

          // Cap-aware exit: when bid is close to $1, upside is capped but downside isn't.
          // Example: bought at 0.64; if bid is 0.95 you have ~5c upside left and huge tail risk.
          if (saneBook && remainingSize > 0.01 && bid >= capExitBid && !t?.exit?.capExitDone) {
            const sellSize = remainingSize;
            const tickSize2 = await Promise.race([client.getTickSize(t.tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
            const negRisk2 = await Promise.race([client.getNegRisk(t.tokenID), sleep(4000).then(()=>{ throw new Error('negRisk timeout'); })]);
            log.warn({ slug: cur.slug, outcome: t.outcome, tokenID: t.tokenID, entryPx, bid, capExitBid, sellSize }, 'BTC15_CAP_EXIT_TRIGGER');
            const sellResp = await Promise.race([
              client.createAndPostOrder({ tokenID: t.tokenID, side: Side.SELL, price: bid, size: sellSize }, { tickSize: tickSize2, negRisk: negRisk2 }, OrderType.GTC),
              sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
            ]);
            const st = String(sellResp?.status || '').toLowerCase();
            if (sellResp?.orderID && (st === 'matched' || st === 'live')) {
              t.exit = { ...(t.exit||{}), capExitDone: true, soldFrac: 1, last: { kind:'CAP_EXIT', ts:new Date().toISOString(), orderID: sellResp?.orderID, status: sellResp?.status, price: bid, size: sellSize } };
              saveState(state);
            } else {
              log.warn({ slug: cur.slug, resp: sellResp }, 'BTC15_CAP_EXIT_BAD_RESPONSE');
            }
            try { fs.appendFileSync('/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl', JSON.stringify({ ts:new Date().toISOString(), series:'btc-up-or-down-15m', event: cur.slug, action:'SELL_TP', tpLevel:'CAP_EXIT', outcome:t.outcome, tokenID:t.tokenID, price: bid, size: sellSize, orderID: sellResp?.orderID, status: sellResp?.status })+'\n'); } catch {}
          }

          // Hard take-profit: if we are very close to max profit, exit fully.
          // Motivation (J): avoid giving back a near-max winner by riding the rest of the window.
          if (saneBook && remainingSize > 0.01 && profitPct >= tpHardPct && !t?.exit?.tpHardDone && !t?.exit?.capExitDone) {
            const sellSize = remainingSize;
            const tickSize2 = await Promise.race([client.getTickSize(t.tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
            const negRisk2 = await Promise.race([client.getNegRisk(t.tokenID), sleep(4000).then(()=>{ throw new Error('negRisk timeout'); })]);
            log.warn({ slug: cur.slug, outcome: t.outcome, tokenID: t.tokenID, entryPx, bid, profitPct:+profitPct.toFixed(3), sellSize }, 'BTC15_TP_HARD_TRIGGER');
            const sellResp = await Promise.race([
              client.createAndPostOrder({ tokenID: t.tokenID, side: Side.SELL, price: bid, size: sellSize }, { tickSize: tickSize2, negRisk: negRisk2 }, OrderType.GTC),
              sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
            ]);
            const st = String(sellResp?.status || '').toLowerCase();
            if (sellResp?.orderID && (st === 'matched' || st === 'live')) {
              t.exit = { ...(t.exit||{}), tpHardDone: true, soldFrac: 1, last: { kind:'TP_HARD', ts:new Date().toISOString(), orderID: sellResp?.orderID, status: sellResp?.status, price: bid, size: sellSize } };
              saveState(state);
            } else {
              log.warn({ slug: cur.slug, resp: sellResp }, 'BTC15_TP_HARD_BAD_RESPONSE');
            }
            try { fs.appendFileSync('/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl', JSON.stringify({ ts:new Date().toISOString(), series:'btc-up-or-down-15m', event: cur.slug, action:'SELL_TP', tpLevel:'HARD', outcome:t.outcome, tokenID:t.tokenID, price: bid, size: sellSize, orderID: sellResp?.orderID, status: sellResp?.status })+'\n'); } catch {}
          }

          if (saneBook && remainingSize > 0.01 && profitPct >= tp2Pct && !t?.exit?.tp2Done && !t?.exit?.tpHardDone && !t?.exit?.capExitDone) {
            const sellSize = remainingSize;
            const tickSize2 = await Promise.race([client.getTickSize(t.tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
            const negRisk2 = await Promise.race([client.getNegRisk(t.tokenID), sleep(4000).then(()=>{ throw new Error('negRisk timeout'); })]);
            log.warn({ slug: cur.slug, outcome: t.outcome, tokenID: t.tokenID, entryPx, bid, profitPct:+profitPct.toFixed(3), sellSize }, 'BTC15_TP2_TRIGGER');
            const sellResp = await Promise.race([
              client.createAndPostOrder({ tokenID: t.tokenID, side: Side.SELL, price: bid, size: sellSize }, { tickSize: tickSize2, negRisk: negRisk2 }, OrderType.GTC),
              sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
            ]);
            const st = String(sellResp?.status || '').toLowerCase();
            if (sellResp?.orderID && (st === 'matched' || st === 'live')) {
              t.exit = { ...(t.exit||{}), tp2Done: true, soldFrac: 1, last: { kind:'TP2', ts:new Date().toISOString(), orderID: sellResp?.orderID, status: sellResp?.status, price: bid, size: sellSize } };
              saveState(state);
            } else {
              log.warn({ slug: cur.slug, resp: sellResp }, 'BTC15_TP2_BAD_RESPONSE');
            }
            try { fs.appendFileSync('/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl', JSON.stringify({ ts:new Date().toISOString(), series:'btc-up-or-down-15m', event: cur.slug, action:'SELL_TP', tpLevel:2, outcome:t.outcome, tokenID:t.tokenID, price: bid, size: sellSize, orderID: sellResp?.orderID, status: sellResp?.status })+'\n'); } catch {}
          }

          if (saneBook && remainingSize > 0.01 && profitPct >= tp1Pct && !t?.exit?.tp1Done && !t?.exit?.capExitDone) {
            const sellSize = Math.max(0.01, Math.floor((num(t.size) * tp1SellFrac) * 100) / 100);
            const tickSize2 = await Promise.race([client.getTickSize(t.tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
            const negRisk2 = await Promise.race([client.getNegRisk(t.tokenID), sleep(4000).then(()=>{ throw new Error('negRisk timeout'); })]);
            log.warn({ slug: cur.slug, outcome: t.outcome, tokenID: t.tokenID, entryPx, bid, profitPct:+profitPct.toFixed(3), sellSize }, 'BTC15_TP1_TRIGGER');
            const sellResp = await Promise.race([
              client.createAndPostOrder({ tokenID: t.tokenID, side: Side.SELL, price: bid, size: sellSize }, { tickSize: tickSize2, negRisk: negRisk2 }, OrderType.GTC),
              sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
            ]);
            const st = String(sellResp?.status || '').toLowerCase();
            if (sellResp?.orderID && (st === 'matched' || st === 'live')) {
              const newSoldFrac = Math.min(1, soldFrac + tp1SellFrac);
              t.exit = { ...(t.exit||{}), tp1Done: true, soldFrac: newSoldFrac, last: { kind:'TP1', ts:new Date().toISOString(), orderID: sellResp?.orderID, status: sellResp?.status, price: bid, size: sellSize } };
              saveState(state);
            } else {
              log.warn({ slug: cur.slug, resp: sellResp }, 'BTC15_TP1_BAD_RESPONSE');
            }
            try { fs.appendFileSync('/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl', JSON.stringify({ ts:new Date().toISOString(), series:'btc-up-or-down-15m', event: cur.slug, action:'SELL_TP', tpLevel:1, outcome:t.outcome, tokenID:t.tokenID, price: bid, size: sellSize, orderID: sellResp?.orderID, status: sellResp?.status })+'\n'); } catch {}
          }

          // Stop-loss scan: continuously during the last 5 minutes of the window (T+10 to close) (J).
          // Mid-based trigger, execute sells at best bid.
          const slStartMs = cur.endMs - 5*60*1000; // last 5 minutes
          const slDue = Date.now() >= (slStartMs - 1500);

          const lossPct = (mid > 0 && entryPx > 0) ? (mid / entryPx - 1) : 0;

          // Escalation rule (capital preservation):
          // - If loss <= -70% => sell 100% remaining
          // - Else if loss <= -50% => sell 50% once
          const slHardPct = num(process.env.SL_HARD_PCT || '0.70');
          const hardTriggered = lossPct <= -slHardPct;
          const softTriggered = lossPct <= -slPct;

          if (slDue && saneBookForSL && remainingSize > 0.01) {
            if (hardTriggered && !t?.exit?.slHardDone) {
              const sellSize = Math.max(0.01, Math.floor(remainingSize * 100) / 100);
              const tickSize2 = await Promise.race([client.getTickSize(t.tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
              const negRisk2 = await Promise.race([client.getNegRisk(t.tokenID), sleep(4000).then(()=>{ throw new Error('negRisk timeout'); })]);
              log.warn({ slug: cur.slug, outcome: t.outcome, tokenID: t.tokenID, entryPx, bid, mid, lossPct:+lossPct.toFixed(3), sellSize, kind:'SL_HARD' }, 'BTC15_SL_TRIGGER');
              const sellResp = await Promise.race([
                client.createAndPostOrder({ tokenID: t.tokenID, side: Side.SELL, price: bid, size: sellSize }, { tickSize: tickSize2, negRisk: negRisk2 }, OrderType.GTC),
                sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
              ]);
              t.exit = { ...(t.exit||{}), slHardDone: true, slDone: true, soldFrac: 1, last: { kind:'SL_HARD', ts:new Date().toISOString(), orderID: sellResp?.orderID, status: sellResp?.status, price: bid, size: sellSize } };
              saveState(state);
              try { fs.appendFileSync('/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl', JSON.stringify({ ts:new Date().toISOString(), series:'btc-up-or-down-15m', event: cur.slug, action:'SELL_SL', outcome:t.outcome, tokenID:t.tokenID, price: bid, size: sellSize, orderID: sellResp?.orderID, status: sellResp?.status, kind:'SL_HARD' })+'\n'); } catch {}
            } else if (softTriggered && !t?.exit?.slDone) {
              const sellSize = Math.max(0.01, Math.floor((num(t.size) * slSellFrac) * 100) / 100);
              const tickSize2 = await Promise.race([client.getTickSize(t.tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
              const negRisk2 = await Promise.race([client.getNegRisk(t.tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
              log.warn({ slug: cur.slug, outcome: t.outcome, tokenID: t.tokenID, entryPx, bid, mid, lossPct:+lossPct.toFixed(3), sellSize, kind:'SL_SOFT' }, 'BTC15_SL_TRIGGER');
              const sellResp = await Promise.race([
                client.createAndPostOrder({ tokenID: t.tokenID, side: Side.SELL, price: bid, size: sellSize }, { tickSize: tickSize2, negRisk: negRisk2 }, OrderType.GTC),
                sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
              ]);
              const newSoldFrac = Math.min(1, soldFrac + slSellFrac);
              t.exit = { ...(t.exit||{}), slDone: true, soldFrac: newSoldFrac, last: { kind:'SL', ts:new Date().toISOString(), orderID: sellResp?.orderID, status: sellResp?.status, price: bid, size: sellSize } };
              saveState(state);
              try { fs.appendFileSync('/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl', JSON.stringify({ ts:new Date().toISOString(), series:'btc-up-or-down-15m', event: cur.slug, action:'SELL_SL', outcome:t.outcome, tokenID:t.tokenID, price: bid, size: sellSize, orderID: sellResp?.orderID, status: sellResp?.status, kind:'SL_SOFT' })+'\n'); } catch {}
            }
          }
        } catch {}
      }
      await sleep(Math.min(exitPollMs, 5000));
      continue;
    }

    // 3b) ENTRY MODE
    // - t5: wait until ~T+5, then attempt entry (with price + book-quality filters)
    // - t10: wait until ~T+10
    // - opportunistic: attempt any time before the cutoff
    // If SECOND_CHECK_MIN>0 and entryMode=t5, we allow one additional attempt at T+SECOND_CHECK_MIN
    // if the T+5 attempt was skipped.
    const preMs = 1500;
    const attempts = state.traded?.[cur.slug]?.attempts || {};
    const didT5 = !!attempts.t5;
    const didT5Re = !!attempts.t5re;
    const didSecond = !!attempts.second;
    const isT5ReTime = (entryMode === 't5' && now >= (t5RecheckMs - preMs));
    const isSecondTime = (entryMode === 't5' && secondCheckMin > 0 && now >= (tSecondMs - preMs));

    if (entryMode === 't5' && secondCheckMin > 0) {
      // Wait for the next due attempt.
      // Order: T+5 -> (T+5 + recheckSec) -> T+SECOND_CHECK_MIN
      const nextDue = !didT5 ? t5Ms : (!didT5Re ? t5RecheckMs : (!didSecond ? tSecondMs : null));
      if (nextDue && now < nextDue - preMs) {
        const wait = Math.min(10_000, (nextDue - preMs) - now);
        await sleep(wait);
        continue;
      }
    } else if ((entryMode === 't5' || entryMode === 't10') && now < tEntryMs - preMs) {
      const wait = Math.min(10_000, (tEntryMs - preMs) - now);
      await sleep(wait);
      continue;
    }

    // Don't enter too close to expiry (orders can get canceled / thin books).
    if ((cur.endMs - now) < (latestEntryToEndSec*1000)) {
      await sleep(Math.min(5000, entryScanMs));
      continue;
    }

    // Balance safety: stop trading if collateral balance falls below threshold.
    // CLOB balance endpoint can be transiently flaky (occasionally returns 0). We retry a few
    // times and only halt if we see consecutive "0/unavailable" reads.
    if (minBalanceUsdc > 0) {
      if (typeof state.balanceZeroStreak !== 'number') state.balanceZeroStreak = 0;

      const maxRetries = Math.max(1, Math.min(5, Math.floor(num(process.env.BALANCE_RETRIES || '3'))));
      const retrySleepMs = Math.max(200, Math.min(2500, Math.floor(num(process.env.BALANCE_RETRY_SLEEP_MS || '800'))));
      const stopAfterZeroStreak = Math.max(1, Math.min(5, Math.floor(num(process.env.BALANCE_STOP_AFTER_ZERO_STREAK || '2'))));

      let lastBa = null;
      let bal = 0;
      try {
        for (let i = 0; i < maxRetries; i++) {
          lastBa = await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
          bal = num(lastBa?.balance);
          if (bal > 0) break;
          if (i < maxRetries - 1) await sleep(retrySleepMs);
        }

        if (bal > 0) {
          state.balanceZeroStreak = 0;
        } else {
          state.balanceZeroStreak += 1;
          saveState(state);
        }

        if (bal > 0 && bal < minBalanceUsdc) {
          const action = String(process.env.BALANCE_STOP_ACTION || 'skip').toLowerCase(); // skip | exit
          log.warn({ slug: cur.slug, balance: bal, minBalanceUsdc, action }, 'BTC15_BALANCE_TOO_LOW');
          if (action === 'exit') {
            // User requested: stop trading and kill the worker when balance falls below threshold.
            process.exit(0);
          }
          await sleep(10_000);
          continue;
        }

        if (!(bal > 0)) {
          // Old-wallet behavior: do NOT halt the worker on transient balance=0/unavailable.
          // Just skip this cycle and try again shortly.
          const info = { slug: cur.slug, balance: lastBa?.balance, minBalanceUsdc, streak: state.balanceZeroStreak, maxRetries };
          log.warn(info, 'BTC15_BALANCE_UNAVAILABLE_RETRY_LATER');
          await sleep(5_000);
          continue;
        }
      } catch (e) {
        state.balanceZeroStreak = (state.balanceZeroStreak || 0) + 1;
        saveState(state);
        // Old-wallet behavior: do NOT halt on transient balance endpoint errors.
        const info = { slug: cur.slug, err: String(e), minBalanceUsdc, streak: state.balanceZeroStreak, maxRetries };
        log.warn(info, 'BTC15_BALANCE_CHECK_FAILED_RETRY_LATER');
        await sleep(5_000);
        continue;
      }
    }

    // 4) Load market details (tokenIds/outcomes).
    let market;
    try { market = await fetchMarket(cur.slug); } catch (e) {
      log.warn({ err: String(e), slug: cur.slug }, 'FETCH_MARKET_FAILED');
      await sleep(1500);
      continue;
    }

    const outcomes = market.outcomes || ['Up','Down'];
    const tokenIds = market.clobTokenIds || [];
    if (tokenIds.length < 2) {
      log.warn({ slug: cur.slug }, 'MISSING_TOKEN_IDS');
      await sleep(1500);
      continue;
    }

    // 5) Fetch books with short timeout.
    let b0,b1;
    try {
      [b0,b1] = await Promise.all([fetchBook(tokenIds[0]), fetchBook(tokenIds[1])]);
    } catch (e) {
      log.warn({ err: String(e), slug: cur.slug }, 'BOOK_FETCH_FAILED');
      await sleep(1000);
      continue;
    }

    const s0 = bestBidAsk(b0);
    const s1 = bestBidAsk(b1);

    log.info({ slug: cur.slug, note: 'ENTRY_SNAPSHOT', s0: { bid:s0.bid, ask:s0.ask, relSpread: +relSpread(s0).toFixed(3) }, s1: { bid:s1.bid, ask:s1.ask, relSpread:+relSpread(s1).toFixed(3) } }, 'BTC15_ENTRY_BOOK');

    // 6) Determine side.
    // If this is the second tranche and we already hold a position from T+5, keep the same side ("add $5").
    const existing = state.traded?.[cur.slug];
    const existingSide = (existing?.outcome === 'Down') ? 1 : 0;
    const lockSide = !!(existing?.orderID && entryMode === 't5' && secondCheckMin > 0 && secondCheckAlways && didT5 && !didSecond);

    let pick = 0; // 0=Up, 1=Down
    if (lockSide) {
      pick = existingSide;
      log.info({ slug: cur.slug, pick, note:'LOCK_EXISTING_SIDE_FOR_SECOND_TRANCHE', existingOutcome: existing?.outcome }, 'BTC15_SIDE_LOCK');
    } else if (forceSideMode === 'trend') {
      // Trend vs baseline: compare current Up mid to baseline Up mid captured earlier in this window.
      const base = state.baseline?.[cur.slug];
      const baseUp = num(base?.upMid);
      const curUp = num(s0.mid);
      const delta = (baseUp > 0 && curUp > 0) ? (curUp - baseUp) : 0;

      // Deadzone so we don't flip on noise.
      if (baseUp > 0 && curUp > 0) {
        if (delta > trendDeadzone) pick = 0;
        else if (delta < -trendDeadzone) pick = 1;
        else {
          // If flat, prefer spot momentum (Coinbase BTC-USD) to avoid "cheapest" fighting the tape.
          // If momentum is too small or fetch fails, fall back to cheaper ask.
          try {
            const sm = await spotMomentumPick();
            if (sm.pick === 0 || sm.pick === 1) {
              pick = sm.pick;
              log.info({ slug: cur.slug, ret: +sm.ret.toFixed(5), spotMomentumMin, spotMomentumDeadzone, pick }, 'BTC15_SIDE_SPOT_MOMENTUM');
            } else {
              pick = (s1.ask && s0.ask) ? (s1.ask < s0.ask ? 1 : 0) : 0;
              log.info({ slug: cur.slug, ret: +sm.ret.toFixed(5), note:'MOMENTUM_DEADZONE_FALLBACK_CHEAPEST', pick }, 'BTC15_SIDE_SPOT_MOMENTUM');
            }
          } catch (e) {
            pick = (s1.ask && s0.ask) ? (s1.ask < s0.ask ? 1 : 0) : 0;
            log.warn({ slug: cur.slug, err: String(e), note:'MOMENTUM_FETCH_FAILED_FALLBACK_CHEAPEST', pick }, 'BTC15_SIDE_SPOT_MOMENTUM');
          }
        }
      } else {
        // If we missed baseline, fall back to cheapest.
        pick = (s1.ask && s0.ask) ? (s1.ask < s0.ask ? 1 : 0) : 0;
      }

      log.info({ slug: cur.slug, baseUp, curUp, delta: +delta.toFixed(4), trendDeadzone }, 'BTC15_SIDE_TREND');
    } else if (forceSideMode === 'cheapest') {
      pick = (s1.ask && s0.ask) ? (s1.ask < s0.ask ? 1 : 0) : 0;
    }

    // 7) Choose price. If asks missing, retry briefly then use fallbackPrice.
    const tNow = Date.now();
    const secsAfterT5 = (tNow - t5Ms) / 1000;
    const effectiveEntryMs = (entryMode === 't5' && secondCheckMin > 0)
      ? (!didT5 ? t5Ms : (!didSecond ? tSecondMs : tEntryMs))
      : tEntryMs;
    const secsAfterEntry = (tNow - effectiveEntryMs) / 1000;

    function getAsk(i){ return i===0 ? s0.ask : s1.ask; }
    const bookAsk = getAsk(pick);
    let refAsk = bookAsk;
    if (!(refAsk > 0 && refAsk < 1)) {
      if (tNow - t5Ms < t5RetryMs) {
        await sleep(Math.min(500, entryScanMs));
        continue;
      }
      // If we truly can't see the ask, we fall back for LIMIT pricing only,
      // but note: without a real ask, we can't guarantee a $5 spend.
      refAsk = fallbackPrice;
      log.warn({ slug: cur.slug, pick, secsAfterEntry: +secsAfterEntry.toFixed(1), note:'FALLBACK_REF_ASK' }, 'BTC15_FALLBACK');
    }

    // Entry filters (capital protection):
    // 1) Price filter
    if (refAsk > maxEntryPrice) {
      log.info({ slug: cur.slug, pick, refAsk, maxEntryPrice }, 'BTC15_SKIP_ENTRY_PRICE');

      // Track which attempt this was
      // Tag the attempt time for logs/pinger.
      const attemptTag = (entryMode === 't5')
        ? (secondCheckMin > 0
          ? ((!didSecond && isSecondTime) ? `t+${secondCheckMin}` : ((!didT5Re && isT5ReTime) ? 't+6' : (!didT5 ? 't5' : (!didSecond ? `t+${secondCheckMin}` : 't5'))))
          : 't5')
        : (entryMode === 't10' ? 't10' : 'entry');

      // Record a "skip" event so the trade pinger can notify.
      try {
        fs.appendFileSync(
          '/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl',
          JSON.stringify({ ts: new Date().toISOString(), series: 'btc-up-or-down-15m', event: cur.slug, action: 'SKIP', reason: 'ENTRY_PRICE_TOO_HIGH', attempt: attemptTag, refAsk, maxEntryPrice, pick }) + '\n'
        );
      } catch {}

      // Mark attempt in state
      if (!state.traded[cur.slug]) state.traded[cur.slug] = { ts: new Date().toISOString(), attempts: {} };
      state.traded[cur.slug].attempts = state.traded[cur.slug].attempts || {};
      if (entryMode === 't5') {
        if (secondCheckMin > 0) {
          if (!didT5) state.traded[cur.slug].attempts.t5 = true;
          else if (!didT5Re) state.traded[cur.slug].attempts.t5re = true;
          else if (!didSecond) state.traded[cur.slug].attempts.second = true;
        } else {
          state.traded[cur.slug].attempts.t5 = true;
        }
      } else {
        state.traded[cur.slug].attempts.entry = true;
      }

      // If we have follow-up checks pending, don't finalize skip yet.
      const canRecheck = (entryMode === 't5' && secondCheckMin > 0 && !didT5Re);
      const hasMore = (entryMode === 't5' && secondCheckMin > 0) ? (!didSecond) : false;

      if (entryMode === 't5' && secondCheckMin > 0 && !didT5) {
        // Tell the loop to wait for second check.
        saveState(state);
        await sleep(Math.min(5000, entryScanMs));
        continue;
      }

      // Finalize skip for fixed-time modes
      if (entryMode === 't5' || entryMode === 't10') {
        state.traded[cur.slug].skipped = true;
        state.traded[cur.slug].reason = 'ENTRY_PRICE_TOO_HIGH';
        state.traded[cur.slug].refAsk = refAsk;
        state.traded[cur.slug].maxEntryPrice = maxEntryPrice;
        saveState(state);
        await sleep(2000);
      } else {
        saveState(state);
        await sleep(Math.min(5000, entryScanMs));
      }
      continue;
    }

    // 2) Book quality filters: spread + depth
    const pickedStatsForFilter = (pick === 0) ? s0 : s1;
    const pickedBookForFilter = (pick === 0) ? b0 : b1;
    const spreadRelNow = relSpread(pickedStatsForFilter);
    const depthNow = depthNotionalTopAsks(pickedBookForFilter, 5);
    if (spreadRelNow > maxRelSpread || depthNow < minDepthUsdc) {
      log.info({ slug: cur.slug, pick, spreadRelNow: +spreadRelNow.toFixed(3), maxRelSpread, depthNow: +depthNow.toFixed(2), minDepthUsdc }, 'BTC15_SKIP_BOOK_QUALITY');

      const attemptTag = (entryMode === 't5')
        ? (secondCheckMin > 0
          ? ((!didSecond && isSecondTime) ? `t+${secondCheckMin}` : ((!didT5Re && isT5ReTime) ? 't+6' : (!didT5 ? 't5' : (!didSecond ? `t+${secondCheckMin}` : 't5'))))
          : 't5')
        : (entryMode === 't10' ? 't10' : 'entry');

      try {
        fs.appendFileSync('/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl', JSON.stringify({ ts: new Date().toISOString(), series: 'btc-up-or-down-15m', event: cur.slug, action: 'SKIP', reason: 'BOOK_QUALITY', attempt: attemptTag, pick, spreadRel: spreadRelNow, maxRelSpread, depthUsdc: depthNow, minDepthUsdc }) + '\n');
      } catch {}

      if (!state.traded[cur.slug]) state.traded[cur.slug] = { ts: new Date().toISOString(), attempts: {} };
      state.traded[cur.slug].attempts = state.traded[cur.slug].attempts || {};
      if (entryMode === 't5') {
        if (secondCheckMin > 0) {
          if (!didT5) state.traded[cur.slug].attempts.t5 = true;
          else if (!didT5Re) state.traded[cur.slug].attempts.t5re = true;
          else if (!didSecond) state.traded[cur.slug].attempts.second = true;
        } else {
          state.traded[cur.slug].attempts.t5 = true;
        }
      } else {
        state.traded[cur.slug].attempts.entry = true;
      }

      // If follow-up checks are pending (recheck / second tranche), keep looping.
      if (entryMode === 't5' && secondCheckMin > 0 && (!didT5Re || !didSecond)) {
        saveState(state);
        await sleep(Math.min(5000, entryScanMs));
        continue;
      }

      if (entryMode === 't5' || entryMode === 't10') {
        state.traded[cur.slug].skipped = true;
        state.traded[cur.slug].reason = 'BOOK_QUALITY';
        saveState(state);
        await sleep(2000);
      } else {
        saveState(state);
        await sleep(Math.min(5000, entryScanMs));
      }
      continue;
    }

    // We place a limit order at (or above) the observed ask to ensure fill,
    // but we size based on the observed ask so we spend ~$5 at execution.
    const limitPrice = Math.max(refAsk, bookAsk || refAsk);

    // 8) Confidence + Size.
    // Confidence is a deterministic 0-100 score based on:
    // - trend strength vs baseline (primary)
    // - book spread quality
    // - top-of-book depth on the BUY side (top asks)
    const base = state.baseline?.[cur.slug];
    const baseUp = num(base?.upMid);
    const curUp = num(s0.mid);
    const delta = (baseUp > 0 && curUp > 0) ? (curUp - baseUp) : 0;

    const pickedStats = (pick === 0) ? s0 : s1;
    const pickedBook = (pick === 0) ? b0 : b1;
    const spreadRel = relSpread(pickedStats);
    const depthUSDC = depthNotionalTopAsks(pickedBook, 5);

    const trendScore = clamp((Math.abs(delta) / 0.05), 0, 1) * 60;
    const spreadScore = clamp(1 - (spreadRel / 0.10), 0, 1) * 25;
    const depthScore = clamp(depthUSDC / 200, 0, 1) * 15;
    const confidence = Math.round(trendScore + spreadScore + depthScore);

    // Size tiers (T+5 entry):
    // - baseNotional (default $5)
    // - if confidence >= tier1Conf AND |delta|>=minDeltaForScale -> at least tier1Notional
    // - if confidence >= tier2Conf AND |delta|>=minDeltaForScale -> at least tier2Notional
    // - if confidence >= tier3Conf AND |delta|>=minDeltaForScale -> at least tier3Notional
    // Guard against floating-point edge cases (e.g. 0.0999999997 showing as 0.10 in logs)
    const deltaOK = (Math.abs(delta) + 1e-9) >= minDeltaForScale;
    let tierNotional = baseNotional;
    if (deltaOK && confidence >= tier1Conf) tierNotional = Math.max(tierNotional, tier1Notional);
    if (deltaOK && confidence >= tier2Conf) tierNotional = Math.max(tierNotional, tier2Notional);
    if (deltaOK && confidence >= tier3Conf) tierNotional = Math.max(tierNotional, tier3Notional);

    // Always buy at least $5 worth at the prevailing ask.
    // Round UP to 2 decimals so actual notional is never below the target.
    // Determine which attempt we're on (t5 vs second tranche).
    const attemptTag = (entryMode === 't5')
      ? (secondCheckMin > 0
        ? ((!didSecond && isSecondTime) ? 'second' : ((!didT5Re && isT5ReTime) ? 't5re' : (!didT5 ? 't5' : (!didSecond ? 'second' : 't5'))))
        : 't5')
      : (entryMode === 't10' ? 't10' : 'entry');

    // Per-attempt sizing:
    // - T+5: default $7.5 only if criteria met, else $5
    // - T+10 retry: only if confidence is high
    let attemptNotional = baseNotional;
    if (attemptTag === 'second') {
      const retryConfMin = num(process.env.T10_RETRY_CONF_MIN || String(t5BigConf || 90));
      const retryNotional = num(process.env.T10_RETRY_NOTIONAL_USDC || String(secondNotional || t5NotionalBig || 7.5));
      if (confidence < retryConfMin) {
        log.info({ slug: cur.slug, confidence, retryConfMin, note: 'SECOND_CHECK_SKIP_LOW_CONF' }, 'BTC15_SECOND_CHECK_SKIP');
        // Mark the attempt so we don't keep retrying this window.
        if (!state.traded[cur.slug]) state.traded[cur.slug] = { ts: new Date().toISOString(), attempts: {} };
        state.traded[cur.slug].attempts = state.traded[cur.slug].attempts || {};
        state.traded[cur.slug].attempts.second = true;
        saveState(state);
        await sleep(2000);
        continue;
      }
      attemptNotional = retryNotional;
    } else if (attemptTag === 't5') {
      const bigOk = (
        (confidence >= t5BigConf) &&
        (Math.abs(delta) >= t5BigMinDelta) &&
        (spreadRel <= t5BigMaxSpread) &&
        (depthUSDC >= t5BigMinDepth) &&
        (refAsk <= t5BigMaxAsk)
      );
      attemptNotional = bigOk ? t5NotionalBig : t5NotionalSmall;
      log.info({ slug: cur.slug, attemptTag, bigOk, t5NotionalBig, t5NotionalSmall, confidence, delta:+delta.toFixed(4), spreadRel:+spreadRel.toFixed(4), depthUSDC:+depthUSDC.toFixed(2), refAsk:+refAsk.toFixed(3) }, 'BTC15_T5_SIZE_DECISION');
    } else {
      attemptNotional = baseNotional;
    }

    const targetNotional = Math.max(0.01, attemptNotional);
    const useNotional = Math.min(maxOrder, targetNotional);
    const size = Math.max(1, Math.ceil((useNotional / refAsk) * 100) / 100);

    log.info({ slug: cur.slug, pick, confidence, components: { trendScore:+trendScore.toFixed(1), spreadScore:+spreadScore.toFixed(1), depthScore:+depthScore.toFixed(1) }, delta:+delta.toFixed(4), spreadRel:+spreadRel.toFixed(3), depthUSDC:+depthUSDC.toFixed(2), tierNotional, useNotional }, 'BTC15_CONFIDENCE');

    const tokenID = tokenIds[pick];
    const outcome = outcomes[pick] || (pick===0?'Up':'Down');

    // 9) Execute.
    try {
      const tickSize = await Promise.race([client.getTickSize(tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
      const negRisk = await Promise.race([client.getNegRisk(tokenID), sleep(4000).then(()=>{ throw new Error('negRisk timeout'); })]);

      log.info({ slug: cur.slug, outcome, tokenID, limitPrice, refAsk, size, estNotional: +(refAsk*size).toFixed(3) }, 'BTC15_ORDER_ATTEMPT');

      // If this is the T+10 retry, cancel any prior live-unfilled T+5 order to free collateral.
      if (attemptTag === 'second') {
        const prev0 = state.traded?.[cur.slug];
        const prevLiveUnfilled = prev0?.orderID && (String(prev0?.status || '').toLowerCase() === 'live') && !(num(prev0?.filledSize) > 0);
        if (prevLiveUnfilled) {
          try {
            await Promise.race([
              client.cancelOrder({ orderID: prev0.orderID }),
              sleep(5000).then(()=>{ throw new Error('cancel timeout'); })
            ]);
            log.info({ slug: cur.slug, orderID: prev0.orderID }, 'BTC15_CANCELLED_UNFILLED_T5');
          } catch (e) {
            log.warn({ slug: cur.slug, orderID: prev0.orderID, err: String(e) }, 'BTC15_CANCEL_UNFILLED_T5_FAILED');
          }
        }
      }

      const resp = await Promise.race([
        client.createAndPostOrder({ tokenID, side: Side.BUY, price: limitPrice, size }, { tickSize, negRisk }, OrderType.GTC),
        sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
      ]);

      // If the client returns a non-order response (e.g. HTTP error wrapped), do not treat it as a trade.
      if (!resp?.orderID || !String(resp?.status || '')) {
        // Log the raw response so we can see real rejection reasons (insufficient balance/allowance,
        // trading disabled, rate limits, signature issues, etc.).
        log.warn({ slug: cur.slug, resp }, 'BTC15_ORDER_BAD_RESPONSE');
        const errHint = resp?.error || resp?.message || resp?.msg;
        throw new Error(`order not accepted (missing orderID/status)${errHint ? `: ${errHint}` : ''}`);
      }
      const st = String(resp.status).toLowerCase();
      if (!(st === 'matched' || st === 'live')) {
        throw new Error(`order not accepted (status=${resp.status})`);
      }

      // Fetch confirmed trade fill price + filled size (matches Polymarket UI) when available.
      // IMPORTANT: orders can partially fill; exits must never assume intended size was fully filled.
      let fillPrice = null;
      let filledSize = null;
      try {
        const ord = await client.getOrder(resp?.orderID);
        const tradeId = ord?.associate_trades?.[0];
        if (tradeId) {
          const trades = await client.getTrades({ id: tradeId });
          const t0 = Array.isArray(trades) ? trades[0] : trades;
          if (t0?.price) fillPrice = num(t0.price);
          if (t0?.size) filledSize = num(t0.size);
        }
      } catch {}

      // Fallbacks for filled size: prefer any filledSize returned by the order response.
      if (!(filledSize > 0)) {
        const fs0 = num(resp?.filledSize);
        if (fs0 > 0) filledSize = fs0;
      }
      const effectiveSize = (filledSize && filledSize > 0) ? filledSize : size;

      // Persist traded flag (supports 2-tranche entries: T+5 then T+10)
      const prev = state.traded[cur.slug];
      const attemptsPrev = (prev && prev.attempts) ? prev.attempts : {};
      const attemptsNext = { ...attemptsPrev, ...(attemptTag === 't5' ? { t5: true } : (attemptTag === 'second' ? { second: true } : { entry: true })) };

      if (prev && attemptTag === 'second' && prev.tokenID === tokenID && prev.outcome === outcome) {
        // Add-on tranche: accumulate size and keep an order id list.
        const orderIDs = Array.isArray(prev.orderIDs) ? prev.orderIDs : [prev.orderID].filter(Boolean);
        orderIDs.push(resp?.orderID);
        state.traded[cur.slug] = {
          ...prev,
          ts2: new Date().toISOString(),
          orderIDs,
          orderID: prev.orderID,
          status: prev.status,
          // keep original refAsk/fillPrice for entryPx; track second tranche separately
          tranche2: { orderID: resp?.orderID, status: resp?.status, limitPrice, refAsk, size: effectiveSize, fillPrice, confidence, filledSize },
          size: +(num(prev.size) + num(effectiveSize)).toFixed(2),
          attempts: attemptsNext,
          exit: prev.exit || { soldFrac: 0, tp1Done: false, tp2Done: false, slDone: false },
          addOn: prev.addOn || { done: false },
        };
      } else {
        // First tranche (or fresh state)
        state.traded[cur.slug] = { ts: new Date().toISOString(), orderID: resp?.orderID, status: resp?.status, outcome, tokenID, limitPrice, refAsk, size: effectiveSize, filledSize, fillPrice, confidence, attempts: attemptsNext, exit: { soldFrac: 0, tp1Done: false, tp2Done: false, slDone: false }, addOn: { done: false } };
      }
      // prune old
      const keys = Object.keys(state.traded);
      if (keys.length > 200) {
        keys.sort();
        for (const k of keys.slice(0, keys.length-200)) delete state.traded[k];
      }
      saveState(state);

      // Log event for pinger
      try {
        const outPath = '/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl';
        const px = (fillPrice && fillPrice > 0) ? fillPrice : refAsk;
        fs.appendFileSync(outPath, JSON.stringify({ ts: new Date().toISOString(), series: 'btc-up-or-down-15m', event: cur.slug, action: 'BUY', outcome, tokenID, limitPrice, refAsk, fillPrice, size: effectiveSize, filledSize, estNotional: px*effectiveSize, orderID: resp.orderID, status: resp.status, attempt: attemptTag }) + '\n');
      } catch {}

      log.info({ slug: cur.slug, orderID: resp?.orderID, status: resp?.status }, 'BTC15_ORDER_SUBMITTED');

      // 10) Legacy profit-based T+10 add-on (disabled).
      // We now handle T+10 as a deterministic second tranche via SECOND_CHECK_MIN/ALWAYS.
      /* (async()=>{ 
        const slug = cur.slug;
        const entry = refAsk;
        const windowEndMs = cur.endMs;
        const t10Ms = (cur.endMs - 15*60*1000) + 10*60*1000;

        // Sleep until ~T+10
        while (isArmed() && Date.now() < t10Ms - 500) {
          await sleep(Math.min(5000, (t10Ms - 500) - Date.now()));
        }
        if (!isArmed() || Date.now() > windowEndMs) return;

        // Only within last addOnTimeToEndSec window
        if (windowEndMs - Date.now() > addOnTimeToEndSec*1000) return;

        // Don't add-on if stop-loss already sold or add-on already done.
        if (state.traded?.[slug]?.stopLoss?.sold) return;
        if (state.traded?.[slug]?.addOn?.done) return;

        // Profit check using best bid vs entry.
        let bid;
        try {
          const book = await fetchBook(tokenID);
          const stats = bestBidAsk(book);
          bid = num(stats.bid);
        } catch (e) {
          log.warn({ slug, err: String(e) }, 'BTC15_ADDON_BOOK_FAILED');
          return;
        }
        if (!(bid > 0 && entry > 0)) return;
        const profitPct = (bid / entry) - 1;
        if (profitPct < addOnProfitPct) {
          log.info({ slug, profitPct: +profitPct.toFixed(3), bid, entry, need: addOnProfitPct }, 'BTC15_ADDON_SKIP_PROFIT');
          return;
        }

        // Confidence check: re-run trend logic now; only add-on if it selects the SAME side we already bought.
        let pickNow = pick;
        try {
          const base = state.baseline?.[slug];
          const baseUp = num(base?.upMid);
          const mkt = await fetchMarket(slug);
          const tids = mkt.clobTokenIds || [];
          if (tids.length >= 2) {
            const [bb0, bb1] = await Promise.all([fetchBook(tids[0]), fetchBook(tids[1])]);
            const ss0 = bestBidAsk(bb0);
            const ss1 = bestBidAsk(bb1);
            const curUp = num(ss0.mid);
            const delta = (baseUp > 0 && curUp > 0) ? (curUp - baseUp) : 0;
            if (baseUp > 0 && curUp > 0) {
              if (delta > trendDeadzone) pickNow = 0;
              else if (delta < -trendDeadzone) pickNow = 1;
              else pickNow = (ss1.ask && ss0.ask) ? (ss1.ask < ss0.ask ? 1 : 0) : 0;
            } else {
              pickNow = (ss1.ask && ss0.ask) ? (ss1.ask < ss0.ask ? 1 : 0) : 0;
            }
            log.info({ slug, profitPct: +profitPct.toFixed(3), pick, pickNow, delta: +delta.toFixed(4) }, 'BTC15_ADDON_SIGNAL');
          }
        } catch (e) {
          log.warn({ slug, err: String(e) }, 'BTC15_ADDON_SIGNAL_FAILED');
          return;
        }

        if (pickNow !== pick) {
          log.info({ slug, profitPct: +profitPct.toFixed(3), pick, pickNow }, 'BTC15_ADDON_SKIP_CONFIDENCE');
          return;
        }

        // Place add-on buy sized off current ask for this same token.
        let ask2;
        try {
          const book2 = await fetchBook(tokenID);
          const stats2 = bestBidAsk(book2);
          ask2 = num(stats2.ask);
        } catch (e) {
          log.warn({ slug, err: String(e) }, 'BTC15_ADDON_ASK_FAILED');
          return;
        }
        if (!(ask2 > 0 && ask2 < 1)) return;
        const size2 = Math.max(1, Math.ceil((Math.min(maxOrder, addOnNotional) / ask2) * 100) / 100);
        const limit2 = ask2;

        try {
          const tickSize2 = await Promise.race([client.getTickSize(tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
          const negRisk2 = await Promise.race([client.getNegRisk(tokenID), sleep(4000).then(()=>{ throw new Error('negRisk timeout'); })]);
          log.info({ slug, outcome, tokenID, ask: ask2, size: size2, estNotional: +(ask2*size2).toFixed(3), profitPct: +profitPct.toFixed(3) }, 'BTC15_ADDON_ATTEMPT');

          const resp2 = await Promise.race([
            client.createAndPostOrder({ tokenID, side: Side.BUY, price: limit2, size: size2 }, { tickSize: tickSize2, negRisk: negRisk2 }, OrderType.GTC),
            sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
          ]);

          if (state.traded?.[slug]) {
            state.traded[slug].addOn = { done: true, ts: new Date().toISOString(), orderID: resp2?.orderID, status: resp2?.status, ask: ask2, size: size2, profitPct };
            saveState(state);
          }

          try {
            const outPath3 = '/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl';
            fs.appendFileSync(outPath3, JSON.stringify({ ts: new Date().toISOString(), series: 'btc-up-or-down-15m', event: slug, action: 'BUY_ADDON', outcome, tokenID, price: limit2, size: size2, estNotional: ask2*size2, orderID: resp2?.orderID, status: resp2?.status }) + '\n');
          } catch {}

          log.info({ slug, orderID: resp2?.orderID, status: resp2?.status }, 'BTC15_ADDON_SUBMITTED');
        } catch (e) {
          log.warn({ slug, err: String(e) }, 'BTC15_ADDON_FAILED');
        }
      })().catch(()=>{});
      */

      // 11) Take-profit: if best bid >= entry*(1+takeProfitPct), sell a fraction of shares once.
      // We sell at best bid to exit quickly. If books are pathological, this can still be unsafe; keep TP off by setting TAKE_PROFIT_SELL_FRAC=0.
      (async()=>{
        const entry = refAsk;
        const tpBid = entry * (1 + takeProfitPct);
        const windowEndMs = cur.endMs;
        while (isArmed() && Date.now() < windowEndMs && !state.traded?.[cur.slug]?.takeProfit?.sold) {
          try {
            // Don't TP if stop-loss already sold (shouldn't happen, but be safe).
            if (state.traded?.[cur.slug]?.stopLoss?.sold) return;

            const book = await fetchBook(tokenID);
            const stats = bestBidAsk(book);
            const bid = num(stats.bid);
            if (bid > 0 && bid >= tpBid && takeProfitSellFrac > 0) {
              const sellSize = Math.max(0.01, Math.floor((size * takeProfitSellFrac) * 100) / 100);
              const sellPrice = bid;
              const tickSize2 = await Promise.race([client.getTickSize(tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
              const negRisk2 = await Promise.race([client.getNegRisk(tokenID), sleep(4000).then(()=>{ throw new Error('negRisk timeout'); })]);

              log.warn({ slug: cur.slug, outcome, tokenID, entry, takeProfitPct, tpBid: +tpBid.toFixed(4), bid, sellPrice, sellSize, origSize: size }, 'BTC15_TAKE_PROFIT_TRIGGER');
              const sellResp = await Promise.race([
                client.createAndPostOrder({ tokenID, side: Side.SELL, price: sellPrice, size: sellSize }, { tickSize: tickSize2, negRisk: negRisk2 }, OrderType.GTC),
                sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
              ]);

              if (state.traded?.[cur.slug]) {
                state.traded[cur.slug].takeProfit = { pct: takeProfitPct, sellFrac: takeProfitSellFrac, sold: true, ts: new Date().toISOString(), orderID: sellResp?.orderID, status: sellResp?.status, price: sellPrice, bid, sellSize };
                saveState(state);
              }

              try {
                const outPathTP = '/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl';
                fs.appendFileSync(outPathTP, JSON.stringify({ ts: new Date().toISOString(), series: 'btc-up-or-down-15m', event: cur.slug, action: 'SELL_TP', outcome, tokenID, price: sellPrice, size: sellSize, orderID: sellResp?.orderID, status: sellResp?.status }) + '\n');
              } catch {}

              log.warn({ slug: cur.slug, orderID: sellResp?.orderID, status: sellResp?.status }, 'BTC15_TAKE_PROFIT_SUBMITTED');
              return;
            }
          } catch (e) {
            log.warn({ slug: cur.slug, err: String(e) }, 'BTC15_TAKE_PROFIT_CHECK_FAILED');
          }
          await sleep(takeProfitPollMs);
        }
      })().catch(()=>{});

      // 12) Stop-loss monitor: if bid drops below (1-stopLossPct)*entry, sell.
      // Best-effort: if sell fails we keep trying until window ends or it sells.
      (async()=>{
        const entry = refAsk;
        const stopBid = entry * (1 - stopLossPct);
        const windowEndMs = cur.endMs;
        while (isArmed() && Date.now() < windowEndMs && !state.traded?.[cur.slug]?.stopLoss?.sold) {
          try {
            const book = await fetchBook(tokenID);
            const stats = bestBidAsk(book);
            const bid = num(stats.bid);
            if (bid > 0 && bid <= stopBid) {
              const sellPrice = bid; // exit fast
              const tickSize2 = await Promise.race([client.getTickSize(tokenID), sleep(4000).then(()=>{ throw new Error('tickSize timeout'); })]);
              const negRisk2 = await Promise.race([client.getNegRisk(tokenID), sleep(4000).then(()=>{ throw new Error('negRisk timeout'); })]);
              log.warn({ slug: cur.slug, outcome, tokenID, entry, stopLossPct, stopBid: +stopBid.toFixed(4), bid, sellPrice, size }, 'BTC15_STOP_LOSS_TRIGGER');
              const sellResp = await Promise.race([
                client.createAndPostOrder({ tokenID, side: Side.SELL, price: sellPrice, size }, { tickSize: tickSize2, negRisk: negRisk2 }, OrderType.GTC),
                sleep(10000).then(()=>{ throw new Error('postOrder timeout'); })
              ]);

              // Mark sold
              if (state.traded?.[cur.slug]) {
                state.traded[cur.slug].stopLoss = { pct: stopLossPct, sold: true, ts: new Date().toISOString(), orderID: sellResp?.orderID, status: sellResp?.status, price: sellPrice };
                saveState(state);
              }

              // Log SELL
              try {
                const outPath2 = '/Users/jt/.openclaw/workspace/memory/polymarket-trades.jsonl';
                fs.appendFileSync(outPath2, JSON.stringify({ ts: new Date().toISOString(), series: 'btc-up-or-down-15m', event: cur.slug, action: 'SELL_STOP', outcome, tokenID, price: sellPrice, size, orderID: sellResp?.orderID, status: sellResp?.status }) + '\n');
              } catch {}

              log.warn({ slug: cur.slug, orderID: sellResp?.orderID, status: sellResp?.status }, 'BTC15_STOP_LOSS_SUBMITTED');
              return;
            }
          } catch (e) {
            log.warn({ slug: cur.slug, err: String(e) }, 'BTC15_STOP_LOSS_CHECK_FAILED');
          }
          await sleep(stopLossPollMs);
        }
      })().catch(()=>{});

      await sleep(2000);
    } catch (e) {
      const info = {
        err: String(e),
        msg: e?.message,
        code: e?.code,
        status: e?.response?.status,
        statusText: e?.response?.statusText,
        data: e?.response?.data,
        slug: cur.slug,
      };
      log.warn(info, 'BTC15_ORDER_FAILED');
      await sleep(1000);
    }
  }

  log.info('BTC15_WORKER_END');
}

main().catch(e=>{
  log.error({ err: String(e), stack: e?.stack }, 'BTC15_WORKER_FATAL');
  process.exit(1);
});
