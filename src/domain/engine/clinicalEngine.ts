/**
 * Moteur clinique InsulinCalc v7 — fonctions pures, sans texte utilisateur.
 * Glycémies en g/L, ISF en mg/dL par unité (unité explicite), ratio en g de glucides par unité.
 */
import type { Activity, FatLevel, SplitPhase, Trend } from '../types';
import { round05, roundTo } from '../units';
import { isNightHour } from '../time';
import { CONSENSUS, classifyGlucose, type GlucoseLevel } from '../analytics/metrics';
import { makeAlert, type SafetyAlert } from './safetyCodes';
import { classifyVelocity, trendToVelocityClass, velocityClassToTrend, type VelocityClass } from './velocity';
import { calcHypoRisk, type HypoRiskResult } from './hypoRisk';
import { predictGlucose, type GlucosePrediction } from './prediction';

// ─── Constantes ───────────────────────────────────────────────────────────────

export const FAT_FACTOR: Record<FatLevel, number> = { aucun: 0, faible: 0.04, moyen: 0.14, 'élevé': 0.27 };
export const ACTIVITY_REDUCTION: Record<Activity, number> = { aucune: 1.0, legere: 1.0, moderee: 0.80, intense: 0.70 };
export const SINGLE_INJECTION_WARNING_THRESHOLD = 25;
export const STACKING_CAP_MINUTES = 180;
export const STACKING_CAP_UNITS = 1.0;
export const DEFAULT_NIGHT = { enabled: true, start: 21, end: 6, correctionMin: 1.80, snackBelow: 1.50 };
export const DEFAULT_FASTING = { suhoorFactor: 0.75, correctionFactor: 0.5, breakBelow: 0.70, breakAbove: 3.00 };

export { round05 };

// ─── Calcul de dose ───────────────────────────────────────────────────────────

/** Facteur gras continu depuis les grammes réels (0 g → 0, 30 g → 0.27, plafond 0.35), sinon qualitatif. */
export function computeFatFactor(fatLevel: FatLevel | string, totalFatGrams?: number | null): number {
  if (totalFatGrams != null && totalFatGrams > 0) return Math.min(0.35, totalFatGrams * 0.009);
  return FAT_FACTOR[fatLevel as FatLevel] ?? 0;
}

export interface DoseInputs {
  totalCarbs: number;
  glycemia: number;
  ratio: number;
  isfMgdl: number;
  targetMax: number;
  iobTotal: number;
  fatLevel: FatLevel | string;
  activity: Activity | string;
  totalFatGrams?: number | null;
}

export interface DoseResult {
  bolusRepas: number;
  correction: number;
  correctionNette: number;
  bonusGras: number;
  doseBeforeActivity: number;
  activityFactor: number;
  doseSuggeree: number;
}

/**
 * bolusRepas = glucides / ratio ; correction = (glycémie − cibleMax) × 100 / ISF(mg/dL) si glycémie > cibleMax ;
 * correctionNette = max(0, correction − IOB) ; bonusGras = bolusRepas × facteur ; dose = round05(total × activité).
 */
export function calculateDose(p: DoseInputs): DoseResult {
  const ratio = p.ratio > 0 ? p.ratio : 1;
  const isf = p.isfMgdl > 0 ? p.isfMgdl : 1;
  const bolusRepas = Math.max(0, p.totalCarbs) / ratio;
  const correction = p.glycemia > p.targetMax ? ((p.glycemia - p.targetMax) * 100) / isf : 0;
  const correctionNette = Math.max(0, correction - Math.max(0, p.iobTotal));
  const bonusGras = bolusRepas * computeFatFactor(p.fatLevel, p.totalFatGrams);
  const doseBeforeActivity = bolusRepas + correctionNette + bonusGras;
  const activityFactor = ACTIVITY_REDUCTION[p.activity as Activity] ?? 1.0;
  return {
    bolusRepas, correction, correctionNette, bonusGras, doseBeforeActivity, activityFactor,
    doseSuggeree: round05(doseBeforeActivity * activityFactor),
  };
}

// ─── Règles de sécurité ───────────────────────────────────────────────────────

