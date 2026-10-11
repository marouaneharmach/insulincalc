import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '../../types';
import { toLocalISO } from '../../time';
import { analyzeTreatment, dailyTotals } from '../treatmentAnalyzer';
import type { TreatmentInputs } from '../treatmentAnalyzer';

// ─── Fixtures ───────────────────────────────────────────────────────────────
// `now` = 11 oct. 2026 23:00 local ; fenêtre de 14 jours → 28 sept. … 11 oct.
// `dayAgo(i)` = i jours avant le 11 oct. (0 = 11 oct., 13 = 28 sept.).

const NOW = new Date(2026, 9, 11, 23, 0);
const dayAgo = (i: number, hour: number, minute = 0): Date => new Date(2026, 9, 11 - i, hour, minute);

const INPUTS: TreatmentInputs = { ratio: 10, isfMgdl: 100, targetMin: 1.0, targetMax: 1.8, now: NOW };

let seq = 0;
function entry(date: Date, overrides: Partial<JournalEntry> = {}): JournalEntry {
  seq += 1;
  return { id: `t${seq}`, date: toLocalISO(date), ...overrides };
}

interface DayOptions {
  breakfastPre?: number;
  breakfastPost?: number;
  lunchPost?: number;
  dinnerPost?: number;
  basal?: number;
}

/** Journée standard : 3 repas (4 U + 6 U + 5 U) et une basale de 20 U → TDD 35 U. */
function standardDay(i: number, o: DayOptions = {}): JournalEntry[] {
  return [
    entry(dayAgo(i, 7, 30), { mealType: 'petit-déjeuner', glycPre: o.breakfastPre ?? 1.2, glycPost: o.breakfastPost ?? 1.5, totalGlucides: 40, doseSuggeree: 4, doseReelle: 4 }),
    entry(dayAgo(i, 12, 30), { mealType: 'déjeuner', glycPre: 1.3, glycPost: o.lunchPost ?? 1.6, totalGlucides: 60, doseSuggeree: 6, doseReelle: 6 }),
    entry(dayAgo(i, 19, 30), { mealType: 'dîner', glycPre: 1.2, glycPost: o.dinnerPost ?? 1.5, totalGlucides: 50, doseSuggeree: 5, doseReelle: 5 }),
    entry(dayAgo(i, 22), { mealType: 'basal', injectionType: 'basal', doseReelle: o.basal ?? 20 }),
  ];
}

const standardJournal = (days = 14, perDay: (i: number) => DayOptions = () => ({})): JournalEntry[] =>
  Array.from({ length: days }, (_, i) => standardDay(i, perDay(i))).flat();

const correction = (date: Date, pre: number, post: number, dose: number): JournalEntry =>
  entry(date, { mealType: 'injection', injectionType: 'correction', glycPre: pre, glycPost: post, doseReelle: dose });

const period = (analysis: ReturnType<typeof analyzeTreatment>, p: 'matin' | 'midi' | 'soir' | 'nuit') => {
  const found = analysis.ratioByPeriod.find((r) => r.period === p);
  if (!found) throw new Error(`période ${p} absente`);
  return found;
};

// ─── Données insuffisantes ──────────────────────────────────────────────────

describe('analyzeTreatment — données insuffisantes', () => {
  it('renvoie une structure vide (nulls, suggestions []) sous minDays jours de bolus', () => {
    const result = analyzeTreatment(standardJournal(5), INPUTS);
    expect(result.enoughData).toBe(false);
    expect(result.daysOfData).toBe(5);
    expect(result.entriesAnalyzed).toBe(20);
    expect(result.tdd).toEqual({ meanU: null, sdU: null, cvPct: null, variabilityHigh: false, basalEstimateU: null });
    expect(result.ratioByPeriod).toEqual([]);
    expect(result.isf).toEqual({ n: 0, effectiveMgdl: null, suggestion: null });
    expect(result.suggestions).toEqual([]);
  });

  it('gère un journal vide', () => {
    const result = analyzeTreatment([], INPUTS);
    expect(result.enoughData).toBe(false);
    expect(result.daysOfData).toBe(0);
    expect(result.entriesAnalyzed).toBe(0);
  });

  it('ne compte que les jours avec bolus (une basale seule ne suffit pas)', () => {
    const basalOnly = Array.from({ length: 14 }, (_, i) => entry(dayAgo(i, 22), { mealType: 'basal', doseReelle: 20 }));
    expect(analyzeTreatment(basalOnly, INPUTS).daysOfData).toBe(0);
  });

  it('respecte minDays et la fenêtre days', () => {
    expect(analyzeTreatment(standardJournal(5), { ...INPUTS, minDays: 3 }).enoughData).toBe(true);
    // 14 jours de données mais fenêtre de 7 jours → 7 jours analysés
    const narrow = analyzeTreatment(standardJournal(14), { ...INPUTS, days: 7 });
    expect(narrow.daysOfData).toBe(7);
    expect(narrow.enoughData).toBe(false);
    expect(analyzeTreatment(standardJournal(14), { ...INPUTS, days: 7, minDays: 7 }).enoughData).toBe(true);
  });
});

