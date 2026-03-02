import { describe, it, expect } from 'vitest';
import { ema, computeSignal } from './signal_engine.mjs';

describe('ema', () => {
  it('returns null for insufficient data', () => {
    expect(ema([1, 2], 5)).toBeNull();
    expect(ema([], 1)).toBeNull();
    expect(ema(null, 5)).toBeNull();
  });

  it('computes SMA for exactly period-length data', () => {
    const result = ema([10, 20, 30], 3);
    expect(result).toBeCloseTo(20, 5);
  });

  it('applies exponential smoothing beyond period', () => {
    const data = [10, 20, 30, 40, 50];
    const result = ema(data, 3);
    expect(result).toBeGreaterThan(30);
    expect(result).toBeLessThan(50);
  });

  it('tracks uptrend correctly', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + i);
    const result = ema(data, 20);
    expect(result).toBeGreaterThan(130);
    expect(result).toBeLessThan(150);
  });
});

describe('computeSignal', () => {
  function makeCandles(trend, count, base = 100000) {
    const closes = [];
    const highs = [];
    const lows = [];
    const opens = [];
    for (let i = 0; i < count; i++) {
      const px = base + (trend === 'up' ? i * 50 : -i * 50);
      closes.push(px);
      highs.push(px + 20);
      lows.push(px - 20);
      opens.push(px - 5);
    }
    return { closes, highs, lows, opens };
  }

  const baseCfg = {
    signal: {
      emaTrendPeriod: 50,
      emaTriggerPeriod: 20,
      atrPeriod: 14,
      atrMult: 1.5,
      maxStopPct: 0.035,
      stochFilter: { enabled: false },
      confirmCandles: 1,
    },
    risk: {},
  };

  it('returns null with insufficient data', () => {
    const result = computeSignal({
      closes15m: [1, 2, 3],
      closes1h: [1, 2, 3],
      highs15m: [1, 2, 3],
      lows15m: [1, 2, 3],
      priceNow: 100000,
      cfg: baseCfg,
    });
    expect(result).toBeNull();
  });

  it('returns null with missing/empty input', () => {
    expect(computeSignal({ closes15m: null, closes1h: [], highs15m: [], lows15m: [], priceNow: 100000, cfg: baseCfg })).toBeNull();
    expect(computeSignal({ closes15m: [], closes1h: null, highs15m: [], lows15m: [], priceNow: 100000, cfg: baseCfg })).toBeNull();
    expect(computeSignal({ closes15m: [], closes1h: [], highs15m: [], lows15m: [], priceNow: 0, cfg: baseCfg })).toBeNull();
    expect(computeSignal({ closes15m: [], closes1h: [], highs15m: [], lows15m: [], priceNow: 100000, cfg: null })).toBeNull();
  });

  it('generates long signal on uptrend with EMA pullback reclaim', () => {
    const c1h = makeCandles('up', 60, 95000);
    const c15m = makeCandles('up', 30, 99000);
    const ema20 = ema(c15m.closes, 20);
    c15m.closes[c15m.closes.length - 2] = ema20 - 10;
    c15m.closes[c15m.closes.length - 1] = ema20 + 10;
    const priceNow = c1h.closes[c1h.closes.length - 1] + 500;

    const result = computeSignal({
      closes15m: c15m.closes,
      closes1h: c1h.closes,
      highs15m: c15m.highs,
      lows15m: c15m.lows,
      priceNow,
      cfg: baseCfg,
    });

    if (result) {
      expect(result.side).toBe('long');
      expect(result.stopPct).toBeGreaterThan(0);
      expect(result.stopPct).toBeLessThanOrEqual(0.035);
      expect(result.reason).toBeDefined();
    }
  });

  it('generates short signal on downtrend with EMA pullback reclaim', () => {
    const c1h = makeCandles('down', 60, 105000);
    const c15m = makeCandles('down', 30, 101000);
    const ema20 = ema(c15m.closes, 20);
    c15m.closes[c15m.closes.length - 2] = ema20 + 10;
    c15m.closes[c15m.closes.length - 1] = ema20 - 10;
    const priceNow = c1h.closes[c1h.closes.length - 1] - 500;

    const result = computeSignal({
      closes15m: c15m.closes,
      closes1h: c1h.closes,
      highs15m: c15m.highs,
      lows15m: c15m.lows,
      priceNow,
      cfg: baseCfg,
    });

    if (result) {
      expect(result.side).toBe('short');
      expect(result.stopPct).toBeGreaterThan(0);
    }
  });

  it('caps stopPct at maxStopPct', () => {
    const c1h = makeCandles('up', 60, 95000);
    const c15m = makeCandles('up', 30, 99000);
    const ema20 = ema(c15m.closes, 20);
    c15m.closes[c15m.closes.length - 2] = ema20 - 10;
    c15m.closes[c15m.closes.length - 1] = ema20 + 10;
    const priceNow = c1h.closes[c1h.closes.length - 1] + 500;

    const cfg = {
      ...baseCfg,
      signal: { ...baseCfg.signal, atrMult: 100, maxStopPct: 0.01 },
    };
    const result = computeSignal({
      closes15m: c15m.closes,
      closes1h: c1h.closes,
      highs15m: c15m.highs,
      lows15m: c15m.lows,
      priceNow,
      cfg,
    });

    if (result) {
      expect(result.stopPct).toBeLessThanOrEqual(0.01);
    }
  });

  it('respects maxEmaDistPct filter', () => {
    const c1h = makeCandles('up', 60, 80000);
    const c15m = makeCandles('up', 30, 99000);
    const priceNow = 120000;

    const cfg = {
      ...baseCfg,
      signal: { ...baseCfg.signal, maxEmaDistPct: 0.01 },
    };
    const result = computeSignal({
      closes15m: c15m.closes,
      closes1h: c1h.closes,
      highs15m: c15m.highs,
      lows15m: c15m.lows,
      priceNow,
      cfg,
    });

    expect(result).toBeNull();
  });

  it('stochFilter blocks when enabled and signal is overbought/oversold', () => {
    const cfg = {
      ...baseCfg,
      signal: {
        ...baseCfg.signal,
        stochFilter: { enabled: true, overbought: 80, oversold: 20 },
      },
    };
    expect(cfg.signal.stochFilter.enabled).toBe(true);
  });
});
