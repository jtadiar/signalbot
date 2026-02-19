import fs from 'fs';
import { Hyperliquid } from 'hyperliquid';
import { computeSignal } from './signal_engine.mjs';
import { candleSnapshot, allMids, spotClearinghouseState } from './hl_info.mjs';

const CONFIG_PATH = process.env.CONFIG || new URL('./config.json', import.meta.url).pathname;
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// ---- Env overrides (secrets + user-local settings) ----
// Prefer injecting secrets via env rather than editing tracked files.
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

if (!cfg?.wallet?.address) {
  console.error('Missing wallet address. Set wallet.address in config.json or HL_WALLET_ADDRESS in env.');
  process.exit(1);
}
if (!pk) {
  console.error('Missing private key. Set HL_PRIVATE_KEY or HL_PRIVATE_KEY_PATH in env (recommended), or wallet.privateKeyPath in config.json.');
  process.exit(1);
}

// Optional Telegram pings (NO OpenAI/LLM needed)
let TG_TOKEN = null;
const tgEnabled = String(process.env.TG_ENABLED ?? cfg?.telegram?.enabled ?? '').toLowerCase();
const tgOn = tgEnabled === 'true' || tgEnabled === '1' || tgEnabled === 'yes';
try {
  if (process.env.TG_TOKEN) TG_TOKEN = String(process.env.TG_TOKEN).trim();
  else if (process.env.TG_TOKEN_PATH) TG_TOKEN = readSecretFromPath(String(process.env.TG_TOKEN_PATH).trim());
  else {
    const p = cfg?.telegram?.tokenPath;
    if (p) TG_TOKEN = readSecretFromPath(String(p).trim());
  }
} catch {}
const TG_CHAT = (process.env.TG_CHAT ? String(process.env.TG_CHAT).trim() : (cfg?.telegram?.channel || null));

if (!tgOn) {
  TG_TOKEN = null;
}
let _lastTgText = null;
let _lastTgAtMs = 0;
async function tgSend(text){
  if (!TG_TOKEN || !TG_CHAT) return;

  // De-dupe: do not send identical messages twice within a short window.
  // Protects against double-running bots / overlapping loops / transient cursor issues.
  const now = Date.now();
  if (text && _lastTgText === text && (now - _lastTgAtMs) < 2 * 60 * 1000) return;

  try {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }),
    });
    _lastTgText = text;
    _lastTgAtMs = now;
  } catch {}
}

function fmtCET(isoOrMs){
  try {
    const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return String(isoOrMs);
  }
}

async function pingNewFills(){
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    const since = state.lastFillTimeMs && Number.isFinite(state.lastFillTimeMs) ? state.lastFillTimeMs : (Date.now() - 5*60*1000);
    const fills = await sdk.info.getUserFillsByTime(cfg.wallet.address, since, Date.now(), true);
    const perps = (fills||[]).filter(f => String(f.coin).includes(`${cfg.market.coin}-PERP`) || String(f.coin).includes(cfg.market.coin));
    if (!perps.length) return;

    // process oldest->newest, skip duplicates at same timestamp by using > cursor
    const sorted = perps.slice().sort((a,b)=>Number(a.time)-Number(b.time));
    for (const f of sorted){
      const t = Number(f.time||0);
      if (t && t <= (state.lastFillTimeMs||0)) continue;

      const dir = String(f.dir||'');
      const isClose = dir.toLowerCase().includes('close');
      const isOpen = dir.toLowerCase().includes('open');
      const px = Number(f.px||0);
      const sz = Number(f.sz||0);
      const closedPnl = f.closedPnl !== undefined ? Number(f.closedPnl) : null;
      const fee = f.fee !== undefined ? Number(f.fee) : null;

      if (isClose){
        const net = (closedPnl !== null && fee !== null) ? (closedPnl - fee) : null;
        const isLoss = (net !== null) ? (net < 0) : (closedPnl !== null ? closedPnl < 0 : false);

        if (isLoss) {
          state.lastLossAtMs = t || Date.now();
          persistState();
        }

        const tag = isLoss ? 'STOP/LOSS' : 'TP/CLOSE';
        const msg = [
          `HL SIGNALBOT ${tag}`,
          `${dir.toUpperCase()}`,
          `${sz.toFixed(5)} @ ${roundPx(cfg.market.coin, px)}`,
          (net !== null) ? `Net ${net.toFixed(2)} USDC` : null,
          `(${fmtCET(t)})`,
        ].filter(Boolean).join(' | ');
        await tgSend(msg);
      } else if (isOpen){
        // We already ping on OPEN at entry; avoid duplicate pings here.
      }

      if (t) state.lastFillTimeMs = t;
      persistState();
    }
  } catch {}
}