export interface NightSettings { enabled: boolean; start: number; end: number; correctionMin: number; snackBelow: number }
export interface FastingSettings { enabled: boolean; mealSlot?: 'suhoor' | 'iftar' | 'other' | null; suhoorFactor?: number; correctionFactor?: number }

export interface SafetyContext {
  glycemia: number;
  doseSuggeree: number;
  correction: number;
  correctionNette?: number;
  iobTotal: number;
  trend?: Trend | string | null;
  /** Vitesse mesurée (g/L/h) ; prioritaire sur la tendance manuelle. */
  velocity?: number | null;
  activity?: Activity | string;
  activityFactor?: number;
  postKeto?: boolean;
  illness?: boolean;
  lastInjectionMinutesAgo?: number | null;
  hour?: number | null;
  night?: Partial<NightSettings> | null;
  cumulCorrections24h?: number | null;
  tddEstimate?: number | null;
  hypoIn24h?: boolean;
  maxDoseU?: number | null;
  fasting?: FastingSettings | null;
}

export interface SafetyResult {
  blocked: boolean;
  adjustedDose: number;
  adjustedCorrection: number;
  correctionBlocked: boolean;
  requiresConfirmation: boolean;
  nightMode: boolean;
  velocityClass: VelocityClass;
  hypoRisk: HypoRiskResult;
  risks: SafetyAlert[];
  warnings: SafetyAlert[];
  infos: SafetyAlert[];
}

/**
 * Applique les règles de sécurité dans l'ordre et renvoie la dose ajustée.
 * Les règles qui modifient la correction retirent la différence de la dose
 * (la dose ne contient que la correction NETTE, l'IOB étant déjà déduite).
 */
