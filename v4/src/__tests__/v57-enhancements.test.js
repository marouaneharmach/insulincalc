/**
 * v57-enhancements.test.js — Comprehensive tests for v5.7 enhancements
 *
 * Covers:
 *  - Phase A: AI edit modal (deriveFatLevel, custom food creation)
 *  - Phase B: Improved matching (badges, keyword mapping)
 *  - Phase C: Photo traceability (thumbnail, journal persistence)
 *  - Phase D: Continuous fat calculation (computeFatFactor, totalFatGrams)
 *  - Phase E: i18n completeness
 *  - Phase F: Post-meal prediction, daily summary
 */

import { describe, it, expect } from 'vitest';
import {
  computeFatFactor,
  calculateDose,
  determineSplit,
  analyzeAndRecommend,
  predictPostMealGlycemia,
  computeDailySummary,
  evaluatePostPrandial,
  round05,
  FAT_FACTOR,
} from '../utils/clinicalEngine';
import { deriveFatLevel, mapToLocalFoods } from '../utils/foodRecognition';
import fr from '../i18n/fr';
import ar from '../i18n/ar';

// ─── Phase A: deriveFatLevel — AI estimate to qualitative ───────────────────

describe('Phase A — deriveFatLevel', () => {
  it('null → faible', () => expect(deriveFatLevel(null)).toBe('faible'));
  it('0g → faible', () => expect(deriveFatLevel(0)).toBe('faible'));
  it('5g → faible', () => expect(deriveFatLevel(5)).toBe('faible'));
  it('6g → moyen', () => expect(deriveFatLevel(6)).toBe('moyen'));
  it('15g → moyen', () => expect(deriveFatLevel(15)).toBe('moyen'));
  it('16g → élevé', () => expect(deriveFatLevel(16)).toBe('élevé'));
  it('50g → élevé', () => expect(deriveFatLevel(50)).toBe('élevé'));
});

// ─── Phase A: AI food with estimated carbs/fat/weight ───────────────────────

describe('Phase A — AI food estimation parsing', () => {
  it('unmapped food preserves estimatedCarbs and estimatedFat', () => {
    const results = [{ name: 'unknown_dish', nameFr: 'Plat inconnu', confidence: 80, estimatedCarbs: 45, estimatedFat: 12, estimatedWeight: 250, estimatedGI: 'moyen' }];
    const allFoods = { f1: { id: 'f1', name: 'Pizza' } };
    const mapped = mapToLocalFoods(results, allFoods);
    expect(mapped[0].mapped).toBe(false);
    expect(mapped[0].estimatedCarbs).toBe(45);
    expect(mapped[0].estimatedFat).toBe(12);
    expect(mapped[0].estimatedWeight).toBe(250);
  });

  it('zero carbs are preserved (not null)', () => {
    const results = [{ name: 'black_coffee', nameFr: 'Café noir', confidence: 90, estimatedCarbs: 0, estimatedFat: 0, estimatedWeight: 200, estimatedGI: 'faible' }];
    const mapped = mapToLocalFoods(results, {});
    expect(mapped[0].estimatedCarbs).toBe(0);
    expect(mapped[0].estimatedFat).toBe(0);
  });

  it('estimatedGI is preserved', () => {
    const results = [{ name: 'fries', nameFr: 'Frites', confidence: 85, estimatedCarbs: 40, estimatedFat: 15, estimatedWeight: 200, estimatedGI: 'élevé' }];
    const allFoods = { f1: { id: 'f1', name: 'Frites' } };
    const mapped = mapToLocalFoods(results, allFoods);
    expect(mapped[0].estimatedGI).toBe('élevé');
  });
});

// ─── Phase B: Keyword matching ──────────────────────────────────────────────

