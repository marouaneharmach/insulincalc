import { describe, it, expect } from 'vitest';
import { round05, roundTo, mgdlToGl, glToMgdl, clamp, toNumber, num, normalizeGlucose, mean, stdDev, percentile } from '../units';
import { localDateKey, parseDateKey, addDays, toLocalISO, minutesBetween, timeKey, combineDateAndTime, periodOfDay, isNightHour, localeTag, formatTime, formatDate, formatDateTime } from '../time';
import { newId } from '../ids';
import { getGlucosePre, getGlucosePost, getSuggestedDose, getActualDose, getCarbs, entryKind, isBolusInjection, isCorrectionOnly, postReadingTime, readingsFromJournal, recentInjections } from '../journal';
import { calcIMC, calcBSA, calcBMR, imcCategory, estimateTDD } from '../anthropometry';
import { getActiveProfile, DEFAULT_TIME_PROFILES } from '../timeProfiles';
import { assessRamadanRisk, buildFastingPlan, shouldBreakFast } from '../ramadan';
import { computeDailySummary } from '../analytics/daily';
import { computeGlycemicMetrics, classifyGlucose, gmiFromMeanGl, CONSENSUS } from '../analytics/metrics';

describe('units', () => {
  it('arrondis et conversions', () => {
    expect(round05(3.24)).toBe(3);
    expect(round05(3.25)).toBe(3.5);
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(mgdlToGl(102)).toBe(1.02);
    expect(glToMgdl(1.35)).toBe(135);
    expect(clamp(5, 0, 3)).toBe(3);
  });
  it('toNumber tolère virgules et chaînes vides', () => {
    expect(toNumber('1,35')).toBe(1.35);
    expect(toNumber('')).toBeNull();
    expect(toNumber('abc')).toBeNull();
    expect(num(undefined)).toBe(0);
  });
  it('normalizeGlucose : mg/dL si ≥ 30', () => {
    expect(normalizeGlucose(135)).toBe(1.35);
    expect(normalizeGlucose('1.2')).toBe(1.2);
    expect(normalizeGlucose(0)).toBeNull();
  });
  it('statistiques', () => {
    expect(mean([])).toBeNull();
    expect(mean([1, 2, 3])).toBe(2);
    expect(stdDev([2, 2, 2])).toBe(0);
    expect(stdDev([1])).toBeNull();
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([], 50)).toBeNull();
    expect(percentile([7], 90)).toBe(7);
  });
});