export function applySafetyRules(ctx: SafetyContext): SafetyResult {
  const risks: SafetyAlert[] = [];
  const warnings: SafetyAlert[] = [];
  const infos: SafetyAlert[] = [];
  const night: NightSettings = { ...DEFAULT_NIGHT, ...(ctx.night ?? {}) };
  const hour = ctx.hour ?? null;
  const nightMode = night.enabled && hour != null && isNightHour(hour, night.start, night.end);
  const measuredClass = ctx.velocity != null ? classifyVelocity(ctx.velocity) : 'unknown';
  const velocityClass: VelocityClass = measuredClass !== 'unknown' ? measuredClass : trendToVelocityClass(ctx.trend);
  const hypoRisk = calcHypoRisk({
    glycemia: ctx.glycemia, iobTotal: ctx.iobTotal, velocityClass,
    hypoIn24h: Boolean(ctx.hypoIn24h), activity: ctx.activity ?? 'aucune',
    hour: hour ?? 12, nightStart: night.start, nightEnd: night.end,
  });

  const base = {
    nightMode, velocityClass, hypoRisk, infos, correctionBlocked: false, requiresConfirmation: false,
  };

  // Règle 1 — Anti-hypo : glycémie < 0.70 → blocage immédiat
  if (ctx.glycemia < CONSENSUS.level1Low) {
    risks.push(makeAlert('SAFETY_ANTI_HYPO', 'risk', { glycemia: ctx.glycemia }));
    return { ...base, blocked: true, adjustedDose: 0, adjustedCorrection: 0, correctionBlocked: true, risks, warnings };
  }

  let adjustedDose = ctx.doseSuggeree;
  let correction = Math.max(0, ctx.correctionNette ?? ctx.correction);
  let correctionBlocked = false;
  let halved = false;

  // Sémantique historique : on retire round05(correction × (1 − facteur)) de la dose.
  const reduceCorrection = (factor: number) => {
    const delta = round05(correction * (1 - factor));
    adjustedDose = Math.max(0, adjustedDose - delta);
    correction = Math.max(0, round05(correction - delta));
    if (factor <= 0) {
      correction = 0;
      correctionBlocked = true;
    }
  };

  // Règle 2 — Hypo-proche : 0.70 ≤ glycémie < 0.90 → dose totale × 0.5
  if (ctx.glycemia < 0.90) {
    adjustedDose = round05(adjustedDose * 0.5);
    correction = round05(correction * 0.5);
    halved = true;
    risks.push(makeAlert('SAFETY_HYPO_PROCHE', 'risk', { glycemia: ctx.glycemia }));
  }

  // Règle 3 — Score de risque hypo : critique → correction bloquée ; élevé → dose × 0.5 (une seule fois).
  // La réduction de dose ne s'applique pas en hyperglycémie (> 1.80) : le score ne pondère pas une glycémie haute.
  const riskReductionAllowed = ctx.glycemia < CONSENSUS.level1High;
  if (hypoRisk.level === 'critical') {
    if (correction > 0) reduceCorrection(0);
    if (riskReductionAllowed && !halved) {
      adjustedDose = round05(adjustedDose * 0.5);
      halved = true;
    }
    risks.push(makeAlert('SAFETY_HYPO_RISK_CRITICAL', 'risk', { score: hypoRisk.score }));
  } else if (hypoRisk.level === 'high' && !halved && riskReductionAllowed) {
    adjustedDose = round05(adjustedDose * 0.5);
    correction = round05(correction * 0.5);
    halved = true;
    risks.push(makeAlert('SAFETY_HYPO_RISK_HIGH', 'risk', { score: hypoRisk.score }));
  }

  // Règle 4 — Vitesse / tendance
  if (correction > 0) {
    if (measuredClass === 'falling_fast') {
      reduceCorrection(0);
      warnings.push(makeAlert('SAFETY_VELOCITY_FALLING_FAST', 'warning', { velocity: ctx.velocity ?? 0 }));
    } else if (velocityClass === 'falling' || velocityClass === 'falling_fast') {
      reduceCorrection(0.5);
      warnings.push(makeAlert('SAFETY_SUR_CORRECTION', 'warning', {}));
    } else if (measuredClass === 'rising_fast') {
      const next = round05(correction * 1.2);
      adjustedDose = round05(adjustedDose + (next - correction));
      correction = next;
      warnings.push(makeAlert('SAFETY_VELOCITY_RISING_FAST', 'warning', { velocity: ctx.velocity ?? 0 }));
    }
  }

  // Règle 5 — Mode nocturne
  if (nightMode) {
    if (ctx.glycemia < night.snackBelow) infos.push(makeAlert('SAFETY_NIGHT_LOW', 'info', { glycemia: ctx.glycemia, threshold: night.snackBelow }));
    if (correction > 0) {
      if (ctx.glycemia < night.correctionMin) {
        reduceCorrection(0);
        warnings.push(makeAlert('SAFETY_NIGHT_BLOCK', 'warning', { glycemia: ctx.glycemia, threshold: night.correctionMin }));
      } else {
        reduceCorrection(0.5);
        warnings.push(makeAlert('SAFETY_NIGHT_REDUCE', 'warning', { glycemia: ctx.glycemia }));
      }
    }
  }

  // Règle 6 — Jeûne (Ramadan)
  if (ctx.fasting?.enabled) {
    if (ctx.glycemia > DEFAULT_FASTING.breakAbove) {
      risks.push(makeAlert('SAFETY_FASTING_BREAK', 'risk', { glycemia: ctx.glycemia }));
    }
    if (ctx.fasting.mealSlot === 'suhoor') {
      const factor = ctx.fasting.suhoorFactor ?? DEFAULT_FASTING.suhoorFactor;
      adjustedDose = round05(adjustedDose * factor);
      correction = round05(correction * factor);
      warnings.push(makeAlert('SAFETY_FASTING_SUHOOR_REDUCE', 'warning', { pct: Math.round((1 - factor) * 100) }));
    } else if (ctx.fasting.mealSlot !== 'iftar' && correction > 0) {
      const factor = ctx.fasting.correctionFactor ?? DEFAULT_FASTING.correctionFactor;
      reduceCorrection(factor);
      warnings.push(makeAlert('SAFETY_FASTING_CORRECTION_REDUCE', 'warning', { pct: Math.round((1 - factor) * 100) }));
    }
  }

  // Règle 7 — Plafond de correction si injection récente (< 180 min)
  if (ctx.lastInjectionMinutesAgo != null && ctx.lastInjectionMinutesAgo < STACKING_CAP_MINUTES && correction > STACKING_CAP_UNITS) {
    const delta = round05(correction - STACKING_CAP_UNITS);
    adjustedDose = Math.max(0, adjustedDose - delta);
    correction = STACKING_CAP_UNITS;
    warnings.push(makeAlert('SAFETY_CORRECTION_CAPPED', 'warning', { minutes: Math.round(ctx.lastInjectionMinutesAgo), cap: STACKING_CAP_UNITS }));
  }

  // Règle 8 — Anti-empilement : IOB élevée avec correction active
  if (ctx.iobTotal > 2 && ctx.correction > 0) {
    warnings.push(makeAlert('SAFETY_ANTI_STACKING', 'warning', { iob: roundTo(ctx.iobTotal, 1) }));
  }
  if (adjustedDose > 0 && ctx.iobTotal / adjustedDose > 0.5 && ctx.iobTotal >= 1) {
    warnings.push(makeAlert('SAFETY_IOB_RATIO', 'warning', { iob: roundTo(ctx.iobTotal, 1), pct: Math.round((ctx.iobTotal / adjustedDose) * 100) }));
  }

  // Règle 9 — Timing : dernière injection < 2 h
  if (ctx.lastInjectionMinutesAgo != null && ctx.lastInjectionMinutesAgo < 120) {
    warnings.push(makeAlert('SAFETY_TIMING', 'warning', { minutes: Math.round(ctx.lastInjectionMinutesAgo) }));
  }

  // Règle 10 — Cumul de corrections sur 24 h
  if (ctx.tddEstimate && ctx.tddEstimate > 0 && ctx.cumulCorrections24h != null && ctx.cumulCorrections24h > ctx.tddEstimate * 0.15) {
    warnings.push(makeAlert('SAFETY_CUMUL_HIGH', 'warning', { cumul: round05(ctx.cumulCorrections24h), limit: round05(ctx.tddEstimate * 0.15) }));
  }

  // Règle 11 — Contextes : post-cétose, maladie
  if (ctx.postKeto) warnings.push(makeAlert('SAFETY_POST_KETO', 'warning', {}));
  if (ctx.illness) infos.push(makeAlert('SAFETY_ILLNESS', 'info', {}));

  // Règle 12 — Plafond de dose absolu : confirmation explicite requise
  let requiresConfirmation = false;
  if (ctx.maxDoseU && ctx.maxDoseU > 0 && adjustedDose > ctx.maxDoseU) {
    requiresConfirmation = true;
    warnings.push(makeAlert('SAFETY_MAX_DOSE', 'warning', { dose: adjustedDose, max: ctx.maxDoseU }));
  }

  return {
    ...base, blocked: false, adjustedDose: round05(adjustedDose), adjustedCorrection: round05(correction),
    correctionBlocked, requiresConfirmation, risks, warnings,
  };
}

