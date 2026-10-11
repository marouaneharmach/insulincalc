import type { JournalEntry } from '../types';
import { recentInjections } from '../journal';
import type { InsulinProfile } from './profiles';
import { DEFAULT_RAPID_PROFILE } from './profiles';

/**
 * Modèle de Walsh : courbe d'activité triangulaire culminant à `peak` minutes
 * et nulle à `dia` minutes. L'IOB(T) est l'intégrale de l'activité restante,
 * calculée en forme fermée.
 */
export function calcIOB(dose: number, minutesElapsed: number, dia = 270, peak = 75): number {
  if (dose <= 0) return 0;
  if (minutesElapsed <= 0) return dose;
  if (minutesElapsed >= dia) return 0;
  const T = minutesElapsed;
  const p = Math.min(Math.max(peak, 1), dia - 1);
  let iobFraction: number;
  if (T <= p) {
    iobFraction = 1 - (T * T) / (p * dia);
  } else {
    iobFraction = ((dia - T) * (dia - T)) / (dia * (dia - p));
  }
  return dose * Math.max(0, Math.min(1, iobFraction));
}

/** Activité instantanée (U/min) au temps T, utile pour la prédiction. */
export function insulinActivity(dose: number, minutesElapsed: number, dia = 270, peak = 75): number {
  if (dose <= 0 || minutesElapsed < 0 || minutesElapsed >= dia) return 0;
  const h = (2 * dose) / dia;
  const p = Math.min(Math.max(peak, 1), dia - 1);
  return minutesElapsed <= p ? (h * minutesElapsed) / p : (h * (dia - minutesElapsed)) / (dia - p);
}

export interface InjectionPoint { dose: number; minutesAgo: number }

export function calcTotalIOB(injections: InjectionPoint[], dia = 270, peak = 75): number {
  return injections.reduce((sum, inj) => sum + calcIOB(inj.dose, inj.minutesAgo, dia, peak), 0);
}

/** IOB totale « maintenant » à partir du journal, selon le profil d'insuline rapide. */
export function iobFromJournal(entries: JournalEntry[], now: Date, profile: InsulinProfile = DEFAULT_RAPID_PROFILE): number {
  const injections = recentInjections(entries, now, profile.diaMin);
  return calcTotalIOB(injections, profile.diaMin, profile.peakMin);
}

/** IOB restante à `minutesAhead` minutes, en supposant aucune nouvelle injection. */
export function iobAt(entries: JournalEntry[], now: Date, minutesAhead: number, profile: InsulinProfile = DEFAULT_RAPID_PROFILE): number {
  const injections = recentInjections(entries, now, profile.diaMin).map((i) => ({ dose: i.dose, minutesAgo: i.minutesAgo + minutesAhead }));
  return calcTotalIOB(injections, profile.diaMin, profile.peakMin);
}

/** Minutes écoulées depuis la dernière injection de bolus, null si aucune dans la fenêtre. */
export function minutesSinceLastBolus(entries: JournalEntry[], now: Date, windowMinutes = 1440): number | null {
  const recent = recentInjections(entries, now, windowMinutes);
  return recent.length > 0 ? (recent[0] as { minutesAgo: number }).minutesAgo : null;
}
