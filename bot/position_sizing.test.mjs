import { describe, it, expect } from 'vitest';

function computeRiskSizedNotional({ equityUsd, stopPct }) {
  const riskPerTradePct = 0.01;
  const riskUsd = equityUsd * riskPerTradePct;
  const notional = riskUsd / Math.max(1e-6, stopPct);
  return { riskUsd, notional };
}

function marginBasedNotional({ equity, marginUsePct, leverage }) {
  return equity * marginUsePct * leverage;
}

function capNotional(notional, maxPositionNotionalUsd) {
  if (Number.isFinite(maxPositionNotionalUsd) && maxPositionNotionalUsd > 0) {
    return Math.min(notional, maxPositionNotionalUsd);
  }
  return notional;
}

describe('risk-based position sizing', () => {
  it('computes correct riskUsd', () => {
    const { riskUsd } = computeRiskSizedNotional({ equityUsd: 10000, stopPct: 0.02 });
    expect(riskUsd).toBeCloseTo(100, 2);
  });

  it('computes correct notional for 2% stop', () => {
    const { notional } = computeRiskSizedNotional({ equityUsd: 10000, stopPct: 0.02 });
    expect(notional).toBeCloseTo(5000, 0);
  });

  it('computes larger notional for tighter stop', () => {
    const { notional: tight } = computeRiskSizedNotional({ equityUsd: 10000, stopPct: 0.005 });
    const { notional: wide } = computeRiskSizedNotional({ equityUsd: 10000, stopPct: 0.02 });
    expect(tight).toBeGreaterThan(wide);
  });

  it('handles very small stopPct without overflow', () => {
    const { notional } = computeRiskSizedNotional({ equityUsd: 10000, stopPct: 0.0001 });
    expect(Number.isFinite(notional)).toBe(true);
    expect(notional).toBeGreaterThan(0);
  });

  it('handles zero stopPct gracefully', () => {
    const { notional } = computeRiskSizedNotional({ equityUsd: 10000, stopPct: 0 });
    expect(Number.isFinite(notional)).toBe(true);
  });

  it('handles zero equity', () => {
    const { riskUsd, notional } = computeRiskSizedNotional({ equityUsd: 0, stopPct: 0.02 });
    expect(riskUsd).toBe(0);
    expect(notional).toBe(0);
  });
});

describe('margin-based position sizing', () => {
  it('computes correct notional for 50% margin at 10x', () => {
    const notional = marginBasedNotional({ equity: 10000, marginUsePct: 0.5, leverage: 10 });
    expect(notional).toBe(50000);
  });

  it('computes correct notional for 100% margin at 20x', () => {
    const notional = marginBasedNotional({ equity: 5000, marginUsePct: 1.0, leverage: 20 });
    expect(notional).toBe(100000);
  });

  it('returns 0 for zero equity', () => {
    expect(marginBasedNotional({ equity: 0, marginUsePct: 0.5, leverage: 10 })).toBe(0);
  });
});

describe('maxPositionNotionalUsd cap', () => {
  it('caps when notional exceeds max', () => {
    const capped = capNotional(100000, 50000);
    expect(capped).toBe(50000);
  });

  it('does not cap when under limit', () => {
    const capped = capNotional(30000, 50000);
    expect(capped).toBe(30000);
  });

  it('ignores cap when not configured (NaN)', () => {
    const capped = capNotional(100000, NaN);
    expect(capped).toBe(100000);
  });

  it('ignores cap when zero', () => {
    const capped = capNotional(100000, 0);
    expect(capped).toBe(100000);
  });
});
