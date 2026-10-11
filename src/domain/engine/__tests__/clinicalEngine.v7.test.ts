import { describe, it, expect } from 'vitest';
import {
  calculateDose, applySafetyRules, determineSplit, analyzeAndRecommend, evaluatePostPrandial,
  computeFatFactor, FAT_FACTOR, ACTIVITY_REDUCTION, SINGLE_INJECTION_WARNING_THRESHOLD,
} from '../clinicalEngine';
import { calcHypoRisk, classifyHypoRisk } from '../hypoRisk';
import { calcVelocity, classifyVelocity, velocityFromReadings, trendToVelocityClass } from '../velocity';
import { predictGlucose } from '../prediction';

const base = {
  glycemia: 1.10, trend: '→', totalCarbs: 60, fatLevel: 'aucun', activity: 'aucune',
  ratio: 15, isfMgdl: 60, targetMin: 1.00, targetMax: 1.20, iobTotal: 0,
  lastInjectionMinutesAgo: null, slowDigestion: false, postKeto: false, hour: 12,
};

describe('calculateDose (unités explicites)', () => {
  it('60 g / ratio 15 → 4 U', () => {
    expect(calculateDose({ ...base, fatLevel: 'aucun' }).doseSuggeree).toBe(4.0);
  });
  it('correction (2.00 − 1.20) × 100 / 60 = 1.33 → 1.5 U', () => {
    expect(calculateDose({ ...base, glycemia: 2.0, totalCarbs: 0 }).doseSuggeree).toBe(1.5);
  });
  it("l'IOB ne réduit que la correction", () => {
    const r = calculateDose({ ...base, glycemia: 2.0, iobTotal: 1.0 });
    expect(r.correctionNette).toBeCloseTo(0.333, 2);
    expect(r.doseSuggeree).toBe(4.5);
  });
  it('bonus gras et activité', () => {
    expect(calculateDose({ ...base, fatLevel: 'élevé' }).doseSuggeree).toBe(5.0);
    expect(calculateDose({ ...base, activity: 'moderee' }).doseSuggeree).toBe(3.0);
    expect(FAT_FACTOR['élevé']).toBe(0.27);
    expect(ACTIVITY_REDUCTION.intense).toBe(0.7);
  });
  it('facteur gras continu', () => {
    expect(computeFatFactor('faible', 30)).toBeCloseTo(0.27, 2);
    expect(computeFatFactor('faible', 100)).toBe(0.35);
    expect(computeFatFactor('moyen', null)).toBe(0.14);
  });
  it('ratio ou ISF invalides ne produisent pas NaN', () => {
    const r = calculateDose({ ...base, ratio: 0, isfMgdl: 0, glycemia: 2 });
    expect(Number.isFinite(r.doseSuggeree)).toBe(true);
  });
});

describe('applySafetyRules — règles historiques', () => {
  it('bloque sous 0.70', () => {
    const r = applySafetyRules({ glycemia: 0.65, doseSuggeree: 4, correction: 0, iobTotal: 0 });
    expect(r.blocked).toBe(true);
    expect(r.adjustedDose).toBe(0);
    expect(r.risks[0]?.code).toBe('SAFETY_ANTI_HYPO');
    expect(r.risks[0]?.type).toBe('anti-hypo');
  });
  it('divise par deux entre 0.70 et 0.90', () => {
    const r = applySafetyRules({ glycemia: 0.8, doseSuggeree: 4, correction: 0, iobTotal: 0, hour: 12 });
    expect(r.adjustedDose).toBe(2);
    expect(r.risks.map((x) => x.type)).toContain('hypo-proche');
  });
  it('sur-correction : tendance ↘ retire 50 % de la correction nette', () => {
    const r = applySafetyRules({ glycemia: 2.0, doseSuggeree: 5.5, correction: 4.0, correctionNette: 1.5, iobTotal: 2.5, trend: '↘', hour: 12 });
    expect(r.adjustedDose).toBe(4.5);
    expect(r.warnings.map((w) => w.type)).toContain('sur-correction');
  });
  it('anti-stacking et timing', () => {
    const r = applySafetyRules({ glycemia: 1.5, doseSuggeree: 4, correction: 0.5, iobTotal: 2.5, lastInjectionMinutesAgo: 60, hour: 12 });
    const types = r.warnings.map((w) => w.type);
    expect(types).toContain('anti-stacking');
    expect(types).toContain('alerte-timing');
  });
  it('post-cétose et maladie', () => {
    const r = applySafetyRules({ glycemia: 1.2, doseSuggeree: 4, correction: 0, iobTotal: 0, postKeto: true, illness: true, hour: 12 });
    expect(r.warnings.map((w) => w.code)).toContain('SAFETY_POST_KETO');
    expect(r.infos.map((w) => w.code)).toContain('SAFETY_ILLNESS');
  });
});

