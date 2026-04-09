import { describe, it, expect } from 'vitest';
import { migrateEntry, needsMigration, migrateAllEntries } from '../migration.js';

describe('needsMigration', () => {
  it('returns true when app_version is absent', () => {
    expect(needsMigration(null)).toBe(true);
    expect(needsMigration(undefined)).toBe(true);
  });
  it('returns true for v4 versions', () => {
    expect(needsMigration('4.4.3')).toBe(true);
  });
  it('returns false for v5+', () => {
    expect(needsMigration('5.0.0')).toBe(false);
    expect(needsMigration('5.1.0')).toBe(false);
  });
});

describe('migrateEntry', () => {
  const v4Entry = {
    id: '123', date: '2026-03-20T12:30:00',
    preMealGlycemia: 1.30, foods: [{ id: 'khobz', name: 'Khobz' }],
    totalCarbs: 60, doseCalculated: 4.0, doseInjected: 4.0,
    postMealGlycemia: null, schedule: [],
  };

  it('adds missing v5 fields with defaults', () => {
    const m = migrateEntry(v4Entry);
    expect(m.tendance).toBeNull();
    expect(m.iobAuMoment).toBeNull();
    expect(m.activitePhysique).toBe('aucune');
    expect(m.alertes).toEqual([]);
    expect(m.notes).toBe('');
    expect(m.niveauGras).toBe('aucun');
    expect(m.bolusType).toBe('unique');
  });

  it('maps old field names to new ones', () => {
    const m = migrateEntry(v4Entry);
    expect(m.glycPre).toBe(1.30);
    expect(m.doseSuggeree).toBe(4.0);
    expect(m.doseReelle).toBe(4.0);
    expect(m.aliments).toEqual(v4Entry.foods);
    expect(m.heure).toBe('12:30');
    expect(m.totalGlucides).toBe(60);
  });

  it('preserves existing v5 fields', () => {
    const v5Entry = { ...v4Entry, tendance: '→', activitePhysique: 'legere' };
    const m = migrateEntry(v5Entry);
    expect(m.tendance).toBe('→');
    expect(m.activitePhysique).toBe('legere');
  });
});

describe('migrateAllEntries', () => {
  it('migrates array of entries', () => {
    const entries = [{ id: '1', date: '2026-03-20T10:00:00', totalCarbs: 30 }];
    const result = migrateAllEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].totalGlucides).toBe(30);
    expect(result[0].activitePhysique).toBe('aucune');
  });
});
