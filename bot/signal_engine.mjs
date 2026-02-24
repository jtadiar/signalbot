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

  // Stochastic RSI: RSI → apply Stochastic formula over RSI values
  function stochRsi(closes, rsiPeriod, stochPeriod) {
    if (!closes || closes.length < rsiPeriod + stochPeriod + 1) return null;
    // Step 1: compute RSI series
    const rsiValues = [];
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i < closes.length; i++) {
      const delta = closes[i] - closes[i - 1];
      const gain = delta > 0 ? delta : 0;
      const loss = delta < 0 ? -delta : 0;
      if (i <= rsiPeriod) {
        avgGain += gain;
        avgLoss += loss;
        if (i === rsiPeriod) {
          avgGain /= rsiPeriod;
          avgLoss /= rsiPeriod;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsiValues.push(100 - 100 / (1 + rs));
        }
      } else {
        avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
        avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsiValues.push(100 - 100 / (1 + rs));
      }
    }
    if (rsiValues.length < stochPeriod) return null;
    // Step 2: Stochastic of RSI — %K
    const window = rsiValues.slice(-stochPeriod);
    const minRsi = Math.min(...window);
    const maxRsi = Math.max(...window);
    if (maxRsi === minRsi) return 50;
    return ((rsiValues[rsiValues.length - 1] - minRsi) / (maxRsi - minRsi)) * 100;
  }

  const ema1h50 = ema(closes1h, 50);
  const ema15m20 = ema(closes15m, 20);
  const atr15 = atr(highs15m, lows15m, closes15m, 14);
  if (!ema1h50 || !ema15m20 || !atr15) return null;

  const atrPct = atr15 / priceNow;
  if (cfg.risk?.atrMinPct && atrPct < cfg.risk.atrMinPct) return null;

  const lastClose15 = closes15m[closes15m.length-1];
  const prevClose15 = closes15m[closes15m.length-2];
  const prev2Close15 = closes15m.length >= 3 ? closes15m[closes15m.length-3] : null;

  const trendUp = priceNow > ema1h50;
  const trendDown = priceNow < ema1h50;

  // Pullback + reclaim: previous close on wrong side of EMA20, then close back.
  const reclaimedUp = (prevClose15 <= ema15m20) && (lastClose15 > ema15m20);
  const reclaimedDown = (prevClose15 >= ema15m20) && (lastClose15 < ema15m20);

  // ---- Filter 1: Distance-from-EMA (reject extended moves) ----
  const maxEmaDistPct = Number(cfg?.signal?.maxEmaDistPct ?? 0);
  if (maxEmaDistPct > 0) {
    const dist = Math.abs(priceNow - ema1h50) / ema1h50;
    if (dist > maxEmaDistPct) return null;
  }

  // ---- Filter 2: Stochastic RSI (reject overbought/oversold entries) ----
  const stochEnabled = cfg?.signal?.stochFilter?.enabled !== false;
  const stochOverbought = Number(cfg?.signal?.stochFilter?.overbought ?? 80);
  const stochOversold = Number(cfg?.signal?.stochFilter?.oversold ?? 20);
  if (stochEnabled) {
    const stoch = stochRsi(closes15m, 14, 14);
    if (stoch !== null) {
      // Don't short when oversold (bounce likely), don't long when overbought (pullback likely)
      if (trendDown && reclaimedDown && stoch <= stochOversold) return null;
      if (trendUp && reclaimedUp && stoch >= stochOverbought) return null;
    }
  }

  // ---- Filter 3: Multi-candle confirmation ----
  const confirmCandles = Number(cfg?.signal?.confirmCandles ?? 1);
  if (confirmCandles >= 2 && prev2Close15 !== null) {
    // For 2-candle confirmation: require 2 consecutive closes on the reclaim side
    if (trendUp && reclaimedUp) {
      if (!(prev2Close15 <= ema15m20)) return null;
    }
    if (trendDown && reclaimedDown) {
      if (!(prev2Close15 >= ema15m20)) return null;
    }
  }

  // stopPct based on ATR multiple, capped
  const stopPctRaw = (cfg.signal?.atrMult ?? 1.5) * atrPct;
  const cap = cfg.signal?.maxStopPct ?? 0.035;
  const stopPct = Math.min(cap, stopPctRaw);

  const reasons = [];
  if (trendUp && reclaimedUp){
    reasons.push('trendUp (1h EMA50)', '15m reclaim EMA20');
    return { side: 'long', stopPct, reason: reasons.join(' + ') + `; atrPct=${atrPct.toFixed(4)}` };
  }
  if (trendDown && reclaimedDown){
    reasons.push('trendDown (1h EMA50)', '15m reclaim EMA20');
    return { side: 'short', stopPct, reason: reasons.join(' + ') + `; atrPct=${atrPct.toFixed(4)}` };
  }
  return null;
}
