/**
 * Gestion du temps en heure LOCALE (jamais UTC pour les clés de journée).
 */

export type DayPeriod = 'matin' | 'midi' | 'soir' | 'nuit';

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Clé de journée locale 'YYYY-MM-DD'. */
export function localDateKey(d: Date | string | number = new Date()): string {
  const date = toDate(d);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Minuit local de la clé donnée. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function addDays(key: string, delta: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + delta);
  return localDateKey(d);
}

/** ISO 8601 avec décalage local, ex. 2026-10-11T23:30:00+01:00. */
export function toLocalISO(d: Date | string | number = new Date()): string {
  const date = toDate(d);
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${localDateKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function minutesBetween(from: Date | string | number, to: Date | string | number): number {
  return (toDate(to).getTime() - toDate(from).getTime()) / 60000;
}

export function hourOf(d: Date | string | number): number {
  return toDate(d).getHours();
}

/** 'HH:MM' local. */
export function timeKey(d: Date | string | number = new Date()): string {
  const date = toDate(d);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Combine une date (jour) et une heure 'HH:MM' en Date locale. */
export function combineDateAndTime(base: Date | string | number, hhmm: string | null | undefined): Date {
  const d = new Date(toDate(base).getTime());
  if (!hhmm) return d;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isInteger(h) && Number.isInteger(m)) d.setHours(h as number, m as number, 0, 0);
  return d;
}

/** Créneaux cohérents avec les profils horaires : matin 6-11, midi 11-16, soir 16-22, nuit sinon. */
export function periodOfDay(hour: number): DayPeriod {
  if (hour >= 6 && hour < 11) return 'matin';
  if (hour >= 11 && hour < 16) return 'midi';
  if (hour >= 16 && hour < 22) return 'soir';
  return 'nuit';
}

/** Fenêtre nocturne [start, end) qui peut passer minuit (21 → 6). */
export function isNightHour(hour: number, start = 21, end = 6): boolean {
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

export type AppLocale = 'fr' | 'ar';

/** Balise BCP 47 avec chiffres latins (usage marocain). */
export function localeTag(locale: string): string {
  return locale === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-FR';
}

export function formatTime(d: Date | string | number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(localeTag(locale), { hour: '2-digit', minute: '2-digit', hour12: false }).format(toDate(d));
  } catch {
    return timeKey(d);
  }
}

export function formatDate(
  d: Date | string | number,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  try {
    return new Intl.DateTimeFormat(localeTag(locale), options).format(toDate(d));
  } catch {
    return localDateKey(d);
  }
}

export function formatDateTime(d: Date | string | number, locale: string): string {
  return formatDate(d, locale, { dateStyle: 'short', timeStyle: 'short' });
}
