/**
 * Métriques glycémiques du consensus international Time in Range (Battelino 2019)
 * et GMI (Bergenstal 2018). Valeurs en g/L.
 */
import type { GlucoseReading } from '../types';
import { mean, roundTo, stdDev } from '../units';
import { localDateKey } from '../time';

export const CONSENSUS = {
  tirMin: 0.70,
  tirMax: 1.80,
  level1Low: 0.70,
  level2Low: 0.54,
  level1High: 1.80,
  level2High: 2.50,
  goals: { tir: 70, tbr: 4, tbr2: 1, tar: 25, tar2: 5, cv: 36 },
} as const;

export interface GlycemicMetrics {
  n: number;
  daysWithData: number;
  meanGl: number | null;
  sdGl: number | null;
  cvPct: number | null;
  /** Glucose Management Indicator (%). Indicatif : validé pour un CGM ≥ 14 j, pas pour des glycémies capillaires. */
  gmiPct: number | null;
  gmiReliable: boolean;
  tirPct: number | null;
  tbrPct: number | null;
  tbr2Pct: number | null;
  tarPct: number | null;
  tar2Pct: number | null;
  minGl: number | null;
  maxGl: number | null;
  hypoCount: number;
  severeHypoCount: number;
  hyperCount: number;
  goalsMet: { tir: boolean; tbr: boolean; tbr2: boolean; tar: boolean; tar2: boolean; cv: boolean } | null;
}

export interface MetricsOptions {
  /** Bornes de la plage « en cible » ; consensus 0.70-1.80 par défaut. */
  rangeMin?: number;
  rangeMax?: number;
  /** Nombre minimal de lectures pour calculer le GMI (défaut 30). */
  minReadingsForGmi?: number;
}

export function gmiFromMeanGl(meanGl: number): number {
  return 3.31 + 0.02392 * meanGl * 100;
}

export function computeGlycemicMetrics(readings: GlucoseReading[], opts: MetricsOptions = {}): GlycemicMetrics {
  const rangeMin = opts.rangeMin ?? CONSENSUS.tirMin;
  const rangeMax = opts.rangeMax ?? CONSENSUS.tirMax;
  const minForGmi = opts.minReadingsForGmi ?? 30;
  const values = readings.map((r) => r.value).filter((v) => Number.isFinite(v) && v > 0);
  const n = values.length;
  const days = new Set(readings.map((r) => localDateKey(r.at))).size;

  if (n === 0) {
    return {
      n: 0, daysWithData: days, meanGl: null, sdGl: null, cvPct: null, gmiPct: null, gmiReliable: false,
      tirPct: null, tbrPct: null, tbr2Pct: null, tarPct: null, tar2Pct: null, minGl: null, maxGl: null,
      hypoCount: 0, severeHypoCount: 0, hyperCount: 0, goalsMet: null,
    };
  }

  const m = mean(values) as number;
  const sd = stdDev(values);
  const cv = sd != null && m > 0 ? (sd / m) * 100 : null;
  const pct = (count: number) => roundTo((count / n) * 100, 1);
  const inRange = values.filter((v) => v >= rangeMin && v <= rangeMax).length;
  const tbr = values.filter((v) => v < CONSENSUS.level1Low).length;
  const tbr2 = values.filter((v) => v < CONSENSUS.level2Low).length;
  const tar = values.filter((v) => v > rangeMax).length;
  const tar2 = values.filter((v) => v > CONSENSUS.level2High).length;
  const cgmShare = readings.filter((r) => r.kind === 'cgm').length / n;
  const gmiReliable = n >= minForGmi && days >= 14 && cgmShare >= 0.7;

  const metrics: GlycemicMetrics = {
    n,
    daysWithData: days,
    meanGl: roundTo(m, 2),
    sdGl: sd != null ? roundTo(sd, 2) : null,
    cvPct: cv != null ? roundTo(cv, 1) : null,
    gmiPct: n >= minForGmi ? roundTo(gmiFromMeanGl(m), 1) : null,
    gmiReliable,
    tirPct: pct(inRange),
    tbrPct: pct(tbr),
    tbr2Pct: pct(tbr2),
    tarPct: pct(tar),
    tar2Pct: pct(tar2),
    minGl: Math.min(...values),
    maxGl: Math.max(...values),
    hypoCount: tbr,
    severeHypoCount: tbr2,
    hyperCount: tar2,
    goalsMet: null,
  };
  metrics.goalsMet = {
    tir: (metrics.tirPct ?? 0) >= CONSENSUS.goals.tir,
    tbr: (metrics.tbrPct ?? 100) < CONSENSUS.goals.tbr,
    tbr2: (metrics.tbr2Pct ?? 100) < CONSENSUS.goals.tbr2,
    tar: (metrics.tarPct ?? 100) < CONSENSUS.goals.tar,
    tar2: (metrics.tar2Pct ?? 100) < CONSENSUS.goals.tar2,
    cv: metrics.cvPct != null ? metrics.cvPct <= CONSENSUS.goals.cv : false,
  };
  return metrics;
}

/** Classification clinique d'une valeur isolée (niveaux ADA). */
export type GlucoseLevel = 'hypo-severe' | 'hypo' | 'hypo-proche' | 'sous-cible' | 'cible' | 'elevee' | 'haute' | 'hyper-severe';

export function classifyGlucose(gl: number, targetMin: number, targetMax: number): GlucoseLevel {
  if (gl < CONSENSUS.level2Low) return 'hypo-severe';
  if (gl < CONSENSUS.level1Low) return 'hypo';
  if (gl < 0.90) return 'hypo-proche';
  if (gl < targetMin) return 'sous-cible';
  if (gl <= targetMax) return 'cible';
  if (gl <= CONSENSUS.level1High) return 'elevee';
  if (gl <= CONSENSUS.level2High) return 'haute';
  return 'hyper-severe';
}