const sdk = new Hyperliquid({
  privateKey: pk,
  enableWs: false,
  testnet: false,
  walletAddress: cfg.wallet.address,
  disableAssetMapRefresh: true,
});

const STATE_PATH = new URL('./state.json', import.meta.url).pathname;

function loadState(){
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return null; }
}

function persistState(){
  try {
    fs.writeFileSync(
      STATE_PATH,
      JSON.stringify({
        halted: state.halted,
        lastActionAt: state.lastActionAt,
        backoffUntilMs: state.backoffUntilMs,
        errStreak: state.errStreak,
        exitsPlacedForPosKey: state.exitsPlacedForPosKey,
        lastExitAtMs: state.lastExitAtMs,
        activeSide: state.activeSide,
        entryPx: state.entryPx,
        entryNotionalUsd: state.entryNotionalUsd,
        initialSz: state.initialSz,
        marginUsd: state.marginUsd,
        stopPct: state.stopPct,
        stopPx: state.stopPx,
        tp1Done: state.tp1Done,
        tp2Done: state.tp2Done,
        lastSignalAtMs: state.lastSignalAtMs,
        lastFillTimeMs: state.lastFillTimeMs,
        lastLossAtMs: state.lastLossAtMs,
      }, null, 2)
    );
  } catch {}
}

function nowIso(){ return new Date().toISOString(); }

const state = {
  startedAt: Date.now(),
  halted: false,
  lastActionAt: 0,
  backoffUntilMs: 0,
  errStreak: 0,
  exitsPlacedForPosKey: null,
  lastExitAtMs: 0,

  // position plan
  activeSide: null,
  entryPx: null,
  entryNotionalUsd: null,
  initialSz: null,
  marginUsd: null,
  stopPct: null,
  stopPx: null,
  tp1Done: false,
  tp2Done: false,

  // signal debug
  lastSignalAtMs: 0,

  // telegram fill cursor
  lastFillTimeMs: 0,

  // loss cooldown
  lastLossAtMs: 0,
};

const loaded = loadState();
if (loaded && typeof loaded === 'object') Object.assign(state, loaded);

function roundSz(coin, sz){
  const decimals = coin === 'BTC' ? 5 : 5;
  return Number(Number(sz).toFixed(decimals));
}

function roundPx(coin, px){
  // HL BTC-PERP price increments are effectively whole dollars in UI.
  const decimals = coin === 'BTC' ? 0 : 2;
  return Number(Number(px).toFixed(decimals));
}

async function spotUsdc(){
  const spot = await spotClearinghouseState(cfg.wallet.address);
  const usdc = (spot?.balances||[]).find(b=>b.coin==='USDC');
  return Number(usdc?.total ?? 0);
}

async function dailyPnl(){
  try{
    const p = await sdk.info.portfolio(cfg.wallet.address, true);
    const day = Array.isArray(p) ? p.find(x=>x?.[0]==='day')?.[1] : null;
    const pnlHist = day?.pnlHistory;
    if (Array.isArray(pnlHist) && pnlHist.length){
      const last = pnlHist[pnlHist.length-1];
      const v = Number(last?.[1] ?? 0);
      if (Number.isFinite(v)) return v;
    }
  } catch {}
  return 0;
}

async function getBtcPosition(){
  const ch = await sdk.info.perpetuals.getClearinghouseState(cfg.wallet.address, true);
  const pos = (ch?.assetPositions||[]).map(p=>p.position).find(p=>p?.coin===cfg.market.coin);
  const szi = pos ? Number(pos.szi||0) : 0;
  const entryPx = pos ? Number(pos.entryPx||0) : 0;
  return { szi, entryPx };
}

async function midPx(){
  const all = await allMids();
  const px = Number(all?.[cfg.market.coin] || all?.[`${cfg.market.coin}-PERP`] || 0);
  if (!px) throw new Error('midPx unavailable');
  return px;
}

async function ensureLeverage(){
  try { await sdk.exchange.updateLeverage(`${cfg.market.coin}-PERP`, 'cross', cfg.risk.maxLeverage); } catch {}
}

async function placeMarket(side, sz){
  const px = await midPx();
  const isBuy = side==='long';
  const symbol = `${cfg.market.coin}-PERP`;
  const slippage = 0.001;
  return await sdk.custom.marketOpen(symbol, isBuy, roundSz(cfg.market.coin, sz), px, slippage);
}

// TP/SL are placed as native Hyperliquid trigger orders so they show up in the UI.
// (We still keep simple in-code checks as a backstop.)

