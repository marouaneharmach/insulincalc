import { periodOfDay, type DayPeriod } from './time';

export interface TimeProfile { id: DayPeriod | string; label?: string; hours?: string; ratio?: number | null; isf?: number | null }

export const DEFAULT_TIME_PROFILES: TimeProfile[] = [
  { id: 'matin', label: '🌅 Matin', hours: '6h-11h', ratio: null, isf: null },
  { id: 'midi', label: '☀️ Midi', hours: '11h-16h', ratio: null, isf: null },
  { id: 'soir', label: '🌙 Soir', hours: '16h-22h', ratio: null, isf: null },
  { id: 'nuit', label: '🌑 Nuit', hours: '22h-6h', ratio: null, isf: null },
];

/** Ratio/ISF actifs selon l'heure (profil horaire sinon valeurs globales). */
export function getActiveProfile(
  timeProfiles: TimeProfile[] | null | undefined,
  globalRatio: number,
  globalIsf: number,
  hourOverride?: number,
): { ratio: number; isf: number; slot: DayPeriod | null; label: string } {
  if (!timeProfiles || timeProfiles.every((p) => !p.ratio && !p.isf)) {
    return { ratio: globalRatio, isf: globalIsf, slot: null, label: '' };
  }
  const h = Number.isInteger(hourOverride) && (hourOverride as number) >= 0 && (hourOverride as number) <= 23
    ? (hourOverride as number)
    : new Date().getHours();
  const slotId = periodOfDay(h);
  const profile = timeProfiles.find((p) => p.id === slotId);
  return {
    ratio: profile?.ratio || globalRatio,
    isf: profile?.isf || globalIsf,
    slot: slotId,
    label: profile?.label || '',
  };
}