describe('Phase B — keyword mapping', () => {
  const db = {
    f1: { id: 'f1', name: 'Big Mac (burger)' },
    f2: { id: 'f2', name: 'Frites moyennes' },
    f3: { id: 'f3', name: 'Pizza Margherita' },
    f4: { id: 'f4', name: 'Couscous royal' },
  };

  it('maps cheeseburger to burger DB entry via keyword alias', () => {
    const results = [{ name: 'cheeseburger', nameFr: 'Cheeseburger', confidence: 90, estimatedCarbs: 35 }];
    const mapped = mapToLocalFoods(results, db);
    expect(mapped[0].mapped).toBe(true);
    expect(mapped[0].localFood.id).toBe('f1');
  });

  it('maps pizza to Pizza Margherita', () => {
    const results = [{ name: 'pizza', nameFr: 'Pizza', confidence: 85, estimatedCarbs: 50 }];
    const mapped = mapToLocalFoods(results, db);
    expect(mapped[0].mapped).toBe(true);
    expect(mapped[0].localFood.id).toBe('f3');
  });

  it('maps couscous to Couscous royal', () => {
    const results = [{ name: 'couscous', nameFr: 'Couscous', confidence: 80, estimatedCarbs: 60 }];
    const mapped = mapToLocalFoods(results, db);
    expect(mapped[0].mapped).toBe(true);
    expect(mapped[0].localFood.id).toBe('f4');
  });

  it('unmapped item has mapped=false with AI estimates', () => {
    const results = [{ name: 'exotic_dish', nameFr: 'Plat exotique', confidence: 70, estimatedCarbs: 30, estimatedFat: 8 }];
    const mapped = mapToLocalFoods(results, db);
    expect(mapped[0].mapped).toBe(false);
    expect(mapped[0].localFood).toBeNull();
  });
});

// ─── Phase D: computeFatFactor ──────────────────────────────────────────────

describe('Phase D — computeFatFactor', () => {
  it('uses qualitative FAT_FACTOR when totalFatGrams is null', () => {
    expect(computeFatFactor('aucun', null)).toBe(0);
    expect(computeFatFactor('faible', null)).toBe(0.04);
    expect(computeFatFactor('moyen', null)).toBe(0.14);
    expect(computeFatFactor('élevé', null)).toBe(0.27);
  });

  it('uses continuous curve when totalFatGrams > 0', () => {
    expect(computeFatFactor('aucun', 5)).toBeCloseTo(0.045, 2);
    expect(computeFatFactor('moyen', 15)).toBeCloseTo(0.135, 2);
    expect(computeFatFactor('élevé', 30)).toBeCloseTo(0.27, 2);
  });

  it('caps at 0.35 for very high fat', () => {
    expect(computeFatFactor('élevé', 50)).toBe(0.35);
    expect(computeFatFactor('élevé', 100)).toBe(0.35);
  });

  it('returns 0 for totalFatGrams = 0', () => {
    expect(computeFatFactor('aucun', 0)).toBe(0);
  });

  it('falls back gracefully for unknown fatLevel', () => {
    expect(computeFatFactor('unknown', null)).toBe(0);
  });
});

// ─── Phase D: calculateDose with totalFatGrams ─────────────────────────────

describe('Phase D — calculateDose with totalFatGrams', () => {
  const base = {
    totalCarbs: 60, glycemia: 1.2, ratio: 10, isf: 0.5,
    targetMax: 1.3, iobTotal: 0, fatLevel: 'aucun', activity: 'aucune',
  };

  it('dose without fat has zero bonusGras', () => {
    const r = calculateDose(base);
    expect(r.bonusGras).toBe(0);
    expect(r.doseSuggeree).toBe(6);
  });

  it('dose with totalFatGrams uses continuous factor', () => {
    const r = calculateDose({ ...base, totalFatGrams: 20 });
    // factor = 20 * 0.009 = 0.18, bonus = 6 * 0.18 = 1.08
    expect(r.bonusGras).toBeCloseTo(1.08, 1);
    expect(r.doseSuggeree).toBe(round05(6 + 1.08));
  });

  it('totalFatGrams overrides qualitative fatLevel', () => {
    const r1 = calculateDose({ ...base, fatLevel: 'élevé', totalFatGrams: 5 });
    const r2 = calculateDose({ ...base, fatLevel: 'aucun', totalFatGrams: 5 });
    // Both should use continuous: 5 * 0.009 = 0.045
    expect(r1.bonusGras).toBeCloseTo(r2.bonusGras, 3);
  });
});

// ─── Phase D: analyzeAndRecommend passes totalFatGrams ──────────────────────

describe('Phase D — analyzeAndRecommend with totalFatGrams', () => {
  const base = {
    glycemia: 1.5, trend: '→', totalCarbs: 80,
    fatLevel: 'élevé', activity: 'aucune',
    ratio: 10, isf: 0.5,
    targetMin: 0.8, targetMax: 1.3,
    iobTotal: 0, lastInjectionMinutesAgo: null,
    slowDigestion: false, postKeto: false, maxDose: 30,
  };

  it('returns prediction object', () => {
    const r = analyzeAndRecommend(base);
    expect(r.prediction).toBeDefined();
    expect(r.prediction.predicted).toBeGreaterThan(0);
    expect(r.prediction.zone).toBeDefined();
  });

  it('uses totalFatGrams for continuous fat calculation', () => {
    const r1 = analyzeAndRecommend({ ...base, totalFatGrams: 25 });
    const r2 = analyzeAndRecommend({ ...base, totalFatGrams: null });
    // r1 uses continuous (25*0.009=0.225), r2 uses qualitative élevé (0.27)
    // Different bonus → different dose
    expect(r1.recommendation.dose).not.toBe(r2.recommendation.dose);
  });
});