async function cancelAllBtcOrders({ cancelStops=true, cancelTps=true } = {}){
  // Legacy name; this now cancels *frontend* open orders (including triggers) for the perp.
  // cancelStops/cancelTps let us respect manual stop edits.
  try {
    const oo = await sdk.info.getFrontendOpenOrders(cfg.wallet.address, true);
    const coinPerp = `${cfg.market.coin}-PERP`;

    const relevant = (oo||[]).filter(o => {
      const isBtc = o.coin === cfg.market.coin || o.coin === coinPerp;
      const isReduce = o.reduceOnly === true;
      if (!isBtc || !isReduce) return false;
      const ot = String(o.orderType||'').toLowerCase();
      const isStop = ot.includes('stop') || o.tpsl === 'sl';
      const isTp = ot.includes('take profit') || o.tpsl === 'tp';
      if (isStop && !cancelStops) return false;
      if (isTp && !cancelTps) return false;
      return isStop || isTp;
    });

    if (!relevant.length) return;

    // Cancel using the perp coin first; if that fails, fall back to spot-style coin.
    const cancelsPerp = relevant.map(o => ({ coin: coinPerp, o: o.oid }));
    try {
      await sdk.exchange.cancelOrder(cancelsPerp);
      return;
    } catch {}

    const cancelsSpot = relevant.map(o => ({ coin: cfg.market.coin, o: o.oid }));
    try { await sdk.exchange.cancelOrder(cancelsSpot); } catch {}
  } catch {}
}

async function replaceStopToBreakeven({ side, entryPx, absSz }){
  // Cancel existing stop(s) and place a new stop-market at breakeven for remaining size.
  try {
    const oo = await sdk.info.getFrontendOpenOrders(cfg.wallet.address, true);
    const coinPerp = `${cfg.market.coin}-PERP`;
    const stops = (oo||[]).filter(o => (o.coin===cfg.market.coin || o.coin===coinPerp) && o.reduceOnly===true && String(o.orderType||'').toLowerCase().includes('stop'));
    if (stops.length){
      try { await sdk.exchange.cancelOrder(stops.map(o=>({ coin: coinPerp, o: o.oid }))); } catch {}
    }

    const px = roundPx(cfg.market.coin, entryPx);
    await sdk.exchange.placeOrder({
      coin: coinPerp,
      is_buy: side === 'short', // closing short is buy; closing long is sell
      sz: roundSz(cfg.market.coin, absSz),
      limit_px: px,
      order_type: { trigger: { isMarket: true, triggerPx: px, tpsl: 'sl' } },
      reduce_only: true,
      grouping: 'positionTpsl',
    });
  } catch {}
}

async function fetchOHLC(symbol, interval, lookback){
  // Fetch candles directly via HL info API.
  // symbol is like 'BTC-PERP' but candleSnapshot expects coin name (e.g. 'BTC')
  const coin = symbol.replace('-PERP','');
  const endTime = Date.now();
  const startTime = endTime - lookback;
  const res = await candleSnapshot({ coin, interval, startTime, endTime });
  const closes = (res||[]).map(c=>Number(c.c));
  const highs = (res||[]).map(c=>Number(c.h));
  const lows = (res||[]).map(c=>Number(c.l));
  return { closes, highs, lows };
}

function computeRiskSizedNotional({ equityUsd, stopPct }){
  const riskUsd = equityUsd * (cfg.risk.riskPerTradePct ?? 0.01);
  const notional = riskUsd / Math.max(1e-6, stopPct);
  return { riskUsd, notional };
}

function tpPxFor({ side, entryPx, stopPct, absSz, idx, rMultiple }){
  const byR = side === 'long'
    ? (entryPx * (1 + rMultiple * stopPct))
    : (entryPx * (1 - rMultiple * stopPct));

  const mins = Array.isArray(cfg?.exits?.tpMinUsd) ? cfg.exits.tpMinUsd : [];
  const minUsd = Number(mins?.[idx] ?? NaN);
  if (!(Number.isFinite(minUsd) && minUsd > 0 && Number.isFinite(absSz) && absSz > 0)) return byR;

  // Approximate move needed to realize minUsd (ignores fees; still a big improvement over $1-3 TP1)
  const move = minUsd / absSz;
  const byUsd = side === 'long' ? (entryPx + move) : (entryPx - move);

  // Choose the more conservative target (further away) to ensure minimum dollar profit.
  // For longs: higher price is further away; for shorts: lower price is further away.
  return side === 'long' ? Math.max(byR, byUsd) : Math.min(byR, byUsd);
}

