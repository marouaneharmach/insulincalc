/**
 * Unités et arrondis du domaine clinique.
 * Convention : toutes les glycémies internes sont en g/L (1.20 = 120 mg/dL).
 */

/** Arrondi au demi (précision des stylos à insuline). */
export const round05 = (v: number): number => Math.round(v * 2) / 2;

/** Arrondi à `digits` décimales. */
export function roundTo(v: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export const mgdlToGl = (mgdl: number): number => Math.round(mgdl) / 100;
export const glToMgdl = (gl: number): number => Math.round(gl * 100);

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Convertit une valeur quelconque (nombre, chaîne avec virgule...) en nombre fini, sinon null. */
export function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Nombre ou 0. */
export const num = (value: unknown): number => toNumber(value) ?? 0;

/**
 * Normalise une glycémie saisie : une valeur ≥ 30 est interprétée en mg/dL.
 * 102 → 1.02 ; 1.35 → 1.35 ; '' → null.
 */
export function normalizeGlucose(input: unknown): number | null {
  const v = toNumber(input);
  if (v == null || v <= 0) return null;
  return v >= 30 ? mgdlToGl(v) : roundTo(v, 2);
}

/** Moyenne arithmétique, null si vide. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Écart-type (population), null si < 2 valeurs. */
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values) as number;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
}

/** Percentile par interpolation linéaire (p entre 0 et 100) sur un tableau trié. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0] ?? null;
  const rank = (clamp(p, 0, 100) / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (rank - lo);
}
