/**
 * Analyse du traitement et recommandations d'ajustement (spec F8).
 *
 * À partir du journal sur une fenêtre glissante, le module :
 * - mesure la dose totale quotidienne (TDD) et sa variabilité ;
 * - évalue le ratio glucides/insuline par période de la journée (matin, midi, soir, nuit) ;
 * - estime la sensibilité à l'insuline (ISF) effective à partir des corrections isolées ;
 * - agrège des suggestions codées (l'UI traduit) à discuter avec l'équipe soignante.
 *
 * Aucune suggestion n'est émise sans un historique suffisant (`minDays` jours avec bolus).
 */
import type { JournalEntry } from '../types';
import type { DayPeriod } from '../time';
import { hourOf, localDateKey, periodOfDay } from '../time';
import {
  entryDate,
  entryKind,
  getActualDose,
  getGlucosePost,
  getGlucosePre,
  isBolusInjection,
  isCorrectionOnly,
} from '../journal';
import { mean, percentile, round05, roundTo, stdDev } from '../units';
import { detectPatterns, selectWindowEntries } from './patterns';
import type { PatternCode } from './patterns';

export interface TreatmentInputs {
  /** Ratio glucides/insuline configuré, en g par unité. */
  ratio: number;
  /** Sensibilité à l'insuline configurée, en mg/dL par unité. */
  isfMgdl: number;
  /** Plage cible personnelle, en g/L. */
  targetMin: number;
  targetMax: number;
  /** Fenêtre analysée en jours (défaut 14). */
  days?: number;
  /** Nombre minimal de jours avec bolus pour émettre des suggestions (défaut 14). */
  minDays?: number;
  now?: Date;
}

export type RatioSuggestionCode = 'SUGGEST_RATIO_DECREASE' | 'SUGGEST_RATIO_INCREASE';
export type IsfSuggestionCode = 'SUGGEST_ISF_INCREASE' | 'SUGGEST_ISF_DECREASE';
export type TreatmentSuggestionCode =
  | RatioSuggestionCode
  | IsfSuggestionCode
  | 'SUGGEST_TDD_VARIABILITY'
  | 'SUGGEST_BASAL_CHECK';

export interface PeriodRatioAnalysis {
  period: DayPeriod;
  /** Repas avec glycémie pré ET post dans la période. */
  n: number;
  /** % de repas dont la post dépasse targetMax + 0.30 (insuline insuffisante). */
  underPct: number;
  /** % de repas dont la post est sous targetMin (insuline excessive). */
  overPct: number;
  meanPost: number | null;
  suggestion: RatioSuggestionCode | null;
  /** Ratio proposé (g/U, entier ≥ 1) ; null sans suggestion ou si le ratio configuré est invalide. */
  suggestedRatio: number | null;
}

export interface TddAnalysis {
  meanU: number | null;
  sdU: number | null;
  cvPct: number | null;
  /** CV > 20 %. */
  variabilityHigh: boolean;
  /** Estimation de la basale : 45 % de la TDD moyenne, arrondie au demi. */
  basalEstimateU: number | null;
}

export interface IsfAnalysis {
  /** Corrections isolées exploitables (pré, post et dose présents, valeur plausible). */
  n: number;
  /** Médiane de (pré − post) × 100 / dose, en mg/dL par unité. */
  effectiveMgdl: number | null;
  suggestion: IsfSuggestionCode | null;
}

export interface TreatmentSuggestion {
  code: TreatmentSuggestionCode;
  period?: DayPeriod;
  params: Record<string, string | number>;
}

export interface TreatmentAnalysis {
  enoughData: boolean;
  /** Jours locaux distincts comportant au moins un bolus dans la fenêtre. */
  daysOfData: number;
  entriesAnalyzed: number;
  tdd: TddAnalysis;
  ratioByPeriod: PeriodRatioAnalysis[];
  isf: IsfAnalysis;
  suggestions: TreatmentSuggestion[];
}

