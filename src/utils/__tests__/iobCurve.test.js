import { describe, it, expect } from 'vitest';
import { calcIOB, calcTotalIOB } from '../iobCurve.js';

describe('calcIOB – Walsh model', () => {
  const DIA = 270; // 4h30 default

  it('returns full dose at T=0', () => {
    expect(calcIOB(4, 0, DIA)).toBeCloseTo(4, 1);
  });

  it('returns 0 when T >= DIA', () => {
    expect(calcIOB(4, 270, DIA)).toBe(0);
    expect(calcIOB(4, 300, DIA)).toBe(0);
  });

  it('returns 0 for dose=0', () => {
    expect(calcIOB(0, 60, DIA)).toBe(0);
  });

  it('decreases over time', () => {
    const iob60 = calcIOB(4, 60, DIA);
    const iob120 = calcIOB(4, 120, DIA);
    const iob200 = calcIOB(4, 200, DIA);
    expect(iob60).toBeGreaterThan(iob120);
    expect(iob120).toBeGreaterThan(iob200);
    expect(iob200).toBeGreaterThan(0);
  });

  it('is roughly 50% at midpoint', () => {
    const mid = calcIOB(4, 135, DIA);
    expect(mid).toBeGreaterThan(1.0);
    expect(mid).toBeLessThan(3.0);
  });

  it('clamps to [0, dose]', () => {
    const nearEnd = calcIOB(4, 269, DIA);
    expect(nearEnd).toBeGreaterThanOrEqual(0);
    expect(nearEnd).toBeLessThanOrEqual(4);
  });

  it('handles negative minutes gracefully', () => {
    expect(calcIOB(4, -10, DIA)).toBeCloseTo(4, 1);
  });

  it('works with custom DIA', () => {
    const shortDIA = calcIOB(4, 120, 180);
    const longDIA = calcIOB(4, 120, 360);
    expect(longDIA).toBeGreaterThan(shortDIA);
  });
});

describe('calcTotalIOB', () => {
  it('sums IOB from multiple injections', () => {
    const injections = [
      { dose: 4, minutesAgo: 60 },
      { dose: 2, minutesAgo: 120 },
    ];
    const total = calcTotalIOB(injections, 270);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(6);
  });

  it('returns 0 for empty array', () => {
    expect(calcTotalIOB([], 270)).toBe(0);
  });
});
