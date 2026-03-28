import { describe, it, expect } from 'vitest';
import {
  calculateDose,
  applySafetyRules,
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

// ─── Task 3: applySafetyRules ─────────────────────────────────────────────────

describe('applySafetyRules', () => {
  const baseContext = {
    glycemia: 1.10, doseSuggeree: 4.0, correction: 0, iobTotal: 0,
    trend: '?', activity: 'aucune', postKeto: false, maxDose: 10,
    lastInjectionMinutesAgo: null,
  };

  it('blocks injection for severe hypo', () => {
    const r = applySafetyRules({ ...baseContext, glycemia: 0.55, doseSuggeree: 2 });
    expect(r.blocked).toBe(true);
    expect(r.risks).toContainEqual(expect.objectContaining({ type: 'anti-hypo' }));
    expect(r.adjustedDose).toBe(0);
  });

  it('reduces dose 50% for near-hypo', () => {
    const r = applySafetyRules({ ...baseContext, glycemia: 0.80, doseSuggeree: 4.0 });
    expect(r.adjustedDose).toBe(2.0);
    expect(r.risks).toContainEqual(expect.objectContaining({ type: 'hypo-proche' }));
  });

  it('warns about stacking', () => {
    const r = applySafetyRules({ ...baseContext, iobTotal: 3, correction: 1 });
    expect(r.warnings).toContainEqual(expect.objectContaining({ type: 'anti-stacking' }));
  });

  it('warns about timing', () => {
    const r = applySafetyRules({ ...baseContext, lastInjectionMinutesAgo: 90 });
    expect(r.warnings).toContainEqual(expect.objectContaining({ type: 'alerte-timing' }));
  });

  it('blocks overdose', () => {
    const r = applySafetyRules({ ...baseContext, doseSuggeree: 12, maxDose: 10 });
    expect(r.blocked).toBe(true);
    expect(r.risks).toContainEqual(expect.objectContaining({ type: 'surdosage' }));
  });

  it('reduces correction for falling trend', () => {
    const r = applySafetyRules({
      ...baseContext, glycemia: 1.80, doseSuggeree: 5.0, correction: 1.0, trend: '↓',
    });
    expect(r.adjustedDose).toBeLessThan(5.0);
    expect(r.warnings).toContainEqual(expect.objectContaining({ type: 'sur-correction' }));
  });

  it('ignores trend when unknown', () => {
    const r = applySafetyRules({
      ...baseContext, glycemia: 1.80, doseSuggeree: 5.0, correction: 1.0, trend: '?',
    });
    expect(r.warnings.find(w => w.type === 'sur-correction')).toBeUndefined();
  });

  it('adds post-keto warning', () => {
    const r = applySafetyRules({ ...baseContext, postKeto: true });
    expect(r.warnings).toContainEqual(expect.objectContaining({ type: 'post-keto' }));
  });

  it('returns no issues for normal situation', () => {
    const r = applySafetyRules(baseContext);
    expect(r.blocked).toBe(false);
    expect(r.risks).toHaveLength(0);
    expect(r.adjustedDose).toBe(4.0);
  });
});
