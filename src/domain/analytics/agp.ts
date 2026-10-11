/**
 * Profil glycémique ambulatoire (AGP) selon le consensus international
 * (Bergenstal et al. 2013 ; Battelino et al. 2019, « Time in Range »).
 *
 * Principe : toutes les lectures de la période sont « repliées » sur une journée
 * type de 24 h découpée en tranches (60 min par défaut, 30 min possible). Pour
 * chaque tranche on calcule la médiane et les bandes de percentiles 5-95,
 * 10-90 et 25-75, qui forment les courbes de l'AGP.
 *
 * Conventions :
 * - glycémies en g/L (1.20 g/L = 120 mg/dL), sorties arrondies à 2 décimales ;
 * - heure LOCALE partout (getHours / getMinutes / localDateKey) ;
 * - module pur : pas de React, pas de DOM, aucun texte d'interface (l'UI traduit).
 */
import type { GlucoseReading } from '../types';
import { clamp, mean, percentile, roundTo } from '../units';
import { localDateKey, parseDateKey, toDate } from '../time';

/** Percentiles du consensus AGP, dans l'ordre croissant. */
export const AGP_PERCENTILES = [5, 10, 25, 50, 75, 90, 95] as const;

export type AGPPercentileKey = 'p5' | 'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'p95';

/** Clés des séries de percentiles d'un bucket, dans l'ordre croissant. */
export const AGP_PERCENTILE_KEYS: readonly AGPPercentileKey[] = ['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'];

export const DEFAULT_BUCKET_MINUTES = 60;

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AGPBucket {
  /**
   * Heure locale de début de la tranche, en heures décimales :
   * 0, 1, … 23 pour des tranches de 60 min ; 0, 0.5, 1, … 23.5 pour 30 min.
   */
  hour: number;
  /** Nombre de lectures tombées dans la tranche. */
  n: number;
  /**
   * Percentiles (g/L), null si n = 0. Avec n = 1, tous les percentiles valent
   * la lecture unique (aucune dispersion observable).
   */
  p5: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
}

export interface AGPProfile {
  /** Une entrée par tranche à partir de 00:00 ; longueur = 24 * 60 / bucketMinutes. */
  buckets: AGPBucket[];
  bucketMinutes: number;
  /** Lectures effectivement utilisées (valides et dans la fenêtre). */
  readingsCount: number;
  /** Journées locales distinctes comportant au moins une lecture. */
  daysWithData: number;
  /**
   * Taille de la fenêtre d'analyse en jours : `opts.days` si fourni, sinon le
   * nombre de journées calendaires couvertes par les données (min 1), 0 sans donnée.
   */
  daysInWindow: number;
  /**
   * Bornes de la fenêtre d'analyse : [now - days, now] si `opts.days` est fourni,
   * sinon la première et la dernière lecture utilisées (null sans donnée).
   */
  from: Date | null;
  to: Date | null;
  /** daysWithData / daysInWindow, borné à [0, 1]. */
  coverage: number;
}

export interface AGPOptions {
  /** Largeur des tranches en minutes ; doit diviser 1440 (60 par défaut, 30 pris en charge). */
  bucketMinutes?: number;
  /** Si fourni, seules les lectures dans [now - days, now] sont utilisées. */
  days?: number;
  /** Référence temporelle de la fenêtre (défaut : maintenant). */
  now?: Date;
}

export interface AGPSummary {
  /** Moyenne des médianes (p50) des tranches renseignées, g/L. */
  medianMean: number | null;
  /** Moyenne de l'écart interquartile (p75 - p25) des tranches renseignées, g/L. */
  iqrMean: number | null;
  /** `hour` de la tranche dont l'écart p90 - p10 est le plus large (première en cas d'égalité). */
  widestHour: number | null;
}

/** Normalise la largeur des tranches : entier positif diviseur de 1440, sinon 60. */
export function normalizeBucketMinutes(value: number | undefined): number {
  if (value == null || !Number.isInteger(value) || value <= 0 || MINUTES_PER_DAY % value !== 0) {
    return DEFAULT_BUCKET_MINUTES;
  }
  return value;
}

function roundOrNull(v: number | null): number | null {
  return v == null ? null : roundTo(v, 2);
}

function makeBucket(hour: number, values: number[]): AGPBucket {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number): number | null => roundOrNull(percentile(sorted, p));
  return {
    hour,
    n: sorted.length,
    p5: q(5),
    p10: q(10),
    p25: q(25),
    p50: q(50),
    p75: q(75),
    p90: q(90),
    p95: q(95),
  };
}

/** Nombre de journées calendaires locales couvertes par [minT, maxT], min 1 (robuste aux changements d'heure). */
function spanDays(minT: number, maxT: number): number {
  const first = parseDateKey(localDateKey(minT)).getTime();
  const last = parseDateKey(localDateKey(maxT)).getTime();
  return Math.max(1, Math.round((last - first) / MS_PER_DAY) + 1);
}