// ─── TDD ────────────────────────────────────────────────────────────────────

describe('analyzeTreatment — TDD', () => {
  it('calcule la TDD quotidienne à partir des repas, injections et basales', () => {
    const totals = dailyTotals(standardDay(0));
    expect([...totals.values()]).toEqual([35]);
  });

  it('calcule moyenne, écart-type, CV et estimation de basale (45 %, arrondi au demi)', () => {
    const result = analyzeTreatment(standardJournal(), INPUTS);
    expect(result.enoughData).toBe(true);
    expect(result.daysOfData).toBe(14);
    expect(result.tdd).toEqual({ meanU: 35, sdU: 0, cvPct: 0, variabilityHigh: false, basalEstimateU: 16 });
    expect(result.suggestions).toEqual([]);
  });

  it('signale une variabilité élevée (CV > 20 %) et émet SUGGEST_TDD_VARIABILITY', () => {
    // Jours pairs : TDD 35 ; jours impairs : TDD 55 → moyenne 45, écart-type 10, CV 22.2 %
    const result = analyzeTreatment(standardJournal(14, (i) => ({ basal: i % 2 === 0 ? 20 : 40 })), INPUTS);
    expect(result.tdd.meanU).toBe(45);
    expect(result.tdd.sdU).toBe(10);
    expect(result.tdd.cvPct).toBe(22.2);
    expect(result.tdd.variabilityHigh).toBe(true);
    expect(result.tdd.basalEstimateU).toBe(20.5);
    const s = result.suggestions.find((x) => x.code === 'SUGGEST_TDD_VARIABILITY');
    expect(s?.params).toEqual({ cvPct: 22.2, meanU: 45, sdU: 10 });
  });

  it('ignore les entrées hypo et mesure dans la TDD', () => {
    const journal = [
      ...standardJournal(),
      entry(dayAgo(0, 16), { mealType: 'hypo', glycPre: 0.6, hypoTreatment: { carbsG: 15 } }),
      entry(dayAgo(0, 17), { mealType: 'mesure', glycPre: 1.4 }),
    ];
    expect(analyzeTreatment(journal, INPUTS).tdd.meanU).toBe(35);
  });
});

// ─── Ratio par période ──────────────────────────────────────────────────────

