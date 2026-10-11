import type { GlucoseReading, Trend } from '../types';
import { roundTo } from '../units';

export type VelocityClass = 'falling_fast' | 'falling' | 'stable' | 'rising' | 'rising_fast' | 'unknown';

export const VELOCITY_ARROW: Record<VelocityClass, string> = {
  falling_fast: '↓↓',
  falling: '↓',
  stable: '→',
  rising: '↑',
  rising_fast: '↑↑',
  unknown: '?',
};

/** Vitesse de variation en g/L/h ; null si l'intervalle est inutilisable (< 5 min ou > maxIntervalMinutes). */
export function calcVelocity(currentG: number, previousG: number | null | undefined, intervalMinutes: number | null | undefined, maxIntervalMinutes = 180): number | null {
  if (previousG == null || !intervalMinutes || intervalMinutes < 5 || intervalMinutes > maxIntervalMinutes) return null;
  return roundTo((currentG - previousG) / (intervalMinutes / 60), 2);
}

export function classifyVelocity(velocity: number | null | undefined): VelocityClass {
  if (velocity == null || !Number.isFinite(velocity)) return 'unknown';
  if (velocity < -0.40) return 'falling_fast';
  if (velocity < -0.15) return 'falling';
  if (velocity <= 0.15) return 'stable';
  if (velocity <= 0.40) return 'rising';
  return 'rising_fast';
}

/** Tendance saisie à la main → classe (prudente : ↓ et ↘ sont traitées comme « baisse »). */
export function trendToVelocityClass(trend: Trend | string | null | undefined): VelocityClass {
  switch (trend) {
    case '↑': return 'rising_fast';
    case '↗': return 'rising';
    case '→': return 'stable';
    case '↘': return 'falling';
    case '↓': return 'falling_fast';
    default: return 'unknown';
  }
}

export function velocityClassToTrend(cls: VelocityClass): Trend {
  switch (cls) {
    case 'rising_fast': return '↑';
    case 'rising': return '↗';
    case 'stable': return '→';
    case 'falling': return '↘';
    case 'falling_fast': return '↓';
    default: return '?';
  }
}

export interface VelocityEstimate {
  velocity: number | null;
  cls: VelocityClass;
  previous: GlucoseReading | null;
  intervalMinutes: number | null;
}

/** Estime la vitesse à partir de la dernière lecture précédant `at` (fenêtre maxIntervalMinutes). */
export function velocityFromReadings(readings: GlucoseReading[], current: { value: number; at: Date }, maxIntervalMinutes = 180): VelocityEstimate {
  let previous: GlucoseReading | null = null;
  for (const r of readings) {
    if (r.at.getTime() < current.at.getTime() - 60000 && (!previous || r.at.getTime() > previous.at.getTime())) previous = r;
  }
  if (!previous) return { velocity: null, cls: 'unknown', previous: null, intervalMinutes: null };
  const interval = (current.at.getTime() - previous.at.getTime()) / 60000;
  const velocity = calcVelocity(current.value, previous.value, interval, maxIntervalMinutes);
  return { velocity, cls: classifyVelocity(velocity), previous, intervalMinutes: Math.round(interval) };
}
