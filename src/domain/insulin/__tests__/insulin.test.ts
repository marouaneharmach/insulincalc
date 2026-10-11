import { describe, it, expect } from 'vitest';
import { resolveInsulinProfile, effectiveRapidProfile, getProfileById, DEFAULT_RAPID_PROFILE, INSULIN_PROFILES } from '../profiles';
import { calcIOB, insulinActivity, calcTotalIOB, iobFromJournal, iobAt, minutesSinceLastBolus } from '../iob';

describe('profils d’insuline', () => {
  it('résout depuis un nom libre', () => {
    expect(resolveInsulinProfile('NovoRapid FlexPen')?.id).toBe('novorapid');
    expect(resolveInsulinProfile('Fiasp')?.kind).toBe('ultra-rapid');
    expect(resolveInsulinProfile('Humuline R')?.id).toBe('actrapid');
    expect(resolveInsulinProfile('inconnue')).toBeNull();
    expect(getProfileById('lyumjev')?.peakMin).toBe(55);
  });
  it('profil effectif et surcharge DIA', () => {
    expect(effectiveRapidProfile(null, 'Humalog').id).toBe('humalog');
    expect(effectiveRapidProfile('tresiba', null).id).toBe(DEFAULT_RAPID_PROFILE.id);
    const p = effectiveRapidProfile('novorapid', null, 3);
    expect(p.diaMin).toBe(180);
    expect(p.peakMin).toBeLessThan(75);
    expect(INSULIN_PROFILES.every((x) => x.diaMin > x.peakMin)).toBe(true);
  });
});

describe('IOB (Walsh)', () => {
  it('bornes et monotonie', () => {
    expect(calcIOB(5, 0)).toBe(5);
    expect(calcIOB(5, 270)).toBe(0);
    expect(calcIOB(0, 10)).toBe(0);
    let prev = 5;
    for (let t = 10; t <= 270; t += 10) {
      const v = calcIOB(5, t);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
    expect(insulinActivity(5, 75)).toBeGreaterThan(insulinActivity(5, 20));
    expect(insulinActivity(5, 300)).toBe(0);
  });
  it('depuis le journal', () => {
    const now = new Date(2026, 9, 11, 14);
    const journal = [
      { id: 'a', date: new Date(2026, 9, 11, 12).toISOString(), doseReelle: 6, totalGlucides: 60 },
      { id: 'b', date: new Date(2026, 9, 11, 13, 30).toISOString(), doseReelle: 2, mealType: 'injection', injectionType: 'correction' as const },
      { id: 'basal', date: new Date(2026, 9, 11, 8).toISOString(), doseReelle: 12, mealType: 'basal', injectionType: 'basal' as const },
    ];
    const iob = iobFromJournal(journal, now);
    expect(iob).toBeGreaterThan(2);
    expect(iob).toBeLessThan(8);
    expect(iobAt(journal, now, 240)).toBeLessThan(iob);
    expect(minutesSinceLastBolus(journal, now)).toBe(30);
    expect(minutesSinceLastBolus([], now)).toBeNull();
    expect(calcTotalIOB([{ dose: 1, minutesAgo: 0 }, { dose: 1, minutesAgo: 300 }])).toBe(1);
  });
});