describe('applySafetyRules — mode nocturne', () => {
  it('bloque la correction la nuit sous le seuil', () => {
    const r = applySafetyRules({ glycemia: 1.6, doseSuggeree: 1.0, correction: 0.67, correctionNette: 0.67, iobTotal: 0, hour: 23 });
    expect(r.nightMode).toBe(true);
    expect(r.correctionBlocked).toBe(true);
    expect(r.adjustedDose).toBe(0.5);
    expect(r.warnings.map((w) => w.code)).toContain('SAFETY_NIGHT_BLOCK');
  });
  it('réduit la correction de moitié la nuit au-dessus du seuil', () => {
    const r = applySafetyRules({ glycemia: 2.4, doseSuggeree: 2.0, correction: 2.0, correctionNette: 2.0, iobTotal: 0, hour: 2 });
    expect(r.adjustedDose).toBe(1.0);
    expect(r.warnings.map((w) => w.code)).toContain('SAFETY_NIGHT_REDUCE');
  });
  it('collation recommandée la nuit sous 1.50', () => {
    const r = applySafetyRules({ glycemia: 1.3, doseSuggeree: 0, correction: 0, iobTotal: 0, hour: 1 });
    expect(r.infos.map((w) => w.code)).toContain('SAFETY_NIGHT_LOW');
  });
  it('désactivable et fenêtre configurable', () => {
    const off = applySafetyRules({ glycemia: 1.6, doseSuggeree: 1.0, correction: 0.67, iobTotal: 0, hour: 23, night: { enabled: false } });
    expect(off.nightMode).toBe(false);
    const custom = applySafetyRules({ glycemia: 1.6, doseSuggeree: 1.0, correction: 0.67, iobTotal: 0, hour: 20, night: { start: 19, end: 5 } });
    expect(custom.nightMode).toBe(true);
  });
});

describe('applySafetyRules — anti-empilement, cumul, plafond', () => {
  it('plafonne la correction à 1 U si injection < 180 min', () => {
    const r = applySafetyRules({ glycemia: 2.6, doseSuggeree: 6.5, correction: 2.5, correctionNette: 2.5, iobTotal: 0, lastInjectionMinutesAgo: 150, hour: 12 });
    expect(r.adjustedCorrection).toBe(1);
    expect(r.adjustedDose).toBe(5);
    expect(r.warnings.map((w) => w.code)).toContain('SAFETY_CORRECTION_CAPPED');
  });
  it('signale un cumul de corrections > 15 % de la TDD', () => {
    const r = applySafetyRules({ glycemia: 1.2, doseSuggeree: 4, correction: 0, iobTotal: 0, cumulCorrections24h: 8, tddEstimate: 40, hour: 12 });
    expect(r.warnings.map((w) => w.code)).toContain('SAFETY_CUMUL_HIGH');
  });
  it('ratio IOB / dose > 50 %', () => {
    const r = applySafetyRules({ glycemia: 1.2, doseSuggeree: 2, correction: 0, iobTotal: 1.5, hour: 12 });
    expect(r.warnings.map((w) => w.code)).toContain('SAFETY_IOB_RATIO');
  });
  it('exige une confirmation au-delà du plafond de dose', () => {
    const r = applySafetyRules({ glycemia: 1.2, doseSuggeree: 14, correction: 0, iobTotal: 0, maxDoseU: 12, hour: 12 });
    expect(r.requiresConfirmation).toBe(true);
    expect(r.adjustedDose).toBe(14);
    expect(r.warnings.map((w) => w.code)).toContain('SAFETY_MAX_DOSE');
  });
});

