import { describe, it, expect } from 'vitest';
import {
  calculateDose,
  FAT_FACTOR,
  ACTIVITY_REDUCTION,
} from '../clinicalEngine.js';

// ─── Task 2: calculateDose ────────────────────────────────────────────────────

describe('calculateDose', () => {
  const baseParams = {
    totalCarbs: 60, glycemia: 1.10, ratio: 15, isf: 0.60,
    targetMax: 1.20, iobTotal: 0, fatLevel: 'aucun', activity: 'aucune',
  };

  it('calculates simple meal bolus without correction', () => {
    const r = calculateDose(baseParams);
    expect(r.bolusRepas).toBeCloseTo(4.0);
    expect(r.correction).toBe(0);
    expect(r.doseSuggeree).toBe(4.0);
  });

  it('adds correction when glycemia > targetMax', () => {
    const r = calculateDose({ ...baseParams, glycemia: 1.80 });
    expect(r.correction).toBeCloseTo(1.0);
    expect(r.doseSuggeree).toBe(5.0);
  });

  it('subtracts IOB from correction only', () => {
    const r = calculateDose({ ...baseParams, glycemia: 1.80, iobTotal: 0.5 });
    expect(r.correctionNette).toBeCloseTo(0.5);
    expect(r.doseSuggeree).toBe(4.5);
  });

  it('does not let IOB make correction negative', () => {
    const r = calculateDose({ ...baseParams, glycemia: 1.50, iobTotal: 3 });
    expect(r.correctionNette).toBe(0);
    expect(r.doseSuggeree).toBe(4.0);
  });

  it('applies fat bonus', () => {
    const r = calculateDose({ ...baseParams, fatLevel: 'moyen' });
    expect(r.bonusGras).toBeCloseTo(0.56);
    expect(r.doseSuggeree).toBe(4.5);
  });

  it('reduces dose for moderate activity', () => {
    const r = calculateDose({ ...baseParams, activity: 'moderee' });
    expect(r.doseSuggeree).toBe(3.0);
  });

  it('reduces dose for intense activity', () => {
    const r = calculateDose({ ...baseParams, activity: 'intense' });
    expect(r.doseSuggeree).toBe(3.0);
  });

  it('rounds to nearest 0.5', () => {
    const r = calculateDose({ ...baseParams, totalCarbs: 37 });
    expect(r.doseSuggeree).toBe(2.5);
  });
});

describe('FAT_FACTOR', () => {
  it('has correct values', () => {
    expect(FAT_FACTOR.aucun).toBe(0);
    expect(FAT_FACTOR.faible).toBe(0.04);
    expect(FAT_FACTOR.moyen).toBe(0.14);
    expect(FAT_FACTOR['élevé']).toBe(0.27);
  });
});

describe('ACTIVITY_REDUCTION', () => {
  it('has correct values', () => {
    expect(ACTIVITY_REDUCTION.aucune).toBe(1.0);
    expect(ACTIVITY_REDUCTION.legere).toBe(1.0);
    expect(ACTIVITY_REDUCTION.moderee).toBe(0.80);
    expect(ACTIVITY_REDUCTION.intense).toBe(0.70);
  });
});