describe('analyzeTreatment — ratio par période', () => {
  it('renvoie les 4 périodes dans l’ordre avec les effectifs', () => {
    const result = analyzeTreatment(standardJournal(), INPUTS);
    expect(result.ratioByPeriod.map((r) => r.period)).toEqual(['matin', 'midi', 'soir', 'nuit']);
    expect(period(result, 'matin').n).toBe(14);
    expect(period(result, 'nuit')).toEqual({ period: 'nuit', n: 0, underPct: 0, overPct: 0, meanPost: null, suggestion: null, suggestedRatio: null });
  });

  it('suggère de baisser le ratio quand ≥ 60 % des post dépassent targetMax + 0.30', () => {
    const result = analyzeTreatment(standardJournal(14, () => ({ lunchPost: 2.4 })), INPUTS);
    const midi = period(result, 'midi');
    expect(midi.underPct).toBe(100);
    expect(midi.overPct).toBe(0);
    expect(midi.meanPost).toBe(2.4);
    expect(midi.suggestion).toBe('SUGGEST_RATIO_DECREASE');
    expect(midi.suggestedRatio).toBe(9);
    expect(period(result, 'matin').suggestion).toBeNull();
    expect(period(result, 'soir').suggestion).toBeNull();
    const s = result.suggestions.find((x) => x.code === 'SUGGEST_RATIO_DECREASE');
    expect(s?.period).toBe('midi');
    expect(s?.params).toEqual({ n: 14, underPct: 100, overPct: 0, currentRatio: 10, suggestedRatio: 9 });
  });

  it('suggère d’augmenter le ratio quand ≥ 60 % des post sont sous targetMin', () => {
    const result = analyzeTreatment(standardJournal(14, () => ({ dinnerPost: 0.85 })), INPUTS);
    const soir = period(result, 'soir');
    expect(soir.overPct).toBe(100);
    expect(soir.suggestion).toBe('SUGGEST_RATIO_INCREASE');
    expect(soir.suggestedRatio).toBe(11);
    expect(result.suggestions.map((s) => s.code)).toContain('SUGGEST_RATIO_INCREASE');
  });

  it('ne suggère rien sous 60 % ou avec moins de 3 repas', () => {
    // 7 déjeuners hauts sur 14 → 50 %
    const half = analyzeTreatment(standardJournal(14, (i) => ({ lunchPost: i % 2 === 0 ? 2.4 : 1.5 })), INPUTS);
    expect(period(half, 'midi').underPct).toBe(50);
    expect(period(half, 'midi').suggestion).toBeNull();
    // 2 collations nocturnes très hautes seulement
    const night = analyzeTreatment(
      [...standardJournal(), ...[0, 1].map((i) => entry(dayAgo(i, 22, 30), { mealType: 'collation', glycPre: 1.2, glycPost: 2.6, totalGlucides: 20, doseReelle: 2 }))],
      INPUTS,
    );
    expect(period(night, 'nuit').n).toBe(2);
    expect(period(night, 'nuit').underPct).toBe(100);
    expect(period(night, 'nuit').suggestion).toBeNull();
  });

  it('garantit un ratio suggéré entier, ≥ 1 et différent du ratio courant', () => {
    const journal = standardJournal(14, () => ({ lunchPost: 2.4 }));
    // 5 × 0.9 = 4.5 → arrondi 5 (= courant) → forcé à 4
    expect(period(analyzeTreatment(journal, { ...INPUTS, ratio: 5 }), 'midi').suggestedRatio).toBe(4);
    expect(period(analyzeTreatment(journal, { ...INPUTS, ratio: 1 }), 'midi').suggestedRatio).toBe(1);
    const up = standardJournal(14, () => ({ dinnerPost: 0.85 }));
    expect(period(analyzeTreatment(up, { ...INPUTS, ratio: 4 }), 'soir').suggestedRatio).toBe(5);
    expect(period(analyzeTreatment(up, { ...INPUTS, ratio: 0 }), 'soir').suggestedRatio).toBeNull();
  });
});

// ─── ISF ────────────────────────────────────────────────────────────────────

describe('analyzeTreatment — ISF effective', () => {
  it('suggère de baisser l’ISF quand l’ISF effective < 80 % de la configurée', () => {
    // (2.5 − 1.5) × 100 / 2 = 50 mg/dL/U contre 100 configurés
    const journal = [...standardJournal(), ...[1, 3, 5].map((i) => correction(dayAgo(i, 16), 2.5, 1.5, 2))];
    const result = analyzeTreatment(journal, INPUTS);
    expect(result.isf).toEqual({ n: 3, effectiveMgdl: 50, suggestion: 'SUGGEST_ISF_DECREASE' });
    const s = result.suggestions.find((x) => x.code === 'SUGGEST_ISF_DECREASE');
    expect(s?.params).toEqual({ n: 3, effectiveMgdl: 50, configuredMgdl: 100 });
  });

  it('suggère d’augmenter l’ISF quand l’ISF effective > 120 % de la configurée', () => {
    // (2.5 − 1.0) × 100 / 1 = 150
    const journal = [...standardJournal(), ...[1, 3, 5].map((i) => correction(dayAgo(i, 16), 2.5, 1.0, 1))];
    const result = analyzeTreatment(journal, INPUTS);
    expect(result.isf.effectiveMgdl).toBe(150);
    expect(result.isf.suggestion).toBe('SUGGEST_ISF_INCREASE');
  });

  it('utilise la médiane et ne suggère rien dans la zone ±20 %', () => {
    // 90, 100, 110 → médiane 100
    const journal = [
      ...standardJournal(),
      correction(dayAgo(1, 16), 2.4, 1.5, 1),
      correction(dayAgo(3, 16), 2.5, 1.5, 1),
      correction(dayAgo(5, 16), 2.6, 1.5, 1),
    ];
    const result = analyzeTreatment(journal, INPUTS);
    expect(result.isf).toEqual({ n: 3, effectiveMgdl: 100, suggestion: null });
  });

  it('écarte les valeurs implausibles (< 5 ou > 300) et exige n ≥ 3', () => {
    const journal = [
      ...standardJournal(),
      correction(dayAgo(1, 16), 2.5, 1.5, 2), // 50
      correction(dayAgo(3, 16), 2.5, 1.5, 2), // 50
      correction(dayAgo(5, 16), 1.5, 1.48, 1), // 2 → écarté
      correction(dayAgo(7, 16), 4.0, 0.5, 1), // 350 → écarté
      correction(dayAgo(9, 16), 2.5, 2.8, 1), // négatif → écarté
    ];
    const result = analyzeTreatment(journal, INPUTS);
    expect(result.isf).toEqual({ n: 2, effectiveMgdl: 50, suggestion: null });
    expect(result.suggestions.map((s) => s.code)).not.toContain('SUGGEST_ISF_DECREASE');
  });

  it('ignore les repas et les corrections sans post', () => {
    const journal = [
      ...standardJournal(14, () => ({ lunchPost: 0.5 })),
      ...[1, 3, 5].map((i) => entry(dayAgo(i, 16), { mealType: 'injection', injectionType: 'correction', glycPre: 2.5, doseReelle: 2 })),
    ];
    expect(analyzeTreatment(journal, INPUTS).isf.n).toBe(0);
  });
});