describe('applySafetyRules — vitesse et score de risque', () => {
  it('chute rapide mesurée → correction supprimée', () => {
    const r = applySafetyRules({ glycemia: 2.2, doseSuggeree: 5.5, correction: 1.5, correctionNette: 1.5, iobTotal: 0, velocity: -0.6, hour: 12 });
    expect(r.adjustedCorrection).toBe(0);
    expect(r.adjustedDose).toBe(4);
    expect(r.warnings.map((w) => w.code)).toContain('SAFETY_VELOCITY_FALLING_FAST');
  });
  it('montée rapide mesurée → correction × 1.2', () => {
    const r = applySafetyRules({ glycemia: 2.2, doseSuggeree: 6, correction: 2, correctionNette: 2, iobTotal: 0, velocity: 0.6, hour: 12 });
    expect(r.adjustedCorrection).toBe(2.5);
    expect(r.adjustedDose).toBe(6.5);
  });
  it('tendance manuelle ↓ reste traitée comme sur-correction (50 %)', () => {
    const r = applySafetyRules({ glycemia: 2.2, doseSuggeree: 6, correction: 2, correctionNette: 2, iobTotal: 0, trend: '↓', hour: 12 });
    expect(r.adjustedCorrection).toBe(1);
    expect(r.warnings.map((w) => w.code)).toContain('SAFETY_SUR_CORRECTION');
  });
  it('score critique bloque la correction, score élevé divise la dose', () => {
    const critical = applySafetyRules({ glycemia: 0.95, doseSuggeree: 4, correction: 0, iobTotal: 3.5, velocity: -0.5, hypoIn24h: true, activity: 'intense', hour: 23 });
    expect(critical.hypoRisk.level).toBe('critical');
    expect(critical.risks.map((r) => r.code)).toContain('SAFETY_HYPO_RISK_CRITICAL');
    const high = applySafetyRules({ glycemia: 1.1, doseSuggeree: 4, correction: 0, iobTotal: 2.5, trend: '↘', hour: 12 });
    expect(high.hypoRisk.level).toBe('high');
    expect(high.adjustedDose).toBe(2);
  });
});

describe('jeûne (Ramadan)', () => {
  it('réduit le bolus du suhoor', () => {
    const r = applySafetyRules({ glycemia: 1.2, doseSuggeree: 8, correction: 0, iobTotal: 0, hour: 4, fasting: { enabled: true, mealSlot: 'suhoor' }, night: { enabled: false } });
    expect(r.adjustedDose).toBe(6);
    expect(r.warnings.map((w) => w.code)).toContain('SAFETY_FASTING_SUHOOR_REDUCE');
  });
  it('rompre le jeûne au-dessus de 3.00', () => {
    const r = applySafetyRules({ glycemia: 3.2, doseSuggeree: 3, correction: 3, correctionNette: 3, iobTotal: 0, hour: 14, fasting: { enabled: true, mealSlot: 'other' } });
    expect(r.risks.map((x) => x.code)).toContain('SAFETY_FASTING_BREAK');
    expect(r.adjustedCorrection).toBe(1.5);
  });
});

describe('determineSplit', () => {
  it('schémas', () => {
    expect(determineSplit(6, 'aucun', false).type).toBe('unique');
    expect(determineSplit(6, 'moyen', false)).toMatchObject({ type: 'fractionne', immediate: 3.5, delayed: 2.5, delayMinutes: 45 });
    expect(determineSplit(6, 'élevé', false)).toMatchObject({ type: 'fractionne', immediate: 3, delayed: 3, delayMinutes: 60 });
    expect(determineSplit(6, 'faible', true)).toMatchObject({ type: 'fractionne', immediate: 4, delayed: 2 });
    const ext = determineSplit(10, 'élevé', false, 80);
    expect(ext.type).toBe('etendu');
    expect(ext.phases?.map((p) => p.units)).toEqual([5, 3, 2]);
    expect(ext.phases?.[1]?.label).toBe('PHASE_FAT');
    expect(determineSplit(0, 'élevé', true).type).toBe('unique');
  });
});