// ─── Fractionnement ───────────────────────────────────────────────────────────

export interface SplitResult {
  type: 'unique' | 'fractionne' | 'etendu';
  immediate: number;
  delayed: number;
  delayMinutes: number;
  phases?: SplitPhase[];
}

export const PHASE_LABELS = { fast: 'PHASE_FAST_CARBS', fat: 'PHASE_FAT', tail: 'PHASE_SLOW_TAIL' } as const;

/**
 * Gras élevé + glucides > 60 g → étendu 3 phases (50/30/20 sur 4 h) ;
 * gras moyen → 60 % + 40 % à +45 min ; gras élevé → 50/50 à +60 min ;
 * digestion lente seule → 70/30 à +60 min ; sinon unique.
 */
export function determineSplit(dose: number, fatLevel: FatLevel | string, slowDigestion: boolean, totalCarbs = 0): SplitResult {
  if (dose <= 0) return { type: 'unique', immediate: 0, delayed: 0, delayMinutes: 0 };

  if (fatLevel === 'élevé' && totalCarbs > 60) {
    const p1 = round05(dose * 0.5);
    const p2 = round05(dose * 0.3);
    const p3 = round05(dose - p1 - p2);
    return {
      type: 'etendu', immediate: p1, delayed: round05(p2 + p3), delayMinutes: 60,
      phases: [
        { pct: 50, units: p1, delayMinutes: 0, label: PHASE_LABELS.fast, checkGlycemia: false },
        { pct: 30, units: p2, delayMinutes: 60, label: PHASE_LABELS.fat, checkGlycemia: true },
        { pct: 20, units: p3, delayMinutes: 180, label: PHASE_LABELS.tail, checkGlycemia: true },
      ],
    };
  }
  if (fatLevel === 'moyen') {
    const immediate = round05(dose * 0.6);
    return { type: 'fractionne', immediate, delayed: round05(dose - immediate), delayMinutes: 45 };
  }
  if (fatLevel === 'élevé') {
    const immediate = round05(dose * 0.5);
    return { type: 'fractionne', immediate, delayed: round05(dose - immediate), delayMinutes: 60 };
  }
  if (slowDigestion) {
    const immediate = round05(dose * 0.7);
    return { type: 'fractionne', immediate, delayed: round05(dose - immediate), delayMinutes: 60 };
  }
  return { type: 'unique', immediate: dose, delayed: 0, delayMinutes: 0 };
}

