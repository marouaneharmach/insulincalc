import type { GlucoseReading, JournalEntry } from './types';
import { toNumber } from './units';
import { toDate } from './time';

export function getGlucosePre(e: JournalEntry): number | null {
  const v = toNumber(e.glycPre ?? e.preMealGlycemia);
  return v != null && v > 0 ? v : null;
}

export function getGlucosePost(e: JournalEntry): number | null {
  const v = toNumber(e.glycPost ?? e.postMealGlycemia);
  return v != null && v > 0 ? v : null;
}

export function getSuggestedDose(e: JournalEntry): number {
  return toNumber(e.doseSuggeree ?? e.doseSuggested ?? e.doseCalculated) ?? 0;
}

/** Dose réellement prise ; retombe sur la dose suggérée si aucune dose réelle > 0 n'est connue. */
export function getActualDose(e: JournalEntry): number {
  const actual = toNumber(e.doseActual ?? e.doseReelle ?? e.doseInjected) ?? 0;
  return actual > 0 ? actual : getSuggestedDose(e);
}

export function getCarbs(e: JournalEntry): number {
  return toNumber(e.totalGlucides ?? e.totalCarbs) ?? 0;
}

export function entryDate(e: JournalEntry): Date {
  return toDate(e.date);
}

export type EntryKind = 'meal' | 'glucose' | 'injection' | 'basal' | 'hypo' | 'cgm';

export function entryKind(e: JournalEntry): EntryKind {
  if (e.mealType === 'hypo') return 'hypo';
  if (e.mealType === 'basal' || e.injectionType === 'basal') return 'basal';
  if (e.source === 'cgm') return 'cgm';
  if (e.mealType === 'mesure') return 'glucose';
  if (e.mealType === 'injection') return 'injection';
  if (getCarbs(e) > 0) return 'meal';
  if (getActualDose(e) > 0) return 'injection';
  return 'glucose';
}

export function isBolusInjection(e: JournalEntry): boolean {
  const kind = entryKind(e);
  return (kind === 'meal' || kind === 'injection') && getActualDose(e) > 0;
}

export function isCorrectionOnly(e: JournalEntry): boolean {
  return entryKind(e) === 'injection' && e.injectionType === 'correction' && getActualDose(e) > 0;
}

/** Moment de la glycémie post-repas : horodatage explicite, sinon +2 h. */
export function postReadingTime(e: JournalEntry): Date {
  if (e.glycPostAt) return toDate(e.glycPostAt);
  return new Date(entryDate(e).getTime() + 120 * 60000);
}

/** Toutes les lectures glycémiques du journal, triées par temps croissant. */
export function readingsFromJournal(entries: JournalEntry[], opts: { days?: number; now?: Date } = {}): GlucoseReading[] {
  const now = opts.now ?? new Date();
  const cutoff = opts.days ? now.getTime() - opts.days * 86400000 : -Infinity;
  const out: GlucoseReading[] = [];
  for (const e of entries) {
    if (!e.date) continue;
    const at = entryDate(e);
    if (Number.isNaN(at.getTime()) || at.getTime() < cutoff || at.getTime() > now.getTime() + 60000) continue;
    const kind = entryKind(e);
    const pre = getGlucosePre(e);
    if (pre != null) {
      out.push({ value: pre, at, kind: kind === 'cgm' ? 'cgm' : kind === 'meal' ? 'pre' : 'spot', entryId: e.id });
    }
    const post = getGlucosePost(e);
    if (post != null) {
      const postAt = postReadingTime(e);
      if (postAt.getTime() <= now.getTime() + 60000) out.push({ value: post, at: postAt, kind: 'post', entryId: e.id });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Injections de bolus (repas + corrections) des `windowMinutes` dernières minutes. */
export function recentInjections(entries: JournalEntry[], now: Date, windowMinutes: number): Array<{ dose: number; minutesAgo: number; entry: JournalEntry }> {
  const out: Array<{ dose: number; minutesAgo: number; entry: JournalEntry }> = [];
  for (const e of entries) {
    if (!isBolusInjection(e)) continue;
    const minutesAgo = (now.getTime() - entryDate(e).getTime()) / 60000;
    if (minutesAgo < 0 || minutesAgo >= windowMinutes) continue;
    out.push({ dose: getActualDose(e), minutesAgo, entry: e });
  }
  return out.sort((a, b) => a.minutesAgo - b.minutesAgo);
}
