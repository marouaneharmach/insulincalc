// @vitest-environment jsdom
// src/utils/__tests__/migration.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { migrateData, CURRENT_VERSION, guessMealTypeFromHour } from '../migration.js';

describe('migration', () => {
  beforeEach(() => localStorage.clear());

  it('should migrate v0 journal entries to v1 schema', () => {
    // v0 schema (App.jsx format)
    const oldEntries = [
      { id: 1, date: '2026-04-01', glycPre: '1.40', glycPost: '', doseSuggested: 3, doseActual: 3, aliments: 'Pain, Tajine', alimentIds: ['pain_blanc', 'tajine_poulet'] }
    ];
    localStorage.setItem('insulincalc_v1_journal', JSON.stringify([]));
    localStorage.setItem('journal', JSON.stringify(oldEntries));

    migrateData();

    const migrated = JSON.parse(localStorage.getItem('insulincalc_v1_journal'));
    expect(migrated).toHaveLength(1);
    expect(migrated[0].preMealGlycemia).toBe(1.40);
    expect(migrated[0].doseCalculated).toBe(3);
    expect(migrated[0].foods).toHaveLength(2);
  });

  it('should migrate single ratio/ISF to per-period profiles', () => {
    localStorage.setItem('insulincalc_v1_ratio', '10');
    localStorage.setItem('insulincalc_v1_isf', '50');

    migrateData();

    const profiles = JSON.parse(localStorage.getItem('insulincalc_v1_timeProfiles'));
    expect(profiles.matin.ratio).toBe(10);
    expect(profiles.soir.isf).toBe(50);
  });

  it('should not re-run migrations', () => {
    localStorage.setItem('insulincalc_v1_dataVersion', String(CURRENT_VERSION));
    localStorage.setItem('journal', JSON.stringify([{ id: 1 }]));

    migrateData();

    // Old journal key should still exist (not migrated again)
    expect(JSON.parse(localStorage.getItem('journal'))).toHaveLength(1);
  });

  it('should merge migrated entries with existing v1 entries', () => {
    const oldEntries = [
      { id: 1, date: '2026-04-01', glycPre: '1.20', glycPost: '', doseSuggested: 2, doseActual: 2, aliments: 'Riz', alimentIds: ['riz_blanc'] }
    ];
    const existingEntries = [
      { id: 'abc123', date: '2026-04-02T12:00:00.000Z', mealType: 'déjeuner', preMealGlycemia: 1.1, foods: [], totalCarbs: 30, doseCalculated: 3, doseInjected: 3 }
    ];
    localStorage.setItem('journal', JSON.stringify(oldEntries));
    localStorage.setItem('insulincalc_v1_journal', JSON.stringify(existingEntries));

    migrateData();

    const result = JSON.parse(localStorage.getItem('insulincalc_v1_journal'));
    expect(result).toHaveLength(2);
  });

  it('should deduplicate entries by id during migration', () => {
    const oldEntries = [
      { id: 1, date: '2026-04-01', glycPre: '1.20', glycPost: '', doseSuggested: 2, doseActual: 2, aliments: 'Riz', alimentIds: ['riz_blanc'] }
    ];
    const existingEntries = [
      { id: '1', date: '2026-04-01T12:00:00.000Z', mealType: 'déjeuner', preMealGlycemia: 1.2, foods: [], totalCarbs: 30, doseCalculated: 2, doseInjected: 2 }
    ];
    localStorage.setItem('journal', JSON.stringify(oldEntries));
    localStorage.setItem('insulincalc_v1_journal', JSON.stringify(existingEntries));

    migrateData();

    const result = JSON.parse(localStorage.getItem('insulincalc_v1_journal'));
    // Should NOT duplicate — old id "1" matches existing id "1"
    expect(result).toHaveLength(1);
  });

  it('should handle missing old journal gracefully', () => {
    // No 'journal' key set at all
    migrateData();

    // Should still set the version
    expect(localStorage.getItem('insulincalc_v1_dataVersion')).toBe(String(CURRENT_VERSION));
  });

  it('should set data version after migration', () => {
    migrateData();

    expect(localStorage.getItem('insulincalc_v1_dataVersion')).toBe(String(CURRENT_VERSION));
  });

  it('should convert glycPre string to number', () => {
    const oldEntries = [
      { id: 1, date: '2026-04-01', glycPre: '1.85', glycPost: '1.20', doseSuggested: 4, doseActual: 3, aliments: 'Couscous', alimentIds: ['couscous'] }
    ];
    localStorage.setItem('journal', JSON.stringify(oldEntries));

    migrateData();

    const migrated = JSON.parse(localStorage.getItem('insulincalc_v1_journal'));
    expect(migrated[0].preMealGlycemia).toBe(1.85);
    expect(migrated[0].postMealGlycemia).toBe(1.20);
    expect(migrated[0].doseInjected).toBe(3);
  });

  describe('guessMealTypeFromHour', () => {
    it('should return petit-déjeuner for morning hours', () => {
      expect(guessMealTypeFromHour(7)).toBe('petit-déjeuner');
      expect(guessMealTypeFromHour(9)).toBe('petit-déjeuner');
    });

    it('should return déjeuner for midday', () => {
      expect(guessMealTypeFromHour(12)).toBe('déjeuner');
      expect(guessMealTypeFromHour(14)).toBe('déjeuner');
    });

    it('should return collation for afternoon', () => {
      expect(guessMealTypeFromHour(15)).toBe('collation');
      expect(guessMealTypeFromHour(17)).toBe('collation');
    });

    it('should return dîner for evening', () => {
      expect(guessMealTypeFromHour(18)).toBe('dîner');
      expect(guessMealTypeFromHour(21)).toBe('dîner');
    });
  });
});