// ─── Feedback post-prandial ───────────────────────────────────────────────────

export type PostPrandialVerdict = 'good' | 'under' | 'over';

export function evaluatePostPrandial(glycPre: number, glycPost: number | null | undefined, targetMin: number, targetPostMax: number): { verdict: PostPrandialVerdict; delta: number } | null {
  if (glycPost == null || glycPost <= 0) return null;
  const delta = roundTo(glycPost - glycPre, 2);
  if (glycPost >= targetMin && glycPost <= targetPostMax) return { verdict: 'good', delta };
  if (glycPost > targetPostMax) return { verdict: 'under', delta };
  return { verdict: 'over', delta };
}

// ─── Orchestrateur ────────────────────────────────────────────────────────────

export type TimingCode = 'TIMING_NONE' | 'TIMING_AT_START' | 'TIMING_BEFORE_10_15' | 'TIMING_BEFORE_20_30' | 'TIMING_BEFORE_30';
export type NextStepCode = 'NEXT_RESUGAR_15' | 'NEXT_WATCH_30' | 'NEXT_CONTACT_TEAM' | 'NEXT_CHECK_IN' | 'NEXT_BREAK_FAST';

export interface AnalyzeInputs extends Omit<SafetyContext, 'doseSuggeree' | 'correction' | 'correctionNette'> {
  totalCarbs: number;
  fatLevel: FatLevel | string;
  totalFatGrams?: number | null;
  activity: Activity | string;
  ratio: number;
  isfMgdl: number;
  targetMin: number;
  targetMax: number;
  slowDigestion?: boolean;
  insulinProfile?: { diaMin: number; peakMin: number } | null;
}

export interface Recommendation {
  analysis: {
    glycemiaStatus: GlucoseLevel;
    iob: number;
    trend: Trend;
    velocity: number | null;
    velocityClass: VelocityClass;
    totalCarbs: number;
    fatLevel: FatLevel | string;
    nightMode: boolean;
    hypoRisk: HypoRiskResult;
  };
  recommendation: {
    dose: number;
    timing: TimingCode;
    split: SplitResult;
    blocked: boolean;
    requiresConfirmation: boolean;
    reasoning: {
      bolusRepas: number;
      correction: number;
      correctionNette: number;
      correctionFinale: number;
      bonusGras: number;
      activityFactor: number;
      doseBrute: number;
    };
  };
  vigilance: { risks: SafetyAlert[]; warnings: SafetyAlert[]; infos: SafetyAlert[] };
  nextStep: { checkTime: number; instruction: NextStepCode };
  prediction: GlucosePrediction | null;
}

function computeCheckTime(status: GlucoseLevel, hasTimingWarning: boolean): number {
  if (status === 'hypo-severe' || status === 'hypo') return 15;
  if (status === 'hypo-proche') return 30;
  if (hasTimingWarning) return 60;
  return 120;
}