/** Règles de l'analyseur. */
export const TREATMENT_RULES = {
  defaultDays: 14,
  defaultMinDays: 14,
  cvHighPct: 20,
  basalShare: 0.45,
  /** Marge au-dessus de targetMax à partir de laquelle une post est jugée trop haute. */
  postMealMargin: 0.30,
  ratioMinN: 3,
  ratioMinPct: 60,
  ratioDecreaseFactor: 0.9,
  ratioIncreaseFactor: 1.1,
  isfMinN: 3,
  isfMinEffective: 5,
  isfMaxEffective: 300,
  isfLowFactor: 0.8,
  isfHighFactor: 1.2,
  /** Schémas qui justifient une vérification de la basale. */
  basalPatterns: ['PATTERN_MORNING_HYPO', 'PATTERN_HIGH_FASTING', 'PATTERN_DAWN'] as readonly PatternCode[],
} as const;

const PERIODS: readonly DayPeriod[] = ['matin', 'midi', 'soir', 'nuit'];

const EMPTY_TDD: TddAnalysis = { meanU: null, sdU: null, cvPct: null, variabilityHigh: false, basalEstimateU: null };
const EMPTY_ISF: IsfAnalysis = { n: 0, effectiveMgdl: null, suggestion: null };

const pct = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

// ─── TDD ────────────────────────────────────────────────────────────────────

/** TDD par jour local = somme des doses réelles des entrées repas / injection / basale. */
export function dailyTotals(entries: JournalEntry[]): Map<string, number> {
  const perDay = new Map<string, number>();
  for (const e of entries) {
    const kind = entryKind(e);
    if (kind !== 'meal' && kind !== 'injection' && kind !== 'basal') continue;
    const dose = getActualDose(e);
    if (dose <= 0) continue;
    const key = localDateKey(entryDate(e));
    perDay.set(key, (perDay.get(key) ?? 0) + dose);
  }
  return perDay;
}

function analyzeTdd(entries: JournalEntry[]): TddAnalysis {
  const totals = [...dailyTotals(entries).values()];
  const m = mean(totals);
  if (m == null) return EMPTY_TDD;
  const sd = stdDev(totals);
  const cv = sd != null && m > 0 ? (sd / m) * 100 : null;
  return {
    meanU: roundTo(m, 1),
    sdU: sd != null ? roundTo(sd, 1) : null,
    cvPct: cv != null ? roundTo(cv, 1) : null,
    variabilityHigh: cv != null && cv > TREATMENT_RULES.cvHighPct,
    basalEstimateU: round05(TREATMENT_RULES.basalShare * m),
  };
}

// ─── Ratio par période ──────────────────────────────────────────────────────

/** Ratio ajusté, entier ≥ 1, garanti différent du ratio courant dans le sens demandé. */
function adjustedRatio(ratio: number, factor: number): number | null {
  if (!(ratio > 0)) return null;
  let next = Math.max(1, Math.round(ratio * factor));
  if (next === Math.round(ratio)) next = factor < 1 ? Math.max(1, next - 1) : next + 1;
  return next;
}

function analyzeRatioByPeriod(entries: JournalEntry[], inputs: TreatmentInputs): PeriodRatioAnalysis[] {
  const highLimit = inputs.targetMax + TREATMENT_RULES.postMealMargin;
  const meals = entries
    .filter((e) => entryKind(e) === 'meal')
    .map((e) => ({ period: periodOfDay(hourOf(entryDate(e))), pre: getGlucosePre(e), post: getGlucosePost(e) }))
    .filter((m): m is { period: DayPeriod; pre: number; post: number } => m.pre != null && m.post != null);

  return PERIODS.map((period) => {
    const posts = meals.filter((m) => m.period === period).map((m) => m.post);
    const n = posts.length;
    const under = posts.filter((p) => p > highLimit).length;
    const over = posts.filter((p) => p < inputs.targetMin).length;
    const underPct = pct(under, n);
    const overPct = pct(over, n);
    const meanPostRaw = mean(posts);

    let suggestion: RatioSuggestionCode | null = null;
    if (n >= TREATMENT_RULES.ratioMinN) {
      if (underPct >= TREATMENT_RULES.ratioMinPct) suggestion = 'SUGGEST_RATIO_DECREASE';
      else if (overPct >= TREATMENT_RULES.ratioMinPct) suggestion = 'SUGGEST_RATIO_INCREASE';
    }
    const suggestedRatio =
      suggestion === 'SUGGEST_RATIO_DECREASE'
        ? adjustedRatio(inputs.ratio, TREATMENT_RULES.ratioDecreaseFactor)
        : suggestion === 'SUGGEST_RATIO_INCREASE'
          ? adjustedRatio(inputs.ratio, TREATMENT_RULES.ratioIncreaseFactor)
          : null;

    return {
      period,
      n,
      underPct,
      overPct,
      meanPost: meanPostRaw != null ? roundTo(meanPostRaw, 2) : null,
      suggestion,
      suggestedRatio,
    };
  });
}