// ─── Phase E: i18n completeness ─────────────────────────────────────────────

describe('Phase E — i18n v5.7 keys', () => {
  const newKeys = [
    'tapPourAjouter', 'analyseEnCours', 'estimationIA',
    'valeurImplausible', 'ajouterAuRepas', 'sauvegarderAlimentPerso',
    'poidsEstime', 'annuler', 'planInjection', 'nouvelleConsultation',
    'phaseTerminee', 'marquerFait', 'phasesCompletees', 'doseTotal',
    'dansXmin', 'controleGlycemie', 'bonusGrasContinu', 'fatGramsLabel',
    'estimationIAMarker', 'photoRepas', 'etendu3Phases',
    'doseReelle', 'confirmerEnregistrer',
    'predictionPostRepas', 'glycemiePrevue', 'bilanJournalier',
    'tempsEnCible', 'moyenneGlycemie', 'nbInjections', 'totalGlucidesJour',
  ];

  newKeys.forEach(key => {
    it(`FR has key "${key}"`, () => {
      expect(fr[key]).toBeDefined();
      expect(fr[key].length).toBeGreaterThan(0);
    });

    it(`AR has key "${key}"`, () => {
      expect(ar[key]).toBeDefined();
      expect(ar[key].length).toBeGreaterThan(0);
    });
  });

  it('FR and AR have same number of keys', () => {
    expect(Object.keys(fr).length).toBe(Object.keys(ar).length);
  });
});

// ─── Phase F: predictPostMealGlycemia ───────────────────────────────────────

describe('Phase F — predictPostMealGlycemia', () => {
  it('predicts target when dose matches carb bolus perfectly', () => {
    // 60g carbs / ratio 10 = 6U needed, glycemia at target
    const r = predictPostMealGlycemia({ glycemia: 1.2, totalCarbs: 60, dose: 6, isf: 0.5, ratio: 10 });
    expect(r.predicted).toBeCloseTo(1.2, 1);
    expect(r.zone).toBe('cible');
  });

  it('predicts rise when no insulin given', () => {
    const r = predictPostMealGlycemia({ glycemia: 1.0, totalCarbs: 60, dose: 0, isf: 0.5, ratio: 10 });
    expect(r.predicted).toBeGreaterThan(1.0);
    expect(r.delta).toBeGreaterThan(0);
  });

  it('predicts hypo when too much insulin', () => {
    const r = predictPostMealGlycemia({ glycemia: 1.0, totalCarbs: 30, dose: 10, isf: 0.5, ratio: 10 });
    // carbBolus = 3U, dose = 10U, netEffect = 7 * 0.5 = 3.5, predicted = 1.0 - 3.5 = -2.5
    expect(r.predicted).toBeLessThan(0.7);
    expect(r.zone).toBe('hypo');
  });

  it('classifies zones correctly', () => {
    const hypo = predictPostMealGlycemia({ glycemia: 0.6, totalCarbs: 0, dose: 1, isf: 0.5, ratio: 10 });
    expect(hypo.zone).toBe('hypo');

    const cible = predictPostMealGlycemia({ glycemia: 1.2, totalCarbs: 50, dose: 5, isf: 0.5, ratio: 10 });
    expect(cible.zone).toBe('cible');
  });

  it('returns delta showing direction of change', () => {
    const r = predictPostMealGlycemia({ glycemia: 1.5, totalCarbs: 80, dose: 8, isf: 0.5, ratio: 10 });
    expect(typeof r.delta).toBe('number');
  });
});

// ─── Phase F: computeDailySummary ───────────────────────────────────────────

