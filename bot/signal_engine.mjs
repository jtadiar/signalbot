// Standalone BTC-PERP signal engine (EMA trend + EMA pullback + ATR stop sizing)
// Returns: { side: 'long'|'short', stopPct, reason } or null

export function computeSignal({ closes15m, closes1h, highs15m, lows15m, priceNow, cfg }){
  const ema = (arr, period) => {
    if (!arr || arr.length < period) return null;
    const k = 2 / (period + 1);
    let e = arr.slice(0, period).reduce((a,b)=>a+b,0) / period;
    for (let i=period;i<arr.length;i++) e = arr[i]*k + e*(1-k);
    return e;
  };
  const atr = (highs, lows, closes, period) => {
    if (!highs || !lows || !closes || highs.length < period+1) return null;
    const trs=[];
    for (let i=1;i<highs.length;i++){
      const h=highs[i], l=lows[i], pc=closes[i-1];
      const tr = Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc));
      trs.push(tr);
    }
    if (trs.length < period) return null;
    // Wilder's smoothing
    let a = trs.slice(0, period).reduce((x,y)=>x+y,0) / period;
    for (let i=period;i<trs.length;i++) a = (a*(period-1)+trs[i]) / period;
    return a;
  };

  const ema1h50 = ema(closes1h, 50);
  const ema15m20 = ema(closes15m, 20);
  const atr15 = atr(highs15m, lows15m, closes15m, 14);
  if (!ema1h50 || !ema15m20 || !atr15) return null;

  const atrPct = atr15 / priceNow;
  if (cfg.risk?.atrMinPct && atrPct < cfg.risk.atrMinPct) return null;

  const lastClose15 = closes15m[closes15m.length-1];
  const prevClose15 = closes15m[closes15m.length-2];

  const trendUp = priceNow > ema1h50;
  const trendDown = priceNow < ema1h50;

  // Pullback + reclaim: previous close on wrong side of EMA20, then close back.
  const reclaimedUp = (prevClose15 <= ema15m20) && (lastClose15 > ema15m20);
  const reclaimedDown = (prevClose15 >= ema15m20) && (lastClose15 < ema15m20);

  // stopPct based on ATR multiple, capped
  const stopPctRaw = (cfg.signal?.atrMult ?? 1.5) * atrPct;
  const cap = cfg.signal?.maxStopPct ?? 0.035;
  const stopPct = Math.min(cap, stopPctRaw);

  if (trendUp && reclaimedUp){
    return { side: 'long', stopPct, reason: `trendUp (1h EMA50) + 15m reclaim EMA20; atrPct=${atrPct.toFixed(4)}` };
  }
  if (trendDown && reclaimedDown){
    return { side: 'short', stopPct, reason: `trendDown (1h EMA50) + 15m reclaim EMA20; atrPct=${atrPct.toFixed(4)}` };
  }
  return null;
}