// ─── ISF effective ──────────────────────────────────────────────────────────

function analyzeIsf(entries: JournalEntry[], isfMgdl: number): IsfAnalysis {
  const values: number[] = [];
  for (const e of entries) {
    if (!isCorrectionOnly(e)) continue;
    const pre = getGlucosePre(e);
    const post = getGlucosePost(e);
    const dose = getActualDose(e);
    if (pre == null || post == null || dose <= 0) continue;
    const effective = ((pre - post) * 100) / dose;
    if (effective >= TREATMENT_RULES.isfMinEffective && effective <= TREATMENT_RULES.isfMaxEffective) values.push(effective);
  }
  const n = values.length;
  const median = percentile([...values].sort((a, b) => a - b), 50);
  if (median == null) return { ...EMPTY_ISF, n };

  let suggestion: IsfSuggestionCode | null = null;
  if (n >= TREATMENT_RULES.isfMinN && isfMgdl > 0) {
    // Insuline moins efficace que prévu ⇒ l'ISF configurée est trop haute (à baisser), et inversement.
    if (median < isfMgdl * TREATMENT_RULES.isfLowFactor) suggestion = 'SUGGEST_ISF_DECREASE';
    else if (median > isfMgdl * TREATMENT_RULES.isfHighFactor) suggestion = 'SUGGEST_ISF_INCREASE';
  }
  return { n, effectiveMgdl: Math.round(median), suggestion };
}

// ─── Point d'entrée ─────────────────────────────────────────────────────────

export function analyzeTreatment(entries: JournalEntry[], inputs: TreatmentInputs): TreatmentAnalysis {
  const now = inputs.now ?? new Date();
  const days = inputs.days ?? TREATMENT_RULES.defaultDays;
  const minDays = inputs.minDays ?? TREATMENT_RULES.defaultMinDays;
  const sorted = selectWindowEntries(entries ?? [], now, days);

  const bolusDays = new Set(sorted.filter(isBolusInjection).map((e) => localDateKey(entryDate(e))));
  const daysOfData = bolusDays.size;
  const enoughData = daysOfData >= minDays;
  const base = { enoughData, daysOfData, entriesAnalyzed: sorted.length };

  if (!enoughData) {
    return { ...base, tdd: EMPTY_TDD, ratioByPeriod: [], isf: EMPTY_ISF, suggestions: [] };
  }

  const tdd = analyzeTdd(sorted);
  const ratioByPeriod = analyzeRatioByPeriod(sorted, inputs);
  const isf = analyzeIsf(sorted, inputs.isfMgdl);
  const suggestions: TreatmentSuggestion[] = [];

  for (const r of ratioByPeriod) {
    if (!r.suggestion) continue;
    suggestions.push({
      code: r.suggestion,
      period: r.period,
      params: {
        n: r.n,
        underPct: r.underPct,
        overPct: r.overPct,
        currentRatio: inputs.ratio,
        ...(r.suggestedRatio != null ? { suggestedRatio: r.suggestedRatio } : {}),
      },
    });
  }

  if (isf.suggestion && isf.effectiveMgdl != null) {
    suggestions.push({
      code: isf.suggestion,
      params: { n: isf.n, effectiveMgdl: isf.effectiveMgdl, configuredMgdl: inputs.isfMgdl },
    });
  }

  if (tdd.variabilityHigh && tdd.cvPct != null && tdd.meanU != null) {
    suggestions.push({
      code: 'SUGGEST_TDD_VARIABILITY',
      params: { cvPct: tdd.cvPct, meanU: tdd.meanU, sdU: tdd.sdU ?? 0 },
    });
  }

  const basalPatterns = detectPatterns(sorted, { now, days, targetMin: inputs.targetMin, targetMax: inputs.targetMax })
    .filter((p) => TREATMENT_RULES.basalPatterns.includes(p.code))
    .map((p) => p.code);
  if (basalPatterns.length > 0) {
    suggestions.push({
      code: 'SUGGEST_BASAL_CHECK',
      params: { patterns: basalPatterns.join(','), count: basalPatterns.length },
    });
  }

  return { ...base, tdd, ratioByPeriod, isf, suggestions };
}
