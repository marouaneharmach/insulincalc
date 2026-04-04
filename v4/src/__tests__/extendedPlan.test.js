import { describe, it, expect } from 'vitest';
import {
  determineSplit,
  analyzeAndRecommend,
  round05,
} from '../utils/clinicalEngine';

// ─── determineSplit — basic behavior (unchanged) ─────────────────────────────

describe('determineSplit — basic', () => {
  it('returns unique for zero dose', () => {
    const r = determineSplit(0, 'aucun', false);
    expect(r.type).toBe('unique');
    expect(r.immediate).toBe(0);
    expect(r.delayed).toBe(0);
  });

  it('returns unique for faible fat', () => {
    const r = determineSplit(10, 'faible', false);
    expect(r.type).toBe('unique');
    expect(r.immediate).toBe(10);
    expect(r.delayed).toBe(0);
  });

  it('returns fractionne 60/40 for moyen fat', () => {
    const r = determineSplit(10, 'moyen', false);
    expect(r.type).toBe('fractionne');
    expect(r.immediate).toBe(6);
    expect(r.delayed).toBe(4);
    expect(r.delayMinutes).toBe(45);
  });

  it('returns fractionne 50/50 for élevé fat with low carbs', () => {
    const r = determineSplit(10, 'élevé', false, 40);
    expect(r.type).toBe('fractionne');
    expect(r.immediate).toBe(5);
    expect(r.delayed).toBe(5);
    expect(r.delayMinutes).toBe(60);
  });

  it('returns fractionne 70/30 for slow digestion + faible fat', () => {
    const r = determineSplit(10, 'faible', true);
    expect(r.type).toBe('fractionne');
    expect(r.immediate).toBe(7);
    expect(r.delayed).toBe(3);
    expect(r.delayMinutes).toBe(60);
  });
});

// ─── determineSplit — extended 3-phase plan ──────────────────────────────────

describe('determineSplit — extended 3-phase', () => {
  it('triggers etendu for élevé fat + carbs > 60g', () => {
    const r = determineSplit(10, 'élevé', false, 80);
    expect(r.type).toBe('etendu');
    expect(r.phases).toHaveLength(3);
  });

  it('splits correctly into 50/30/20 phases', () => {
    const r = determineSplit(10, 'élevé', false, 80);
    expect(r.phases[0].pct).toBe(50);
    expect(r.phases[1].pct).toBe(30);
    expect(r.phases[2].pct).toBe(20);
    expect(r.phases[0].units).toBe(5);
    expect(r.phases[1].units).toBe(3);
    expect(r.phases[2].units).toBe(2);
  });

  it('phase timings are 0, 60, 180 minutes', () => {
    const r = determineSplit(10, 'élevé', false, 100);
    expect(r.phases[0].delayMinutes).toBe(0);
    expect(r.phases[1].delayMinutes).toBe(60);
    expect(r.phases[2].delayMinutes).toBe(180);
  });

  it('phases have correct glycemia checkpoints', () => {
    const r = determineSplit(10, 'élevé', false, 100);
    expect(r.phases[0].checkGlycemia).toBe(false); // immediate, no check needed
    expect(r.phases[1].checkGlycemia).toBe(true);
    expect(r.phases[2].checkGlycemia).toBe(true);
  });

  it('total units across phases equals dose', () => {
    const r = determineSplit(7, 'élevé', false, 80);
    const total = r.phases.reduce((s, p) => s + p.units, 0);
    expect(total).toBe(7);
  });

  it('total units correct for odd dose', () => {
    const r = determineSplit(9.5, 'élevé', false, 75);
    const total = r.phases.reduce((s, p) => s + p.units, 0);
    expect(total).toBe(9.5);
  });

  it('does NOT trigger etendu for carbs <= 60g', () => {
    const r = determineSplit(10, 'élevé', false, 60);
    expect(r.type).toBe('fractionne');
    expect(r.phases).toBeUndefined();
  });

  it('does NOT trigger etendu for moyen fat even with high carbs', () => {
    const r = determineSplit(10, 'moyen', false, 100);
    expect(r.type).toBe('fractionne');
    expect(r.phases).toBeUndefined();
  });

  it('immediate and delayed fields are set for backward compat', () => {
    const r = determineSplit(10, 'élevé', false, 80);
    expect(r.immediate).toBe(5);
    expect(r.delayed).toBe(5); // p2 + p3
    expect(r.delayMinutes).toBe(60);
  });

  it('handles slow digestion + élevé fat + high carbs as etendu', () => {
    const r = determineSplit(10, 'élevé', true, 80);
    expect(r.type).toBe('etendu');
  });
});

// ─── determineSplit — rounding edge cases ────────────────────────────────────

describe('determineSplit — rounding', () => {
  it('rounds each phase to 0.5u precision', () => {
    const r = determineSplit(7, 'élevé', false, 80);
    r.phases.forEach(p => {
      expect(p.units * 2).toBe(Math.round(p.units * 2)); // must be multiple of 0.5
    });
  });

  it('handles very small dose without negative phases', () => {
    const r = determineSplit(1.5, 'élevé', false, 80);
    r.phases.forEach(p => {
      expect(p.units).toBeGreaterThanOrEqual(0);
    });
    expect(r.phases.reduce((s, p) => s + p.units, 0)).toBe(1.5);
  });

  it('handles minimum dose of 0.5u', () => {
    const r = determineSplit(0.5, 'élevé', false, 80);
    expect(r.type).toBe('etendu');
    const total = r.phases.reduce((s, p) => s + p.units, 0);
    expect(total).toBe(0.5);
  });
});

// ─── analyzeAndRecommend — extended plan integration ─────────────────────────

describe('analyzeAndRecommend — extended plan', () => {
  const baseInputs = {
    glycemia: 1.5,
    trend: '→',
    totalCarbs: 80,
    fatLevel: 'élevé',
    activity: 'aucune',
    ratio: 10,
    isf: 0.5,
    targetMin: 0.8,
    targetMax: 1.3,
    iobTotal: 0,
    lastInjectionMinutesAgo: null,
    slowDigestion: false,
    postKeto: false,
    maxDose: 20,
  };

  it('returns etendu split for high-fat high-carb meal', () => {
    const result = analyzeAndRecommend(baseInputs);
    expect(result.recommendation.split.type).toBe('etendu');
    expect(result.recommendation.split.phases).toHaveLength(3);
  });

  it('returns fractionne split for high-fat low-carb meal', () => {
    const result = analyzeAndRecommend({ ...baseInputs, totalCarbs: 40 });
    expect(result.recommendation.split.type).toBe('fractionne');
  });

  it('includes reasoning about fat bonus', () => {
    const result = analyzeAndRecommend(baseInputs);
    const hasFatReasoning = result.recommendation.reasoning.some(r => r.includes('gras'));
    expect(hasFatReasoning).toBe(true);
  });

  it('phase units sum equals adjusted dose', () => {
    const result = analyzeAndRecommend(baseInputs);
    const phases = result.recommendation.split.phases;
    const total = phases.reduce((s, p) => s + p.units, 0);
    expect(total).toBe(result.recommendation.dose);
  });
});
