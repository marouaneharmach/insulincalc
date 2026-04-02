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

  it('should store and retrieve full food objects with all fields', () => {
    const foods = [
      { foodId: 'khobz_t', name: 'Khobz (tranche)', mult: 2, carbs: 60, unit: '1 tranche · 60g', gi: 'moyen', fat: 'faible' },
      { foodId: 'taj_poul_leg', name: 'Tajine poulet + légumes', mult: 1, carbs: 22, unit: '1 assiette · 300g', gi: 'faible', fat: 'moyen' },
    ];
    const entry = {
      mealType: 'déjeuner',
      preMealGlycemia: 1.3,
      foods,
      totalCarbs: 82,
      doseCalculated: 8,
      doseInjected: 8,
    };
    const saved = addEntry(entry);
    expect(saved.foods).toHaveLength(2);
    expect(saved.foods[0]).toMatchObject({
      foodId: 'khobz_t',
      name: 'Khobz (tranche)',
      mult: 2,
      carbs: 60,
      unit: '1 tranche · 60g',
      gi: 'moyen',
      fat: 'faible',
    });
    expect(saved.foods[1]).toMatchObject({
      foodId: 'taj_poul_leg',
      name: 'Tajine poulet + légumes',
      mult: 1,
      carbs: 22,
      unit: '1 assiette · 300g',
      gi: 'faible',
      fat: 'moyen',
    });

    // Verify retrieval from storage preserves all fields
    const retrieved = getEntries(7);
    expect(retrieved[0].foods[0].unit).toBe('1 tranche · 60g');
    expect(retrieved[0].foods[0].gi).toBe('moyen');
    expect(retrieved[0].foods[0].fat).toBe('faible');
    expect(retrieved[0].foods[1].foodId).toBe('taj_poul_leg');
  });

  it('should preserve full food objects after update', () => {
    const foods = [
      { foodId: 'khobz_t', name: 'Khobz (tranche)', mult: 1, carbs: 30, unit: '1 tranche · 60g', gi: 'moyen', fat: 'faible' },
    ];
    addEntry({ mealType: 'déjeuner', preMealGlycemia: 1.2, foods, totalCarbs: 30, doseCalculated: 3, doseInjected: 3 });
    const entries = getEntries(7);
    const updatedFoods = [
      ...entries[0].foods,
      { foodId: 'taj_kefta', name: 'Tajine kefta + œufs', mult: 1, carbs: 8, unit: '1 assiette · 250g', gi: 'faible', fat: 'élevé' },
    ];
    updateEntry(entries[0].id, { foods: updatedFoods, totalCarbs: 38 });
    const updated = getEntries(7);
    expect(updated[0].foods).toHaveLength(2);
    expect(updated[0].totalCarbs).toBe(38);
    expect(updated[0].foods[1].foodId).toBe('taj_kefta');
    expect(updated[0].foods[1].unit).toBe('1 assiette · 250g');
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
