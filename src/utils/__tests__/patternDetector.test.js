import { describe, it, expect } from 'vitest';
import { detectAdvancedPatterns } from '../patternDetector.js';

// ─── HELPERS ────────────────────────────────────────────────────────────────
function makeEntry(overrides = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    date: new Date().toISOString(),
    mealType: 'déjeuner',
    preMealGlycemia: 1.2,
    postMealGlycemia: null,
    postMealTime: 120,
    foods: [],
    totalCarbs: 40,
    doseCalculated: 4,
    doseInjected: 4,
    correction: 0,
    notes: '',
    ...overrides,
  };
}

function daysAgo(n, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

describe('detectAdvancedPatterns', () => {
  it('returns empty for null/undefined/short arrays', () => {
    expect(detectAdvancedPatterns(null)).toEqual([]);
    expect(detectAdvancedPatterns(undefined)).toEqual([]);
    expect(detectAdvancedPatterns([])).toEqual([]);
    expect(detectAdvancedPatterns([makeEntry()])).toEqual([]);
  });

  // ─── PATTERN 1: Dawn Phenomenon ────────────────────────────────────────
  describe('dawn phenomenon', () => {
    it('detects dawn phenomenon when morning fasting > evening + 0.30', () => {
      const entries = [];
      // Create 5 days of evening + morning pairs with dawn rise
      for (let i = 0; i < 5; i++) {
        // Evening entry
        entries.push(makeEntry({
          mealType: 'dîner',
          date: daysAgo(i + 1, 20),
          preMealGlycemia: 1.1,
          postMealGlycemia: 1.3,
        }));
        // Morning entry with fasting higher than evening + 0.30
        entries.push(makeEntry({
          mealType: 'petit-déjeuner',
          date: daysAgo(i, 7),
          preMealGlycemia: 1.8, // 1.8 > 1.3 + 0.30
        }));
      }
      // Add filler entries for minimum
      entries.push(makeEntry({ date: daysAgo(6, 12) }));

      const patterns = detectAdvancedPatterns(entries);
      const dawn = patterns.find(p => p.type === 'dawn_phenomenon');
      expect(dawn).toBeDefined();
      expect(dawn.severity).toBe('warning');
      expect(dawn.count).toBeGreaterThanOrEqual(3);
    });

    it('does not detect dawn phenomenon with normal values', () => {
      const entries = [];
      for (let i = 0; i < 5; i++) {
        entries.push(makeEntry({
          mealType: 'dîner',
          date: daysAgo(i + 1, 20),
          preMealGlycemia: 1.2,
          postMealGlycemia: 1.3,
        }));
        entries.push(makeEntry({
          mealType: 'petit-déjeuner',
          date: daysAgo(i, 7),
          preMealGlycemia: 1.2, // Not > 1.3 + 0.30
        }));
      }
      entries.push(makeEntry({ date: daysAgo(6, 12) }));

      const patterns = detectAdvancedPatterns(entries);
      const dawn = patterns.find(p => p.type === 'dawn_phenomenon');
      expect(dawn).toBeUndefined();
    });
  });

  // ─── PATTERN 2: Recurring Morning Hypo ────────────────────────────────
  describe('morning hypo', () => {
    it('detects recurring morning hypos with preMeal < 0.70', () => {
      const entries = [];
      for (let i = 0; i < 5; i++) {
        entries.push(makeEntry({
          mealType: 'petit-déjeuner',
          date: daysAgo(i, 7),
          preMealGlycemia: 0.55, // Below 0.70
        }));
      }

      const patterns = detectAdvancedPatterns(entries);
      const hypo = patterns.find(p => p.type === 'morning_hypo');
      expect(hypo).toBeDefined();
      expect(hypo.severity).toBe('warning');
      expect(hypo.count).toBe(5);
    });

    it('does not detect morning hypo with normal values', () => {
      const entries = [];
      for (let i = 0; i < 5; i++) {
        entries.push(makeEntry({
          mealType: 'petit-déjeuner',
          date: daysAgo(i, 7),
          preMealGlycemia: 1.0,
        }));
      }

      const patterns = detectAdvancedPatterns(entries);
      const hypo = patterns.find(p => p.type === 'morning_hypo');
      expect(hypo).toBeUndefined();
    });
  });

  // ─── PATTERN 3: Somogyi Rebound ───────────────────────────────────────
  describe('Somogyi rebound', () => {
    it('detects post-hypo rebound (hypo then hyper within 4h)', () => {
      const entries = [];
      // Two rebound episodes
      for (let episode = 0; episode < 2; episode++) {
        const day = episode * 2;
        // Hypo entry
        entries.push(makeEntry({
          date: daysAgo(day, 14),
          preMealGlycemia: 0.50,
          postMealGlycemia: 0.55,
        }));
        // Rebound entry 2h later
        entries.push(makeEntry({
          date: daysAgo(day, 16),
          preMealGlycemia: 2.50, // > 2.00
        }));
      }
      // Add filler for minimum
      entries.push(makeEntry({ date: daysAgo(5, 12) }));

      const patterns = detectAdvancedPatterns(entries);
      const rebound = patterns.find(p => p.type === 'somogyi_rebound');
      expect(rebound).toBeDefined();
      expect(rebound.severity).toBe('warning');
      expect(rebound.count).toBe(2);
    });

    it('does not detect rebound if entries are > 4h apart', () => {
      const entries = [];
      for (let episode = 0; episode < 2; episode++) {
        const day = episode * 2;
        entries.push(makeEntry({
          date: daysAgo(day, 8),
          preMealGlycemia: 0.50,
        }));
        // 6h later - too far
        entries.push(makeEntry({
          date: daysAgo(day, 14),
          preMealGlycemia: 2.50,
        }));
      }
      entries.push(makeEntry({ date: daysAgo(5, 12) }));

      const patterns = detectAdvancedPatterns(entries);
      const rebound = patterns.find(p => p.type === 'somogyi_rebound');
      expect(rebound).toBeUndefined();
    });
  });

  // ─── PATTERN 4: Systematic Over-correction ───────────────────────────
  describe('over-correction', () => {
    it('detects when > 50% of entries have doseInjected > 1.2x doseCalculated', () => {
      const entries = [];
      for (let i = 0; i < 6; i++) {
        entries.push(makeEntry({
          date: daysAgo(i, 12),
          doseCalculated: 4,
          doseInjected: 6, // 50% over = (6-4)/4 = 0.50 > 0.20
        }));
      }

      const patterns = detectAdvancedPatterns(entries);
      const oc = patterns.find(p => p.type === 'over_correction');
      expect(oc).toBeDefined();
      expect(oc.severity).toBe('warning');
    });

    it('does not detect when doses match', () => {
      const entries = [];
      for (let i = 0; i < 6; i++) {
        entries.push(makeEntry({
          date: daysAgo(i, 12),
          doseCalculated: 4,
          doseInjected: 4,
        }));
      }

      const patterns = detectAdvancedPatterns(entries);
      const oc = patterns.find(p => p.type === 'over_correction');
      expect(oc).toBeUndefined();
    });
  });

  // ─── PATTERN 5: Problem Time Slot ─────────────────────────────────────
  describe('problem time slot', () => {
    it('detects poor TIR in a specific time slot', () => {
      const entries = [];
      // All entries at noon (12h = slot 12h-16h) with high glycemia
      for (let i = 0; i < 5; i++) {
        entries.push(makeEntry({
          date: daysAgo(i, 13),
          preMealGlycemia: 2.5, // Out of range (1.0-1.8)
          postMealGlycemia: 2.8,
        }));
      }

      const patterns = detectAdvancedPatterns(entries);
      const slot = patterns.find(p => p.type === 'problem_time_slot');
      expect(slot).toBeDefined();
      expect(slot.severity).toBe('info');
      expect(slot.message).toContain('12h-16h');
    });

    it('does not flag slots with good TIR', () => {
      const entries = [];
      for (let i = 0; i < 5; i++) {
        entries.push(makeEntry({
          date: daysAgo(i, 13),
          preMealGlycemia: 1.3, // In range
          postMealGlycemia: 1.5, // In range
        }));
      }

      const patterns = detectAdvancedPatterns(entries);
      const slot = patterns.find(p => p.type === 'problem_time_slot');
      expect(slot).toBeUndefined();
    });
  });

  // ─── PATTERN 6: Recurring Stacking ────────────────────────────────────
  describe('recurring stacking', () => {
    it('detects corrections within < 2h of each other', () => {
      const entries = [];
      // 3 pairs of close corrections
      for (let i = 0; i < 3; i++) {
        const day = i;
        entries.push(makeEntry({
          date: daysAgo(day, 14),
          correction: 1.5,
        }));
        // 1h later
        entries.push(makeEntry({
          date: daysAgo(day, 15),
          correction: 1.0,
        }));
      }

      const patterns = detectAdvancedPatterns(entries);
      const stacking = patterns.find(p => p.type === 'recurring_stacking');
      expect(stacking).toBeDefined();
      expect(stacking.severity).toBe('warning');
      expect(stacking.count).toBeGreaterThanOrEqual(2);
    });

    it('does not detect stacking when corrections are > 2h apart', () => {
      const entries = [];
      for (let i = 0; i < 5; i++) {
        entries.push(makeEntry({
          date: daysAgo(i, 12),
          correction: 1.5,
        }));
      }

      const patterns = detectAdvancedPatterns(entries);
      const stacking = patterns.find(p => p.type === 'recurring_stacking');
      expect(stacking).toBeUndefined();
    });
  });

  // ─── Integration ──────────────────────────────────────────────────────
  it('returns multiple patterns when multiple conditions are met', () => {
    const entries = [];
    // Morning hypos + over-correction
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({
        mealType: 'petit-déjeuner',
        date: daysAgo(i, 7),
        preMealGlycemia: 0.55,
        doseCalculated: 3,
        doseInjected: 5, // Over-correction
      }));
    }

    const patterns = detectAdvancedPatterns(entries);
    expect(patterns.length).toBeGreaterThanOrEqual(2);
    expect(patterns.some(p => p.type === 'morning_hypo')).toBe(true);
    expect(patterns.some(p => p.type === 'over_correction')).toBe(true);
  });
});