async function manageOpenPosition(pos){
  const side = pos.szi > 0 ? 'long' : 'short';
  const px = await midPx();
  const absSz = Math.abs(pos.szi);

  // Ensure state is initialized
  if (!state.activeSide || !state.entryPx){
    state.activeSide = side;
    state.entryPx = pos.entryPx;
  }
  if (!state.initialSz) state.initialSz = absSz;

  // ---- Exit plan (Price-based, R-multiple) ----
  // stopPct comes from the entry signal (ATR-sized) and is persisted in state.
  const stopPct = Number(state.stopPct || 0);
  if (!(stopPct > 0)) {
    // Without stopPct we cannot compute R-based exits safely.
    state.lastActionAt = Date.now();
    persistState();
    return;
  }

  // If stopPx isn't set (older state), derive it from entryPx and stopPct.
  if (!state.stopPx || !(state.stopPx > 0)){
    const delta = state.entryPx * stopPct;
    state.stopPx = side === 'long' ? (state.entryPx - delta) : (state.entryPx + delta);
  }

  // R-multiple TPs from config
  const tpPlan = Array.isArray(cfg?.exits?.tp) ? cfg.exits.tp : [];

  // ---- Place native HL TP/SL trigger orders (so they show in UI) ----
  // We place them once per position (best-effort). If they already exist, we won't spam.
  async function ensureNativeTpsl(){
    const posKey = `${side}:${Number(state.entryPx||0).toFixed(2)}:${Number(state.initialSz||absSz).toFixed(5)}:${Number(state.stopPct||0).toFixed(6)}`;
    if (state.exitsPlacedForPosKey === posKey) return { ok: true, posKey, wantCount: 0, okCount: 0 };

    // If SL/TP already exist, treat them as manually managed and do not cancel/replace.
    let hasExistingStop = false;
    let hasExistingTp = false;
    try {
      const oo = await sdk.info.getFrontendOpenOrders(cfg.wallet.address, true);
      const coinPerp = `${cfg.market.coin}-PERP`;
      hasExistingStop = (oo||[]).some(o => (o.coin===cfg.market.coin || o.coin===coinPerp) && o.reduceOnly===true && String(o.orderType||'').toLowerCase().includes('stop'));
      hasExistingTp = (oo||[]).some(o => (o.coin===cfg.market.coin || o.coin===coinPerp) && o.reduceOnly===true && (String(o.orderType||'').toLowerCase().includes('take profit') || o.tpsl === 'tp'));
    } catch {}

    // Clear existing triggers we own so we don't stack duplicates.
    // Respect manual exits: if there is an existing stop or TP, leave it alone.
    await cancelAllBtcOrders({ cancelStops: !hasExistingStop, cancelTps: !hasExistingTp }).catch(()=>{});

    // NOTE: For perp orders the SDK expects the perp symbol (e.g. 'BTC-PERP').
    const makeTrigger = async ({ isBuy, sz, triggerPx, tpsl }) => {
      // Hyperliquid requires limit_px + order_type.trigger. For isMarket triggers, limit_px is ignored,
      // but we still send something sane (same as triggerPx).
      const px = roundPx(cfg.market.coin, triggerPx);
      return sdk.exchange.placeOrder({
        coin: `${cfg.market.coin}-PERP`,
        is_buy: isBuy,
        sz: roundSz(cfg.market.coin, sz),
        limit_px: px,
        order_type: { trigger: { isMarket: true, triggerPx: px, tpsl } },
        reduce_only: true,
        grouping: 'positionTpsl',
      });
    };

    let okCount = 0;
    let wantCount = 0;
    const errors = [];

    // SL: close 100% if hit
    // If user has already set/modified a stop, leave it alone.
    const slPx = Number(state.stopPx);
    if (!hasExistingStop && slPx > 0 && absSz > 0){
      wantCount += 1;
      try {
        await makeTrigger({
          isBuy: side === 'short', // closing short is buy; closing long is sell
          sz: absSz,
          triggerPx: slPx,
          tpsl: 'sl',
        });
        okCount += 1;
      } catch (e){
        errors.push({ kind: 'sl', msg: e?.message || String(e) });
      }
    }

    // TPs: partial reduce-only triggers
    // Respect manual TP placement: if TPs already exist, don't add more.
    if (!hasExistingTp){
      for (let i = 0; i < tpPlan.length; i++){
        const t = tpPlan[i] || {};
        const r = Number(t.rMultiple || 0);
        const frac = Number(t.closeFrac || 0);
        if (!(r > 0) || !(frac > 0)) continue;

        const tpPx = tpPxFor({ side, entryPx: state.entryPx, stopPct, absSz, idx: i, rMultiple: r });

        const tpSz = Math.min(absSz, Number(state.initialSz || absSz) * frac);
        if (tpPx > 0 && tpSz > 0){
          wantCount += 1;
          try {
            await makeTrigger({
              isBuy: side === 'short',
              sz: tpSz,
              triggerPx: tpPx,
              tpsl: 'tp',
            });
            okCount += 1;
          } catch (e){
            errors.push({ kind: `tp${i+1}`, msg: e?.message || String(e) });
          }
        }
      }
    }

    if (wantCount > 0 && okCount === wantCount){
      // Verify they actually show up in frontend open orders (best-effort) before marking as placed.
      try {
        const oo = await sdk.info.getFrontendOpenOrders(cfg.wallet.address, true);
        const coinPerp = `${cfg.market.coin}-PERP`;
        const active = (oo||[]).filter(o => (o.coin===cfg.market.coin || o.coin===coinPerp) && o.reduceOnly===true && (String(o.orderType||'').toLowerCase().includes('stop') || String(o.orderType||'').toLowerCase().includes('take profit')));
        if (active.length >= wantCount) {
          state.exitsPlacedForPosKey = posKey;
          persistState();
          return { ok: true, posKey, wantCount, okCount, hasExistingStop, hasExistingTp };
        }
        console.error(nowIso(), 'TP/SL placement verify failed', { wantCount, found: active.length });
        return { ok: false, posKey, wantCount, okCount, hasExistingStop, hasExistingTp, errors: [{ kind: 'verify', msg: `found ${active.length}` }] };
      } catch {
        // If verify fails, still mark as placed to avoid spamming, since calls succeeded.
        state.exitsPlacedForPosKey = posKey;
        persistState();
        return { ok: true, posKey, wantCount, okCount, hasExistingStop, hasExistingTp, verified: false };
      }
    }

    // Don't mark as placed; we want to retry next loop.
    console.error(nowIso(), 'TP/SL placement incomplete', { okCount, wantCount, errors });
    return { ok: false, posKey, wantCount, okCount, hasExistingStop, hasExistingTp, errors };
  }

  const tpslStatus = await ensureNativeTpsl();

  // Safety: if we just opened and couldn't place TP/SL, we should not stay exposed.
  // We don't auto-close here (manageOpenPosition runs for existing positions too),
  // but we return status to the entry path which can enforce immediate protection.
  state.lastTpslStatus = tpslStatus;
  persistState();

  async function doClose({ closeSz, tpIndex=null, partial=true }){
    const resp = await sdk.custom.marketClose(`${cfg.market.coin}-PERP`, closeSz).catch(()=>null);
    try {
      const fill = resp?.response?.data?.statuses?.[0]?.filled;
      const exitPx = Number(fill?.avgPx || 0);
      const exitSz = Number(fill?.totalSz || closeSz);
      const pnlPartUsd = (exitPx && state.entryPx)
        ? ((side==='short' ? (state.entryPx - exitPx) : (exitPx - state.entryPx)) * exitSz)
        : null;
      const ev = { ts: nowIso(), action: 'CLOSE', side, sizeBtc: exitSz, entryPx: state.entryPx, exitPx, pnlUsd: pnlPartUsd, leader: 'signalbot', partial, tpIndex };
      fs.appendFileSync('/Users/jt/.openclaw/workspace/memory/hyperliquid-trades.jsonl', JSON.stringify(ev) + "\n");
    } catch {}
    return resp;
  }

  const baseSz = Number(state.initialSz || absSz);

  // Detect TP hits even when exits are handled natively by HL.
  // When TP1 is hit: optionally trail SL to breakeven (entryPx).
  // When TP2 is hit: optionally trail SL up/down to the TP1 price.
  try {
    const tp1 = Array.isArray(tpPlan) ? tpPlan[0] : null;
    const tp2 = Array.isArray(tpPlan) ? tpPlan[1] : null;

    const tp1Frac = Number(tp1?.closeFrac || 0);
    const tp2Frac = Number(tp2?.closeFrac || 0);

    if (baseSz > 0){
      const remainingFrac = absSz / baseSz;

      // ---- TP1 done detection ----
      if (!state.tp1Done && tp1Frac > 0){
        // TP1 is considered done once remaining size is <= (1 - tp1Frac) + small epsilon
        if (remainingFrac <= (1 - tp1Frac + 0.001)){
          state.tp1Done = true;
          persistState();

          if (cfg?.exits?.trailToBreakevenOnTp1){
            // Only move the stop in the risk-reducing direction.
            const bePx = Number(state.entryPx);
            if (bePx > 0){
              await replaceStopToBreakeven({ side, entryPx: bePx, absSz });
              // Update our internal stop reference too.
              state.stopPx = bePx;
              persistState();
            }
          }
        }
      }

      // ---- TP2 done detection ----
      // We treat TP2 as done once remaining size is <= 1 - (tp1Frac + tp2Frac)
      // (i.e. the first two partial closes have happened).
      const tp12Frac = tp1Frac + tp2Frac;
      if (!state.tp2Done && tp12Frac > 0 && tp2Frac > 0){
        if (remainingFrac <= (1 - tp12Frac + 0.001)){
          state.tp2Done = true;
          persistState();

          if (cfg?.exits?.trailStopToTp1OnTp2){
            const r1 = Number(tp1?.rMultiple || 0);
            if (r1 > 0){
              const tp1Px = tpPxFor({ side, entryPx: state.entryPx, stopPct, absSz, idx: 0, rMultiple: r1 });
              if (tp1Px > 0){
                // Only move the stop in the risk-reducing direction.
                // For a long, raising stop helps; for a short, lowering stop helps.
                const curStop = Number(state.stopPx || 0);
                const better = (side === 'long') ? (tp1Px > curStop) : (curStop === 0 ? true : tp1Px < curStop);
                if (better){
                  await replaceStopToBreakeven({ side, entryPx: tp1Px, absSz });
                  state.stopPx = tp1Px;
                  persistState();
                }
              }
            }
          }
        }
      }
    }
  } catch {}

  // If native TP/SL triggers are active on HL, don't also do in-code TP closes.
  // Otherwise you can double-exit (trigger fires + bot marketClose) and accidentally flatten.
  if (!tpslStatus?.ok){
    // ---- Take profits (price targets) ----
    for (let i = 0; i < tpPlan.length; i++){
      const t = tpPlan[i] || {};
      const r = Number(t.rMultiple || 0);
      const frac = Number(t.closeFrac || 0);
      if (!(r > 0) || !(frac > 0)) continue;

      const doneKey = i === 0 ? 'tp1Done' : i === 1 ? 'tp2Done' : `tp${i+1}Done`;
      if (state[doneKey]) continue;

      const targetPx = tpPxFor({ side, entryPx: state.entryPx, stopPct, absSz, idx: i, rMultiple: r });

      const hit = side === 'long' ? (px >= targetPx) : (px <= targetPx);
      if (!hit) continue;

      const desiredSz = roundSz(cfg.market.coin, baseSz * frac);
      const closeSz = Math.min(absSz, desiredSz);
      if (closeSz > 0){
        await doClose({ closeSz, tpIndex: i, partial: true });
        state[doneKey] = true;
        persistState();
      }
    }
  }

  // ---- Stop-out: if price crosses stopPx, close remaining ----
  if ((side==='long' && px <= state.stopPx) || (side==='short' && px >= state.stopPx)){
    await sdk.custom.marketClose(`${cfg.market.coin}-PERP`).catch(()=>null);

    state.lastExitAtMs = Date.now();
    state.activeSide = null;
    state.entryPx = null;
    state.entryNotionalUsd = null;
    state.initialSz = null;
    state.marginUsd = null;
    state.stopPct = null;
    state.stopPx = null;
    state.tp1Done = false;
    state.tp2Done = false;
    persistState();
    return;
  }

  // ---- Runner exit (optional): exit remaining when opposite signal prints ----
  if (String(cfg?.exits?.runnerExit || '').toLowerCase() === 'signal'){
    try {
      const symbol = `${cfg.market.coin}-PERP`;
      const c15 = await fetchOHLC(symbol, '15m', 3*24*60*60*1000);
      const c1h = await fetchOHLC(symbol, '1h', 14*24*60*60*1000);
      const sig = computeSignal({
        closes15m: c15.closes,
        highs15m: c15.highs,
        lows15m: c15.lows,
        closes1h: c1h.closes,
        priceNow: px,
        cfg,
      });
      if (sig && sig.side && sig.side !== side){
        await sdk.custom.marketClose(`${cfg.market.coin}-PERP`).catch(()=>null);

        state.lastExitAtMs = Date.now();
        state.activeSide = null;
        state.entryPx = null;
        state.entryNotionalUsd = null;
        state.initialSz = null;
        state.marginUsd = null;
        state.stopPct = null;
        state.stopPx = null;
        state.tp1Done = false;
        state.tp2Done = false;
        persistState();
        return;
      }
    } catch {}
  }

  state.lastActionAt = Date.now();
  persistState();
}