describe('Phase F — computeDailySummary', () => {
  const today = new Date().toISOString().slice(0, 10);

  it('returns zeros for empty journal', () => {
    const s = computeDailySummary([], today, 0.8, 1.3);
    expect(s.totalDose).toBe(0);
    expect(s.totalCarbs).toBe(0);
    expect(s.injections).toBe(0);
    expect(s.glycReadings).toBe(0);
    expect(s.avgGlycemia).toBeNull();
    expect(s.timeInRange).toBeNull();
  });

  it('computes correct stats for multiple entries', () => {
    const journal = [
      { date: `${today}T08:00:00Z`, glycPre: 1.1, glycPost: 1.4, doseReelle: 5, totalGlucides: 60 },
      { date: `${today}T12:00:00Z`, glycPre: 1.3, glycPost: 1.8, doseReelle: 7, totalGlucides: 80 },
      { date: `${today}T19:00:00Z`, glycPre: 0.9, glycPost: 1.2, doseReelle: 4, totalGlucides: 50 },
    ];
    const s = computeDailySummary(journal, today, 0.8, 1.3);
    expect(s.totalDose).toBe(16);
    expect(s.totalCarbs).toBe(190);
    expect(s.injections).toBe(3);
    expect(s.glycReadings).toBe(6); // 3 pre + 3 post
    expect(s.avgGlycemia).toBeGreaterThan(0);
    expect(s.timeInRange).toBeGreaterThan(0);
    expect(s.timeInRange).toBeLessThanOrEqual(100);
    expect(s.minGlyc).toBe(0.9);
    expect(s.maxGlyc).toBe(1.8);
  });

  it('filters entries by date', () => {
    const journal = [
      { date: `${today}T08:00:00Z`, glycPre: 1.1, doseReelle: 5, totalGlucides: 60 },
      { date: '2025-01-01T08:00:00Z', glycPre: 1.5, doseReelle: 8, totalGlucides: 100 },
    ];
    const s = computeDailySummary(journal, today, 0.8, 1.3);
    expect(s.injections).toBe(1);
    expect(s.totalCarbs).toBe(60);
  });

  it('timeInRange is 100% when all readings in target', () => {
    const journal = [
      { date: `${today}T08:00:00Z`, glycPre: 1.0, glycPost: 1.2, doseReelle: 5, totalGlucides: 60 },
    ];
    const s = computeDailySummary(journal, today, 0.8, 1.3);
    expect(s.timeInRange).toBe(100);
  });

  it('timeInRange is 0% when all readings out of target', () => {
    const journal = [
      { date: `${today}T08:00:00Z`, glycPre: 2.0, glycPost: 2.5, doseReelle: 5, totalGlucides: 60 },
    ];
    const s = computeDailySummary(journal, today, 0.8, 1.3);
    expect(s.timeInRange).toBe(0);
  });
});

// ─── Integration: Full flow from AI → dose → prediction ────────────────────

describe('Integration — AI food to dose with prediction', () => {
  it('AI-estimated meal produces valid dose and prediction', () => {
    const result = analyzeAndRecommend({
      glycemia: 1.4,
      trend: '→',
      totalCarbs: 70, // AI-estimated carbs
      fatLevel: 'moyen',
      totalFatGrams: 18, // AI-estimated fat
      activity: 'aucune',
      ratio: 10,
      isf: 0.5,
      targetMin: 0.8,
      targetMax: 1.3,
      iobTotal: 0,
      lastInjectionMinutesAgo: null,
      slowDigestion: false,
      postKeto: false,
      maxDose: 25,
    });

    expect(result.recommendation.dose).toBeGreaterThan(0);
    expect(result.recommendation.blocked).toBe(false);
    expect(result.prediction).toBeDefined();
    expect(result.prediction.predicted).toBeGreaterThan(0);

    // Fat bonus should exist (18g * 0.009 = 0.162, bonus = 7 * 0.162 ≈ 1.13)
    const hasFatReasoning = result.recommendation.reasoning.some(r => r.includes('gras'));
    expect(hasFatReasoning).toBe(true);
  });

  it('high-fat high-carb AI meal triggers extended plan', () => {
    const result = analyzeAndRecommend({
      glycemia: 1.2,
      trend: '→',
      totalCarbs: 90,
      fatLevel: 'élevé',
      totalFatGrams: 35,
      activity: 'aucune',
      ratio: 10,
      isf: 0.5,
      targetMin: 0.8,
      targetMax: 1.3,
      iobTotal: 0,
      lastInjectionMinutesAgo: null,
      slowDigestion: false,
      postKeto: false,
      maxDose: 25,
    });

    expect(result.recommendation.split.type).toBe('etendu');
    expect(result.recommendation.split.phases).toHaveLength(3);
    expect(result.prediction.zone).toBeDefined();
  });
});