describe('analyzeAndRecommend', () => {
  it('cas standard', () => {
    const r = analyzeAndRecommend(base);
    expect(r.recommendation.dose).toBe(4);
    expect(r.recommendation.timing).toBe('TIMING_BEFORE_10_15');
    expect(r.nextStep).toEqual({ checkTime: 120, instruction: 'NEXT_CHECK_IN' });
    expect(r.analysis.glycemiaStatus).toBe('cible');
    expect(r.prediction?.at2h.zone).toBeDefined();
  });
  it('hypo : bloqué, resucrage', () => {
    const r = analyzeAndRecommend({ ...base, glycemia: 0.6 });
    expect(r.recommendation.blocked).toBe(true);
    expect(r.recommendation.timing).toBe('TIMING_NONE');
    expect(r.nextStep.instruction).toBe('NEXT_RESUGAR_15');
    expect(r.prediction).toBeNull();
  });
  it('dose élevée sans fractionnement', () => {
    const r = analyzeAndRecommend({ ...base, totalCarbs: 400 });
    expect(r.recommendation.dose).toBeGreaterThan(SINGLE_INJECTION_WARNING_THRESHOLD);
    expect(r.vigilance.warnings.map((w) => w.type)).toContain('dose-elevee');
  });
  it('glycémie élevée → injecter 20-30 min avant', () => {
    expect(analyzeAndRecommend({ ...base, glycemia: 2.0 }).recommendation.timing).toBe('TIMING_BEFORE_20_30');
  });
  it('la vitesse mesurée remplace la tendance manuelle', () => {
    const r = analyzeAndRecommend({ ...base, glycemia: 2.0, trend: '?', velocity: 0.5 });
    expect(r.analysis.trend).toBe('↑');
    expect(r.recommendation.timing).toBe('TIMING_BEFORE_30');
  });
});

describe('evaluatePostPrandial', () => {
  it('verdicts', () => {
    expect(evaluatePostPrandial(1.2, 1.5, 1.0, 1.8)?.verdict).toBe('good');
    expect(evaluatePostPrandial(1.2, 2.3, 1.0, 1.8)?.verdict).toBe('under');
    expect(evaluatePostPrandial(1.2, 0.8, 1.0, 1.8)?.verdict).toBe('over');
    expect(evaluatePostPrandial(1.2, null, 1.0, 1.8)).toBeNull();
  });
});

describe('hypoRisk', () => {
  it('score et niveaux', () => {
    expect(classifyHypoRisk(0)).toBe('low');
    expect(classifyHypoRisk(4)).toBe('moderate');
    expect(classifyHypoRisk(7)).toBe('high');
    expect(classifyHypoRisk(9)).toBe('critical');
    const r = calcHypoRisk({ glycemia: 0.95, iobTotal: 3.5, velocityClass: 'falling_fast', hypoIn24h: true, activity: 'intense', hour: 23 });
    expect(r.score).toBe(14);
    expect(r.factors).toHaveLength(6);
  });
});

describe('velocity', () => {
  it('calcul et classification', () => {
    expect(calcVelocity(1.0, 1.4, 60)).toBe(-0.4);
    expect(classifyVelocity(-0.5)).toBe('falling_fast');
    expect(classifyVelocity(0.1)).toBe('stable');
    expect(calcVelocity(1.0, 1.4, 3)).toBeNull();
    expect(calcVelocity(1.0, 1.4, 400)).toBeNull();
    expect(trendToVelocityClass('↗')).toBe('rising');
  });
  it('depuis les lectures', () => {
    const now = new Date(2026, 9, 11, 12, 0);
    const readings = [
      { value: 1.8, at: new Date(2026, 9, 11, 10, 0), kind: 'spot' as const, entryId: 1 },
      { value: 1.5, at: new Date(2026, 9, 11, 11, 0), kind: 'spot' as const, entryId: 2 },
    ];
    const v = velocityFromReadings(readings, { value: 1.2, at: now });
    expect(v.velocity).toBe(-0.3);
    expect(v.cls).toBe('falling');
    expect(v.intervalMinutes).toBe(60);
    expect(velocityFromReadings([], { value: 1.2, at: now }).cls).toBe('unknown');
  });
});

describe('prediction', () => {
  it('dose adaptée → zone cible ; pas de dose → montée', () => {
    const ok = predictGlucose({ glycemia: 1.1, velocity: 0, totalCarbs: 60, dose: 4, ratio: 15, isfMgdl: 60, iobTotal: 0 });
    expect(ok.at2h.zone).toBe('cible');
    expect(ok.at2h.low).toBeLessThan(ok.at2h.value);
    const none = predictGlucose({ glycemia: 1.1, velocity: 0, totalCarbs: 60, dose: 0, ratio: 15, isfMgdl: 60, iobTotal: 0 });
    expect(none.at2h.value).toBeGreaterThan(ok.at2h.value);
  });
  it('alerte hypo à 1 h avec forte IOB et chute', () => {
    const p = predictGlucose({ glycemia: 0.95, velocity: -0.5, totalCarbs: 0, dose: 0, ratio: 15, isfMgdl: 60, iobTotal: 3, fatLevel: 'aucun' });
    expect(p.alerts).toContain('PREDICT_HYPO_1H');
  });
});
