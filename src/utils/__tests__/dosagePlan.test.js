// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { addEntry, getEntries } from '../../data/journalStore.js';

describe('dosage plan persistence', () => {
  beforeEach(() => localStorage.clear());

  it('should store and retrieve dosage plan with entry', () => {
    const entry = {
      mealType: 'déjeuner', preMealGlycemia: 1.4,
      foods: [], totalCarbs: 45, doseCalculated: 4.5, doseInjected: 4.5,
      dosagePlan: [
        { step: 0, label: 'Phase 1', plannedDose: 2.5, actualDose: 2.5, taken: true, takenAt: new Date().toISOString() },
        { step: 1, label: 'Phase 2', plannedDose: 2.0, actualDose: null, taken: false, takenAt: null },
      ],
    };
    addEntry(entry);
    const entries = getEntries(7);
    expect(entries[0].dosagePlan).toHaveLength(2);
    expect(entries[0].dosagePlan[0].taken).toBe(true);
    expect(entries[0].dosagePlan[1].taken).toBe(false);
  });

  it('should preserve dosage plan fields accurately', () => {
    const now = new Date().toISOString();
    const entry = {
      mealType: 'dîner', preMealGlycemia: 1.2,
      foods: [], totalCarbs: 60, doseCalculated: 6.0, doseInjected: 5.5,
      dosagePlan: [
        { step: 0, label: 'Phase 1 — glucides rapides (60%)', plannedDose: 3.5, actualDose: 3.0, taken: true, takenAt: now, timeLabel: '15 min avant le repas' },
        { step: 1, label: 'Phase 2 — graisses (40%)', plannedDose: 2.5, actualDose: 2.5, taken: true, takenAt: now, timeLabel: '45 min après début du repas' },
      ],
    };
    addEntry(entry);
    const entries = getEntries(7);
    const plan = entries[0].dosagePlan;
    expect(plan[0].plannedDose).toBe(3.5);
    expect(plan[0].actualDose).toBe(3.0);
    expect(plan[0].timeLabel).toBe('15 min avant le repas');
    expect(plan[1].taken).toBe(true);
    expect(plan[1].takenAt).toBe(now);
  });

  it('should handle entry without dosage plan (backward compat)', () => {
    const entry = {
      mealType: 'déjeuner', preMealGlycemia: 1.3,
      foods: [], totalCarbs: 30, doseCalculated: 3.0, doseInjected: 3.0,
    };
    addEntry(entry);
    const entries = getEntries(7);
    // dosagePlan not in defaults, so it should be undefined
    expect(entries[0].dosagePlan).toBeUndefined();
  });
});