describe('time (heure locale)', () => {
  it('clé de journée locale et navigation', () => {
    const d = new Date(2026, 9, 11, 0, 30);
    expect(localDateKey(d)).toBe('2026-10-11');
    expect(parseDateKey('2026-10-11').getDate()).toBe(11);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('ISO local avec décalage', () => {
    const iso = toLocalISO(new Date(2026, 9, 11, 23, 30, 0));
    expect(iso.startsWith('2026-10-11T23:30:00')).toBe(true);
    expect(/[+-]\d{2}:\d{2}$/.test(iso)).toBe(true);
    expect(localDateKey(iso)).toBe('2026-10-11');
  });
  it('minutes, heure, période, nuit', () => {
    expect(minutesBetween(new Date(2026, 0, 1, 10), new Date(2026, 0, 1, 11, 30))).toBe(90);
    expect(timeKey(new Date(2026, 0, 1, 7, 5))).toBe('07:05');
    expect(combineDateAndTime(new Date(2026, 0, 1, 10), '23:15').getHours()).toBe(23);
    expect(combineDateAndTime(new Date(2026, 0, 1, 10), null).getHours()).toBe(10);
    expect(periodOfDay(7)).toBe('matin');
    expect(periodOfDay(12)).toBe('midi');
    expect(periodOfDay(19)).toBe('soir');
    expect(periodOfDay(23)).toBe('nuit');
    expect(isNightHour(23)).toBe(true);
    expect(isNightHour(5)).toBe(true);
    expect(isNightHour(12)).toBe(false);
    expect(isNightHour(10, 9, 11)).toBe(true);
    expect(isNightHour(10, 5, 5)).toBe(false);
  });
  it('formats selon la locale', () => {
    expect(localeTag('ar')).toContain('ar');
    expect(formatTime(new Date(2026, 0, 1, 9, 5), 'fr')).toMatch(/09.05/);
    expect(formatDate(new Date(2026, 0, 1), 'fr')).toContain('2026');
    expect(formatDateTime(new Date(2026, 0, 1, 9, 5), 'ar')).toBeTruthy();
    expect(formatTime('invalid', 'fr')).toBeTruthy();
  });
});

describe('ids', () => {
  it('uniques, triables, chaînes', () => {
    const a = newId();
    const b = newId();
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
    expect(newId('cgm_').startsWith('cgm_')).toBe(true);
  });
});

describe('journal accessors', () => {
  const meal = { id: 'm', date: new Date(2026, 9, 11, 12).toISOString(), glycPre: '1.4', glycPost: 1.9, doseSuggeree: 5, doseReelle: 4, totalGlucides: 60 };
  it('lit les champs v5 et v4', () => {
    expect(getGlucosePre(meal)).toBe(1.4);
    expect(getGlucosePost(meal)).toBe(1.9);
    expect(getSuggestedDose(meal)).toBe(5);
    expect(getActualDose(meal)).toBe(4);
    expect(getCarbs(meal)).toBe(60);
    expect(getGlucosePre({ id: 1, date: 'x', preMealGlycemia: 1.1 })).toBe(1.1);
    expect(getActualDose({ id: 1, date: 'x', doseCalculated: 3 })).toBe(3);
  });
  it('classe les entrées', () => {
    expect(entryKind(meal)).toBe('meal');
    expect(entryKind({ id: 1, date: 'x', mealType: 'mesure', glycPre: 1 })).toBe('glucose');
    expect(entryKind({ id: 1, date: 'x', mealType: 'injection', injectionType: 'correction', doseReelle: 2 })).toBe('injection');
    expect(entryKind({ id: 1, date: 'x', injectionType: 'basal', doseReelle: 12 })).toBe('basal');
    expect(entryKind({ id: 1, date: 'x', mealType: 'hypo' })).toBe('hypo');
    expect(entryKind({ id: 1, date: 'x', source: 'cgm', glycPre: 1 })).toBe('cgm');
    expect(isBolusInjection(meal)).toBe(true);
    expect(isCorrectionOnly({ id: 1, date: 'x', mealType: 'injection', injectionType: 'correction', doseReelle: 2 })).toBe(true);
  });
  it('lectures et injections récentes', () => {
    const now = new Date(2026, 9, 11, 15);
    const entries = [meal, { id: 'g', date: new Date(2026, 9, 11, 14).toISOString(), mealType: 'mesure', glycPre: 1.2 }, { id: 'old', date: new Date(2026, 9, 1).toISOString(), glycPre: 2 }];
    const readings = readingsFromJournal(entries, { days: 2, now });
    expect(readings.map((r) => r.kind)).toEqual(['pre', 'post', 'spot']);
    expect(postReadingTime(meal).getHours()).toBe(14);
    expect(recentInjections(entries, now, 300)).toHaveLength(1);
    expect(recentInjections(entries, now, 60)).toHaveLength(0);
  });
});

describe('anthropometry', () => {
  it('IMC, BSA, BMR, TDD', () => {
    expect(calcIMC(70, 175)).toBe(22.9);
    expect(calcIMC(70, 10)).toBeNull();
    expect(calcBSA(70, 175)).toBeCloseTo(1.85, 1);
    expect(calcBMR(70, 175, 30, 'M')).toBe(1649);
    expect(calcBMR(60, 165, 30, 'F')).toBe(1320);
    expect(imcCategory(17)).toBe('underweight');
    expect(imcCategory(22)).toBe('normal');
    expect(imcCategory(27)).toBe('overweight');
    expect(imcCategory(32)).toBe('obese1');
    expect(imcCategory(37)).toBe('obese2');
    expect(imcCategory(42)).toBe('obese3');
    expect(imcCategory(null)).toBeNull();
    expect(estimateTDD(70)).toBe(35);
    expect(estimateTDD(null)).toBeNull();
  });
});

describe('timeProfiles', () => {
  it('profil actif selon l’heure', () => {
    const profiles = DEFAULT_TIME_PROFILES.map((p) => ({ ...p, ratio: p.id === 'matin' ? 8 : null, isf: p.id === 'matin' ? 40 : null }));
    expect(getActiveProfile(profiles, 15, 60, 8)).toMatchObject({ ratio: 8, isf: 40, slot: 'matin' });
    expect(getActiveProfile(profiles, 15, 60, 13)).toMatchObject({ ratio: 15, isf: 60, slot: 'midi' });
    expect(getActiveProfile([], 15, 60, 8)).toMatchObject({ ratio: 15, isf: 60, slot: null });
  });
});

describe('ramadan', () => {
  it('stratification du risque', () => {
    expect(assessRamadanRisk({ type1: true }).category).toBe('high');
    expect(assessRamadanRisk({ type1: true, severeHypo3m: true }).category).toBe('very-high');
    expect(assessRamadanRisk({ type1: false }).category).toBe('moderate');
    expect(assessRamadanRisk({ type1: true, hba1cPct: 9.5, age: 75, fastingHours: 16 }).reasons).toContain('RAMADAN_REASON_LONG_FAST');
  });
  it('plan de jeûne', () => {
    const plan = buildFastingPlan(20, { basalReductionPct: 20, suhoorReductionPct: 25 });
    expect(plan.basalSuggestedU).toBe(16);
    expect(plan.suhoorBolusFactor).toBe(0.75);
    expect(buildFastingPlan(null).basalSuggestedU).toBeNull();
    expect(buildFastingPlan(20, { basalReductionPct: 90 }).basalReductionPct).toBe(30);
  });
  it('rupture du jeûne', () => {
    expect(shouldBreakFast(0.65)).toBe('SAFETY_FASTING_BREAK');
    expect(shouldBreakFast(3.2)).toBe('SAFETY_FASTING_BREAK');
    expect(shouldBreakFast(0.85, 2)).toBe('RAMADAN_BREAK_EARLY_LOW');
    expect(shouldBreakFast(1.2)).toBeNull();
  });
});

describe('daily summary & metrics', () => {
  const day = (h: number, extra: Record<string, unknown>) => ({ id: `${h}`, date: new Date(2026, 9, 11, h).toISOString(), ...extra });
  const journal = [
    day(8, { glycPre: 1.1, glycPost: 1.6, doseReelle: 5, totalGlucides: 60 }),
    day(13, { glycPre: 1.9, doseReelle: 2, mealType: 'injection', injectionType: 'correction' }),
    day(22, { doseReelle: 12, injectionType: 'basal', mealType: 'basal' }),
    day(0, { glycPre: 0.6, mealType: 'hypo', totalGlucides: 15 }),
  ];
  it('résumé du jour en heure locale', () => {
    const s = computeDailySummary(journal, '2026-10-11', 1.0, 1.8);
    expect(s.totalDose).toBe(7);
    expect(s.basalDose).toBe(12);
    expect(s.mealBolus).toBe(5);
    expect(s.corrections).toBe(2);
    expect(s.injections).toBe(2);
    expect(s.totalCarbs).toBe(75);
    expect(s.glycReadings).toBe(4);
    expect(s.hypoCount).toBe(1);
    expect(computeDailySummary(journal, '2026-10-12', 1, 1.8).glycReadings).toBe(0);
  });
  it('métriques consensus', () => {
    const readings = [0.6, 0.9, 1.2, 1.5, 1.9, 2.6].map((value, i) => ({ value, at: new Date(2026, 9, 1 + i, 8), kind: 'spot' as const, entryId: i }));
    const m = computeGlycemicMetrics(readings);
    expect(m.n).toBe(6);
    expect(m.tirPct).toBeCloseTo(50, 0);
    expect(m.tbrPct).toBeCloseTo(16.7, 0);
    expect(m.tar2Pct).toBeCloseTo(16.7, 0);
    expect(m.gmiPct).toBeNull();
    expect(m.goalsMet?.tir).toBe(false);
    expect(computeGlycemicMetrics([]).n).toBe(0);
    expect(gmiFromMeanGl(1.54)).toBeCloseTo(7.0, 1);
    expect(classifyGlucose(0.5, 1, 1.2)).toBe('hypo-severe');
    expect(classifyGlucose(0.95, 1, 1.2)).toBe('sous-cible');
    expect(classifyGlucose(1.1, 1, 1.2)).toBe('cible');
    expect(classifyGlucose(2.0, 1, 1.2)).toBe('haute');
    expect(classifyGlucose(3.0, 1, 1.2)).toBe('hyper-severe');
    expect(CONSENSUS.goals.tir).toBe(70);
  });
});