async function tryEnter(){
  // cooldown after a losing close
  const lossCooldownMin = Number(cfg?.risk?.lossCooldownMinutes ?? 30);
  if (Number.isFinite(lossCooldownMin) && lossCooldownMin > 0 && state.lastLossAtMs){
    const sinceLoss = Date.now() - state.lastLossAtMs;
    if (sinceLoss < lossCooldownMin * 60 * 1000) return;
  }

  // cooldown after exit
  if (cfg.risk.reentryCooldownSeconds && state.lastExitAtMs){
    const since = Date.now() - state.lastExitAtMs;
    if (since < cfg.risk.reentryCooldownSeconds*1000) return;
  }

  // pull candles
  const symbol = `${cfg.market.coin}-PERP`;
  const c15 = await fetchOHLC(symbol, '15m', 3*24*60*60*1000); // 3d
  const c1h = await fetchOHLC(symbol, '1h', 14*24*60*60*1000); // 14d
  const priceNow = await midPx();

  const sig = computeSignal({
    closes15m: c15.closes,
    highs15m: c15.highs,
    lows15m: c15.lows,
    closes1h: c1h.closes,
    priceNow,
    cfg,
  });

  if (!sig) return;

  // Cap stopPct by exits.stopLossPct (if provided)
  // AND by a max loss on margin constraint (if provided):
  //   loss% of marginUsed ≈ leverage * stopPct
  // so to cap loss on margin to 3% with 15x leverage: stopPct <= 0.03/15 = 0.002
  let stopCap = Number(cfg?.exits?.stopLossPct ?? Infinity);
  const maxMarginLossPct = Number(cfg?.exits?.maxMarginLossPct ?? NaN);
  const lev = Number(cfg?.risk?.maxLeverage ?? NaN);
  if (Number.isFinite(maxMarginLossPct) && maxMarginLossPct > 0 && Number.isFinite(lev) && lev > 0){
    stopCap = Math.min(stopCap, maxMarginLossPct / lev);
  }
  if (Number.isFinite(stopCap) && stopCap > 0) sig.stopPct = Math.min(sig.stopPct, stopCap);

  state.lastSignalAtMs = Date.now();

  const equity = await spotUsdc();
  if (equity <= 0) return;

  // Position sizing
  // Option A (default): risk-based sizing: notional = (equity * riskPerTradePct) / stopPct
  // Option B (if risk.marginUsePct is set): use a fixed fraction of equity as margin used.
  //   marginUsedTarget = equity * marginUsePct
  //   notionalTarget ≈ marginUsedTarget * maxLeverage
  const marginUsePct = Number(cfg?.risk?.marginUsePct ?? NaN);
  const levForSizing = Number(cfg?.risk?.maxLeverage ?? NaN);

  let cappedNotional;
  if (Number.isFinite(marginUsePct) && marginUsePct > 0 && marginUsePct <= 1 && Number.isFinite(levForSizing) && levForSizing > 0){
    cappedNotional = equity * marginUsePct * levForSizing;
  } else {
    const { notional } = computeRiskSizedNotional({ equityUsd: equity, stopPct: sig.stopPct });
    cappedNotional = Math.min(notional, equity * cfg.risk.maxLeverage);
  }

  const sz = cappedNotional / priceNow;
  if (sz <= 0) return;

  console.log(nowIso(), 'Signal', sig.side, 'enter notional', cappedNotional.toFixed(2), 'stopPct', sig.stopPct.toFixed(4), sig.reason);
  await ensureLeverage();
  const resp = await placeMarket(sig.side, sz);

  let avgPx = priceNow;
  let totalSz = sz;
  try {
    const fill = resp?.response?.data?.statuses?.[0]?.filled;
    avgPx = Number(fill?.avgPx || priceNow);
    totalSz = Number(fill?.totalSz || sz);
    const notionalUsd = (avgPx > 0 && totalSz > 0) ? (avgPx * totalSz) : null;
    const ev = { ts: nowIso(), action: 'OPEN', side: sig.side, sizeBtc: totalSz, entryPx: avgPx, notionalUsd, leader: 'signalbot' };
    fs.appendFileSync('/Users/jt/.openclaw/workspace/memory/hyperliquid-trades.jsonl', JSON.stringify(ev) + "\n");

    // Ping Telegram channel on open (best-effort)
    try {
      const stopPx = sig.side==='long' ? (avgPx * (1 - sig.stopPct)) : (avgPx * (1 + sig.stopPct));
      const tpPlan = Array.isArray(cfg?.exits?.tp) ? cfg.exits.tp : [];
      const tps = tpPlan.map((t, idx) => {
        const r = Number(t?.rMultiple||0);
        const frac = Number(t?.closeFrac||0);
        if (!(r>0) || !(frac>0)) return null;
        const tpPx = sig.side==='long' ? (avgPx * (1 + r * sig.stopPct)) : (avgPx * (1 - r * sig.stopPct));
        return `TP${idx+1} ${roundPx(cfg.market.coin, tpPx)} (${Math.round(frac*100)}%)`;
      }).filter(Boolean).join(' | ');

      const msg = [
        `HL SIGNALBOT OPEN`,
        `${sig.side.toUpperCase()} BTC`,
        `${roundSz(cfg.market.coin, totalSz)} @ ${roundPx(cfg.market.coin, avgPx)}`,
        `SL ${roundPx(cfg.market.coin, stopPx)}`,
        tps ? tps : null,
      ].filter(Boolean).join(' | ');
      await tgSend(msg);
    } catch {}
  } catch {}

  // initialize plan
  state.activeSide = sig.side;
  state.stopPct = sig.stopPct;
  state.entryPx = avgPx;
  state.entryNotionalUsd = (avgPx > 0 && totalSz > 0) ? (avgPx * totalSz) : null;
  state.initialSz = totalSz;
  // marginUsd will be derived from entryNotionalUsd and leverageSetting during manageOpenPosition.
  state.marginUsd = null;
  // Price-based stop (ATR-sized): entry +/- entry*stopPct
  state.stopPx = sig.side==='long' ? (avgPx * (1 - sig.stopPct)) : (avgPx * (1 + sig.stopPct));
  state.tp1Done = false;
  state.tp2Done = false;
  // Force TP/SL re-placement for the new position.
  state.exitsPlacedForPosKey = null;
  persistState();

  // Place native TP/SL immediately after entry and ENFORCE protection.
  // If we cannot get TP/SL placed within a few seconds, we close the position to avoid naked exposure.
  try {
    await manageOpenPosition({ szi: sig.side==='long' ? totalSz : -totalSz, entryPx: avgPx });

    const st = state.lastTpslStatus;
    const ok = st && st.ok;
    if (!ok){
      // One quick retry after a short delay (covers transient API hiccups)
      await new Promise(r=>setTimeout(r, 1500));
      await manageOpenPosition({ szi: sig.side==='long' ? totalSz : -totalSz, entryPx: avgPx });
    }

    const st2 = state.lastTpslStatus;
    const ok2 = st2 && st2.ok;
    if (!ok2){
      console.error(nowIso(), 'FATAL: TP/SL not placed after entry; closing to avoid exposure', st2);
      try { await sdk.custom.marketClose(`${cfg.market.coin}-PERP`); } catch {}
      state.lastExitAtMs = Date.now();
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
      persistState();
    }
  } catch {}

  state.lastActionAt = Date.now();
}

