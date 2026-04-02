// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { addEntry, getEntries, updateEntry, deleteEntry, getStats, getAllEntries } from '../../data/journalStore.js';

describe('journalStore', () => {
  beforeEach(() => { localStorage.clear(); });

  it('should add and retrieve entries', () => {
    const entry = {
      mealType: 'déjeuner',
      preMealGlycemia: 1.4,
      foods: [{ foodId: 'pain_blanc', name: 'Pain blanc', mult: 1, carbs: 30 }],
      totalCarbs: 30,
      doseCalculated: 3.0,
      doseInjected: 3.0,
    };
    addEntry(entry);
    const entries = getEntries(7);
    expect(entries.length).toBe(1);
    expect(entries[0].mealType).toBe('déjeuner');
    expect(entries[0].preMealGlycemia).toBe(1.4);
    expect(entries[0].id).toBeDefined();
  });

  it('should update an entry', () => {
    const entry = { mealType: 'dîner', preMealGlycemia: 1.8, foods: [], totalCarbs: 0, doseCalculated: 0, doseInjected: 0 };
    addEntry(entry);
    const entries = getEntries(7);
    updateEntry(entries[0].id, { postMealGlycemia: 1.5, postMealTime: 120 });
    const updated = getEntries(7);
    expect(updated[0].postMealGlycemia).toBe(1.5);
    expect(updated[0].postMealTime).toBe(120);
  });

  it('should delete an entry', () => {
    addEntry({ mealType: 'déjeuner', preMealGlycemia: 1.2, foods: [], totalCarbs: 0, doseCalculated: 0, doseInjected: 0 });
    addEntry({ mealType: 'dîner', preMealGlycemia: 1.6, foods: [], totalCarbs: 0, doseCalculated: 0, doseInjected: 0 });
    const entries = getEntries(7);
    expect(entries.length).toBe(2);
    deleteEntry(entries[0].id);
    const remaining = getEntries(7);
    expect(remaining.length).toBe(1);
  });

  it('should return all entries sorted by date descending', () => {
    addEntry({ mealType: 'déjeuner', preMealGlycemia: 1.0, foods: [], totalCarbs: 0, doseCalculated: 0, doseInjected: 0 });
    addEntry({ mealType: 'dîner', preMealGlycemia: 2.0, foods: [], totalCarbs: 0, doseCalculated: 0, doseInjected: 0 });
    const all = getAllEntries();
    expect(all.length).toBe(2);
    // Last added should be first (most recent)
    expect(new Date(all[0].date).getTime()).toBeGreaterThanOrEqual(new Date(all[1].date).getTime());
  });

  it('should compute stats correctly', () => {
    addEntry({ mealType: 'déjeuner', preMealGlycemia: 1.2, foods: [], totalCarbs: 20, doseCalculated: 2, doseInjected: 2 });
    addEntry({ mealType: 'dîner', preMealGlycemia: 1.6, postMealGlycemia: 1.4, foods: [], totalCarbs: 30, doseCalculated: 3, doseInjected: 3 });
    const stats = getStats(7);
    expect(stats.count).toBe(2);
    expect(stats.measureCount).toBe(3); // 2 pre + 1 post
    expect(stats.average).toBeGreaterThan(0);
  });
});