// ─── Vérification de la basale ──────────────────────────────────────────────

describe('analyzeTreatment — SUGGEST_BASAL_CHECK', () => {
  it('propage les hypos matinales détectées par patterns.ts', () => {
    const result = analyzeTreatment(standardJournal(14, (i) => ({ breakfastPre: i < 3 ? 0.6 : 1.2 })), INPUTS);
    const s = result.suggestions.find((x) => x.code === 'SUGGEST_BASAL_CHECK');
    expect(s).toBeDefined();
    expect(String(s?.params.patterns).split(',')).toContain('PATTERN_MORNING_HYPO');
    expect(s?.params.count).toBe(1);
  });

  it('propage une glycémie à jeun élevée (et l’aube si présente)', () => {
    // Pré petit-déjeuner 1.9 chaque jour ; dernière lecture de la veille = post dîner 1.5 → aube aussi
    const result = analyzeTreatment(standardJournal(14, () => ({ breakfastPre: 1.9 })), INPUTS);
    const s = result.suggestions.find((x) => x.code === 'SUGGEST_BASAL_CHECK');
    const found = String(s?.params.patterns).split(',');
    expect(found).toContain('PATTERN_HIGH_FASTING');
    expect(found).toContain('PATTERN_DAWN');
    expect(s?.params.count).toBe(2);
  });

  it('n’émet rien sur un journal équilibré', () => {
    const result = analyzeTreatment(standardJournal(), INPUTS);
    expect(result.suggestions.map((s) => s.code)).not.toContain('SUGGEST_BASAL_CHECK');
  });
});

// ─── Agrégation ─────────────────────────────────────────────────────────────

describe('analyzeTreatment — agrégation des suggestions', () => {
  it('cumule ratio, ISF, variabilité et basale dans l’ordre', () => {
    const journal = [
      ...standardJournal(14, (i) => ({ lunchPost: 2.4, basal: i % 2 === 0 ? 20 : 40, breakfastPre: i < 3 ? 0.6 : 1.2 })),
      ...[1, 3, 5].map((i) => correction(dayAgo(i, 16), 2.5, 1.5, 2)),
    ];
    const result = analyzeTreatment(journal, INPUTS);
    expect(result.suggestions.map((s) => s.code)).toEqual([
      'SUGGEST_RATIO_DECREASE',
      'SUGGEST_ISF_DECREASE',
      'SUGGEST_TDD_VARIABILITY',
      'SUGGEST_BASAL_CHECK',
    ]);
    for (const s of result.suggestions) {
      for (const v of Object.values(s.params)) expect(['string', 'number']).toContain(typeof v);
    }
  });

  it('accepte un journal non trié', () => {
    const journal = standardJournal(14, () => ({ lunchPost: 2.4 }));
    const shuffled = [...journal].reverse();
    expect(analyzeTreatment(shuffled, INPUTS)).toEqual(analyzeTreatment(journal, INPUTS));
  });
});
