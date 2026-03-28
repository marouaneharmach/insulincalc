import { describe, it, expect } from 'vitest';
import {
  calculateDose,
  applySafetyRules,
  determineSplit,
  analyzeAndRecommend,
  evaluatePostPrandial,
  FAT_FACTOR,
  ACTIVITY_REDUCTION,
} from '../clinicalEngine.js';

// ─── Task 18: evaluatePostPrandial ──────────────────────────────────────────

describe('evaluatePostPrandial', () => {
  it('returns "good" when glycPost is within target', () => {
    const result = evaluatePostPrandial(1.10, 1.15, 1.00, 1.80);
    expect(result.verdict).toBe('good');
  });

  it('returns "under" when glycPost is too high (under-corrected)', () => {
    const result = evaluatePostPrandial(1.10, 2.20, 1.00, 1.80);
    expect(result.verdict).toBe('under');
  });

  it('returns "over" when glycPost is too low (over-corrected)', () => {
    const result = evaluatePostPrandial(1.10, 0.75, 1.00, 1.80);
    expect(result.verdict).toBe('over');
  });

  it('returns null if glycPost is missing', () => {
    expect(evaluatePostPrandial(1.10, null, 1.00, 1.80)).toBeNull();
  });
});

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

// ─── Task 4: determineSplit ───────────────────────────────────────────────────

describe('determineSplit', () => {
  it('returns unique for low fat without slow digestion', () => {
    const r = determineSplit(4.0, 'faible', false);
    expect(r.type).toBe('unique');
    expect(r.immediate).toBe(4.0);
  });

  it('splits 60/40 for medium fat', () => {
    const r = determineSplit(4.0, 'moyen', false);
    expect(r.type).toBe('fractionne');
    expect(r.immediate).toBe(2.5);
    expect(r.delayed).toBe(1.5);
    expect(r.delayMinutes).toBe(45);
  });

  it('splits 50/50 for high fat', () => {
    const r = determineSplit(4.0, 'élevé', false);
    expect(r.type).toBe('fractionne');
    expect(r.immediate).toBe(2.0);
    expect(r.delayed).toBe(2.0);
    expect(r.delayMinutes).toBe(60);
  });

  it('splits 70/30 for slow digestion alone', () => {
    const r = determineSplit(4.0, 'faible', true);
    expect(r.type).toBe('fractionne');
    expect(r.immediate).toBe(3.0);
    expect(r.delayed).toBe(1.0);
    expect(r.delayMinutes).toBe(60);
  });

  it('uses fat scheme when both slow digestion and high fat', () => {
    const r = determineSplit(4.0, 'élevé', true);
    expect(r.immediate).toBe(2.0);
    expect(r.delayed).toBe(2.0);
  });

  it('returns unique for zero dose', () => {
    const r = determineSplit(0, 'élevé', true);
    expect(r.type).toBe('unique');
    expect(r.immediate).toBe(0);
  });
});

// ─── Task 4: analyzeAndRecommend ─────────────────────────────────────────────

describe('analyzeAndRecommend', () => {
  it('returns all 4 sections', () => {
    const r = analyzeAndRecommend({
      glycemia: 1.40, trend: '→', totalCarbs: 60, fatLevel: 'faible',
      activity: 'aucune', ratio: 15, isf: 0.60, targetMin: 1.00, targetMax: 1.20,
      iobTotal: 0, lastInjectionMinutesAgo: null, slowDigestion: false,
      postKeto: false, maxDose: 10,
    });
    expect(r).toHaveProperty('analysis');
    expect(r).toHaveProperty('recommendation');
    expect(r).toHaveProperty('vigilance');
    expect(r).toHaveProperty('nextStep');
    expect(r.recommendation.dose).toBeGreaterThan(0);
  });

  it('blocks for hypo', () => {
    const r = analyzeAndRecommend({
      glycemia: 0.55, trend: '↓', totalCarbs: 0, fatLevel: 'aucun',
      activity: 'aucune', ratio: 15, isf: 0.60, targetMin: 1.00, targetMax: 1.20,
      iobTotal: 0, lastInjectionMinutesAgo: null, slowDigestion: false,
      postKeto: false, maxDose: 10,
    });
    expect(r.recommendation.dose).toBe(0);
    expect(r.vigilance.risks.length).toBeGreaterThan(0);
  });

  it('analysis section contains expected fields', () => {
    const r = analyzeAndRecommend({
      glycemia: 1.10, trend: '→', totalCarbs: 45, fatLevel: 'moyen',
      activity: 'aucune', ratio: 15, isf: 0.60, targetMin: 1.00, targetMax: 1.20,
      iobTotal: 0, lastInjectionMinutesAgo: null, slowDigestion: false,
      postKeto: false, maxDose: 10,
    });
    expect(r.analysis.glycemiaStatus).toBe('cible');
    expect(r.analysis.iob).toBe(0);
    expect(r.analysis.trend).toBe('→');
    expect(r.analysis.totalCarbs).toBe(45);
    expect(r.analysis.fatLevel).toBe('moyen');
  });

  it('classifies hypo-severe correctly', () => {
    const r = analyzeAndRecommend({
      glycemia: 0.50, trend: '↓', totalCarbs: 0, fatLevel: 'aucun',
      activity: 'aucune', ratio: 15, isf: 0.60, targetMin: 1.00, targetMax: 1.20,
      iobTotal: 0, lastInjectionMinutesAgo: null, slowDigestion: false,
      postKeto: false, maxDose: 10,
    });
    expect(r.analysis.glycemiaStatus).toBe('hypo-severe');
    expect(r.recommendation.blocked).toBe(true);
    expect(r.nextStep.checkTime).toBe(15);
  });

  it('applies split for high-fat meal', () => {
    const r = analyzeAndRecommend({
      glycemia: 1.10, trend: '→', totalCarbs: 60, fatLevel: 'élevé',
      activity: 'aucune', ratio: 15, isf: 0.60, targetMin: 1.00, targetMax: 1.20,
      iobTotal: 0, lastInjectionMinutesAgo: null, slowDigestion: false,
      postKeto: false, maxDose: 10,
    });
    expect(r.recommendation.split.type).toBe('fractionne');
    expect(r.recommendation.split.delayMinutes).toBe(60);
  });

  it('sets checkTime to 30 for hypo-proche', () => {
    const r = analyzeAndRecommend({
      glycemia: 0.82, trend: '→', totalCarbs: 30, fatLevel: 'aucun',
      activity: 'aucune', ratio: 15, isf: 0.60, targetMin: 1.00, targetMax: 1.20,
      iobTotal: 0, lastInjectionMinutesAgo: null, slowDigestion: false,
      postKeto: false, maxDose: 10,
    });
    expect(r.analysis.glycemiaStatus).toBe('hypo-proche');
    expect(r.nextStep.checkTime).toBe(30);
  });

  it('sets checkTime to 60 when timing warning present', () => {
    const r = analyzeAndRecommend({
      glycemia: 1.10, trend: '→', totalCarbs: 60, fatLevel: 'aucun',
      activity: 'aucune', ratio: 15, isf: 0.60, targetMin: 1.00, targetMax: 1.20,
      iobTotal: 0, lastInjectionMinutesAgo: 90, slowDigestion: false,
      postKeto: false, maxDose: 10,
    });
    expect(r.nextStep.checkTime).toBe(60);
  });
});
