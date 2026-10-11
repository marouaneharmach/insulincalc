import type { JournalEntry } from '../types';
import { entryKind, getActualDose, getCarbs, getGlucosePost, getGlucosePre } from '../journal';
import { localDateKey } from '../time';
import { mean, roundTo } from '../units';

export interface DailySummary {
  totalDose: number;
  totalCarbs: number;
  injections: number;
  basalDose: number;
  corrections: number;
  mealBolus: number;
  glycReadings: number;
  avgGlycemia: number | null;
  timeInRange: number | null;
  minGlyc: number | null;
  maxGlyc: number | null;
  hypoCount: number;
}

/** Résumé d'une journée LOCALE (clé 'YYYY-MM-DD'). */
export function computeDailySummary(journal: JournalEntry[], dateKey: string, targetMin: number, targetMax: number): DailySummary {
  const dayEntries = journal.filter((e) => e.date && localDateKey(e.date) === dateKey);
  let totalDose = 0;
  let totalCarbs = 0;
  let injections = 0;
  let basalDose = 0;
  let corrections = 0;
  let mealBolus = 0;
  const readings: number[] = [];

  for (const e of dayEntries) {
    const kind = entryKind(e);
    const dose = getActualDose(e);
    if (dose > 0) {
      if (kind === 'basal') basalDose += dose;
      else {
        totalDose += dose;
        injections += 1;
        if (kind === 'meal') mealBolus += dose;
        else corrections += dose;
      }
    }
    totalCarbs += getCarbs(e);
    const pre = getGlucosePre(e);
    const post = getGlucosePost(e);
    if (pre != null) readings.push(pre);
    if (post != null) readings.push(post);
  }

  const inRange = readings.filter((g) => g >= targetMin && g <= targetMax).length;
  const avg = mean(readings);
  return {
    totalDose: roundTo(totalDose, 1),
    totalCarbs: Math.round(totalCarbs),
    injections,
    basalDose: roundTo(basalDose, 1),
    corrections: roundTo(corrections, 1),
    mealBolus: roundTo(mealBolus, 1),
    glycReadings: readings.length,
    avgGlycemia: avg != null ? roundTo(avg, 2) : null,
    timeInRange: readings.length > 0 ? Math.round((inRange / readings.length) * 100) : null,
    minGlyc: readings.length > 0 ? Math.min(...readings) : null,
    maxGlyc: readings.length > 0 ? Math.max(...readings) : null,
    hypoCount: readings.filter((g) => g < 0.7).length,
  };
}