async function mainLoop(){
  if (state.halted) return;
  const now = Date.now();
  if (now < state.backoffUntilMs) return;
  if ((now - state.lastActionAt) < (cfg.risk.cooldownSeconds*1000)) return;

  const dp = await dailyPnl();
  if (dp < -Math.abs(cfg.risk.maxDailyLossUsd)){
    state.halted = true;
    console.log(nowIso(), 'HALT: daily pnl', dp, 'below', -Math.abs(cfg.risk.maxDailyLossUsd));
    await cancelAllBtcOrders().catch(()=>{});
    try { await sdk.custom.marketClose(`${cfg.market.coin}-PERP`); } catch {}
    persistState();
    return;
  }

  const pos = await getBtcPosition();
  if (Math.abs(pos.szi) > 0){
    await manageOpenPosition(pos);
    await pingNewFills();
    return;
  }

  await tryEnter();
  await pingNewFills();
  state.lastActionAt = Date.now();
}

function onLoopError(e){
  const msg = e?.message || String(e);
  state.errStreak = Math.min(20, state.errStreak + 1);
  const backoffMs = Math.min(120_000, 5_000 * Math.pow(2, Math.min(6, state.errStreak)));
  state.backoffUntilMs = Date.now() + backoffMs;
  console.error(nowIso(), 'loop err', { msg, errStreak: state.errStreak, backoffMs });
  persistState();
}

console.log(nowIso(), 'HL signalbot starting', { wallet: cfg.wallet.address, coin: cfg.market.coin, pollMs: cfg.signal.pollMs });

// Prevent overlapping loops (can cause duplicate entries and duplicate TP/SL placement)
let loopInFlight = false;
setInterval(async ()=>{
  if (loopInFlight) return;
  loopInFlight = true;
  try {
    await mainLoop();
    state.errStreak = 0;
    persistState();
  } catch (e){
    onLoopError(e);
  } finally {
    loopInFlight = false;
  }
}, cfg.signal.pollMs);