/**
 * Calcule le profil AGP d'un ensemble de lectures.
 * Les lectures non finies, ≤ 0 ou à date invalide sont ignorées.
 * Les percentiles utilisent l'interpolation linéaire (`percentile` de units.ts).
 */
export function computeAGP(readings: GlucoseReading[], opts: AGPOptions = {}): AGPProfile {
  const bucketMinutes = normalizeBucketMinutes(opts.bucketMinutes);
  const bucketCount = MINUTES_PER_DAY / bucketMinutes;
  const days = opts.days != null && Number.isFinite(opts.days) && opts.days > 0 ? opts.days : null;
  const now = opts.now ?? new Date();
  const windowEnd = now.getTime();
  const windowStart = days != null ? windowEnd - days * MS_PER_DAY : null;

  const perBucket: number[][] = Array.from({ length: bucketCount }, () => []);
  const dayKeys = new Set<string>();
  let readingsCount = 0;
  let minT = Number.POSITIVE_INFINITY;
  let maxT = Number.NEGATIVE_INFINITY;

  for (const r of readings) {
    if (!Number.isFinite(r.value) || r.value <= 0) continue;
    const at = toDate(r.at);
    const t = at.getTime();
    if (!Number.isFinite(t)) continue;
    if (windowStart != null && (t < windowStart || t > windowEnd)) continue;

    const idx = Math.floor((at.getHours() * 60 + at.getMinutes()) / bucketMinutes);
    perBucket[idx]?.push(r.value);
    dayKeys.add(localDateKey(at));
    readingsCount += 1;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }

  const buckets = perBucket.map((values, i) => makeBucket((i * bucketMinutes) / 60, values));
  const hasData = readingsCount > 0;
  const daysWithData = dayKeys.size;
  const daysInWindow = days != null ? days : hasData ? spanDays(minT, maxT) : 0;
  const coverage = daysInWindow > 0 ? clamp(daysWithData / daysInWindow, 0, 1) : 0;

  let from: Date | null = null;
  let to: Date | null = null;
  if (windowStart != null) {
    from = new Date(windowStart);
    to = new Date(windowEnd);
  } else if (hasData) {
    from = new Date(minT);
    to = new Date(maxT);
  }

  return { buckets, bucketMinutes, readingsCount, daysWithData, daysInWindow, from, to, coverage };
}

/**
 * Lissage par moyenne mobile circulaire (23 h voisine de 0 h) de chaque série de
 * percentiles, comme sur l'AGP du consensus qui est tracé lissé.
 * - `window` est la largeur de la fenêtre ; une valeur paire est élargie à
 *   l'impair supérieur (fenêtre symétrique de 2·⌊window/2⌋ + 1 tranches) ;
 *   window ≤ 1 renvoie une copie non lissée.
 * - Les voisins sans donnée (n = 0) sont ignorés dans la moyenne ; une tranche
 *   sans donnée reste à null (on n'invente pas de valeurs).
 * - `n` et `hour` sont conservés. Comme chaque série est moyennée sur le même
 *   ensemble d'indices, l'ordre p5 ≤ p10 ≤ … ≤ p95 est préservé.
 */
export function smoothProfile(profile: AGPProfile, window = 3): AGPProfile {
  const source = profile.buckets;
  const len = source.length;
  const half = Math.floor(Math.max(1, window) / 2);
  if (half === 0 || len === 0) {
    return { ...profile, buckets: source.map((b) => ({ ...b })) };
  }

  const buckets = source.map((bucket, i) => {
    if (bucket.n === 0) return { ...bucket };
    const out: AGPBucket = { ...bucket };
    for (const key of AGP_PERCENTILE_KEYS) {
      const acc: number[] = [];
      for (let k = -half; k <= half; k++) {
        const neighbour = source[(((i + k) % len) + len) % len];
        const v = neighbour?.[key];
        if (v != null) acc.push(v);
      }
      out[key] = roundOrNull(mean(acc));
    }
    return out;
  });

  return { ...profile, buckets };
}

/** Indicateurs synthétiques d'un profil : médiane moyenne, IQR moyen, tranche la plus dispersée. */
export function agpSummary(profile: AGPProfile): AGPSummary {
  const medians: number[] = [];
  const iqrs: number[] = [];
  let widestHour: number | null = null;
  let widestSpread = Number.NEGATIVE_INFINITY;

  for (const b of profile.buckets) {
    if (b.n === 0) continue;
    if (b.p50 != null) medians.push(b.p50);
    if (b.p75 != null && b.p25 != null) iqrs.push(b.p75 - b.p25);
    if (b.p90 != null && b.p10 != null) {
      const spread = b.p90 - b.p10;
      if (spread > widestSpread) {
        widestSpread = spread;
        widestHour = b.hour;
      }
    }
  }

  return {
    medianMean: roundOrNull(mean(medians)),
    iqrMean: roundOrNull(mean(iqrs)),
    widestHour,
  };
}
