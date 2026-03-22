import { describe, it, expect } from 'vitest';
import {
  round05, calcIOB, calcWeightSuggestions, calcPostMealCorrection,
  getOverallFat, getDominantGI,
} from '../calculations.js';

describe('round05', () => {
  it('rounds 0.3 to 0.5', () => expect(round05(0.3)).toBe(0.5));
  it('rounds 0.7 to 0.5', () => expect(round05(0.7)).toBe(0.5));
  it('rounds 0.8 to 1.0', () => expect(round05(0.8)).toBe(1));
  it('keeps 1.0 as 1.0', () => expect(round05(1.0)).toBe(1));
  it('rounds 0 to 0', () => expect(round05(0)).toBe(0));
  it('rounds 2.3 to 2.5', () => expect(round05(2.3)).toBe(2.5));
});

describe('calcIOB', () => {
  it('returns full dose at t=0', () => expect(calcIOB(10, 0, 240)).toBe(10));
  it('returns 0 at t=end', () => expect(calcIOB(10, 240, 240)).toBe(0));
  it('returns ~3.5 at mid-point (t=120/240)', () => {
    const iob = calcIOB(10, 120, 240);
    expect(iob).toBeGreaterThan(3);
    expect(iob).toBeLessThan(4);
  });
  it('returns 0 for dose=0', () => expect(calcIOB(0, 60, 240)).toBe(0));
  it('returns full dose for negative elapsed time', () => expect(calcIOB(10, -5, 240)).toBe(10));
});

describe('calcWeightSuggestions', () => {
  it('returns null for weight < 20', () => expect(calcWeightSuggestions(15)).toBeNull());
  it('returns null for weight > 200', () => expect(calcWeightSuggestions(250)).toBeNull());
  it('returns null for NaN', () => expect(calcWeightSuggestions(NaN)).toBeNull());
  it('returns valid values for 70kg', () => {
    const r = calcWeightSuggestions(70);
    expect(r.tdd).toBe(35);
    expect(r.icr).toBe(14);
    expect(r.isfMg).toBe(49);
    expect(r.basal).toBe(17.5);
    expect(r.bolus).toBe(17.5);
  });
  it('handles boundary 20kg', () => {
    const r = calcWeightSuggestions(20);
    expect(r).not.toBeNull();
    expect(r.tdd).toBe(10);
  });
});

describe('calcPostMealCorrection', () => {
  it('returns ok_low when glycemia <= target', () => {
    const r = calcPostMealCorrection(1.0, 1.2, 50, 0);
    expect(r.status).toBe('ok_low');
    expect(r.units).toBe(0);
  });
  it('returns correction for mild hyperglycemia', () => {
    const r = calcPostMealCorrection(1.8, 1.2, 50, 0);
    expect(r.status).toBe('correction');
    expect(r.units).toBeGreaterThan(0);
  });
  it('subtracts IOB from correction', () => {
    const withoutIOB = calcPostMealCorrection(2.0, 1.2, 50, 0);
    const withIOB = calcPostMealCorrection(2.0, 1.2, 50, 1);
    expect(withIOB.units).toBeLessThan(withoutIOB.units);
  });
  it('triggers urgent_override at 3.0+ with full IOB coverage', () => {
    const r = calcPostMealCorrection(3.5, 1.2, 50, 100);
    expect(r.status).toBe('urgent_override');
    expect(r.units).toBeGreaterThan(0);
  });
  it('triggers warn_override at 2.0-2.5 with full IOB coverage', () => {
    const r = calcPostMealCorrection(2.2, 1.2, 50, 100);
    expect(r.status).toBe('warn_override');
    expect(r.units).toBeGreaterThan(0);
  });
  it('never returns negative units', () => {
    const r = calcPostMealCorrection(1.5, 1.2, 50, 100);
    expect(r.units).toBeGreaterThanOrEqual(0);
  });
});

describe('getOverallFat', () => {
  it('returns faible for empty selection', () => expect(getOverallFat([])).toBe('faible'));
  it('returns élevé for high-fat items', () => {
    const sel = [{ food: { fat: 'élevé' }, mult: 2 }];
    expect(getOverallFat(sel)).toBe('élevé');
  });
});

describe('getDominantGI', () => {
  it('returns moyen for empty selection', () => expect(getDominantGI([])).toBe('moyen'));
  it('returns the GI with most carbs', () => {
    const sel = [
      { food: { gi: 'faible', carbs: 10 }, mult: 1 },
      { food: { gi: 'élevé', carbs: 50 }, mult: 1 },
    ];
    expect(getDominantGI(sel)).toBe('élevé');
  });
});