export function analyzeAndRecommend(inputs: AnalyzeInputs): Recommendation {
  const glycemiaStatus = classifyGlucose(inputs.glycemia, inputs.targetMin, inputs.targetMax);
  const doseResult = calculateDose({
    totalCarbs: inputs.totalCarbs, glycemia: inputs.glycemia, ratio: inputs.ratio, isfMgdl: inputs.isfMgdl,
    targetMax: inputs.targetMax, iobTotal: inputs.iobTotal, fatLevel: inputs.fatLevel, activity: inputs.activity,
    totalFatGrams: inputs.totalFatGrams,
  });

  const safety = applySafetyRules({
    ...inputs,
    doseSuggeree: doseResult.doseSuggeree,
    correction: doseResult.correction,
    correctionNette: doseResult.correctionNette,
    activityFactor: doseResult.activityFactor,
  });

  const { blocked, adjustedDose, risks, infos } = safety;
  const warnings = [...safety.warnings];
  const split = determineSplit(adjustedDose, inputs.fatLevel, Boolean(inputs.slowDigestion), inputs.totalCarbs);

  if (!blocked && split.type === 'unique' && adjustedDose > SINGLE_INJECTION_WARNING_THRESHOLD) {
    warnings.push(makeAlert('SAFETY_DOSE_ELEVEE', 'warning', { dose: adjustedDose, threshold: SINGLE_INJECTION_WARNING_THRESHOLD }));
  }

  let timing: TimingCode = 'TIMING_BEFORE_10_15';
  if (blocked) timing = 'TIMING_NONE';
  else if (glycemiaStatus === 'hypo-proche' || glycemiaStatus === 'sous-cible') timing = 'TIMING_AT_START';
  else if (safety.velocityClass === 'rising_fast' && inputs.velocity != null) timing = 'TIMING_BEFORE_30';
  else if (glycemiaStatus === 'elevee' || glycemiaStatus === 'haute' || glycemiaStatus === 'hyper-severe') timing = 'TIMING_BEFORE_20_30';

  const hasTimingWarning = warnings.some((w) => w.code === 'SAFETY_TIMING');
  const checkTime = computeCheckTime(glycemiaStatus, hasTimingWarning);
  let instruction: NextStepCode = 'NEXT_CHECK_IN';
  if (glycemiaStatus === 'hypo-severe' || glycemiaStatus === 'hypo') instruction = 'NEXT_RESUGAR_15';
  else if (risks.some((r) => r.code === 'SAFETY_FASTING_BREAK')) instruction = 'NEXT_BREAK_FAST';
  else if (glycemiaStatus === 'hypo-proche') instruction = 'NEXT_WATCH_30';
  else if (blocked) instruction = 'NEXT_CONTACT_TEAM';

  const prediction = blocked
    ? null
    : predictGlucose({
        glycemia: inputs.glycemia, velocity: inputs.velocity ?? null, totalCarbs: inputs.totalCarbs,
        dose: adjustedDose, ratio: inputs.ratio, isfMgdl: inputs.isfMgdl, iobTotal: inputs.iobTotal,
        fatLevel: inputs.fatLevel, profile: inputs.insulinProfile ?? null,
      });

  const trend: Trend = inputs.velocity != null ? velocityClassToTrend(safety.velocityClass) : ((inputs.trend as Trend) ?? '?');

  return {
    analysis: {
      glycemiaStatus, iob: inputs.iobTotal, trend, velocity: inputs.velocity ?? null, velocityClass: safety.velocityClass,
      totalCarbs: inputs.totalCarbs, fatLevel: inputs.fatLevel, nightMode: safety.nightMode, hypoRisk: safety.hypoRisk,
    },
    recommendation: {
      dose: adjustedDose, timing, split, blocked, requiresConfirmation: safety.requiresConfirmation,
      reasoning: {
        bolusRepas: doseResult.bolusRepas, correction: doseResult.correction, correctionNette: doseResult.correctionNette,
        correctionFinale: safety.adjustedCorrection, bonusGras: doseResult.bonusGras, activityFactor: doseResult.activityFactor,
        doseBrute: doseResult.doseSuggeree,
      },
    },
    vigilance: { risks, warnings, infos },
    nextStep: { checkTime, instruction },
    prediction,
  };
}
