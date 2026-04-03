// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { applySafetyRules, isNightMode } from '../clinicalEngine.js';

describe('clinicalEngine', () => {
  const baseInput = {
    glycemia: 1.8,
    suggestedDose: 4.0,
    iobTotal: 0,
    currentHour: 14,
    lastInjectionMinAgo: 300,
    cumulCorrections24h: 0,
    tddEstimated: 30,
    correction: 1.0,
    maxDose: 20,
  };

  describe('anti-hypo rules', () => {
    it('should block when glycemia < 0.70', () => {
      const result = applySafetyRules({ ...baseInput, glycemia: 0.60 });
      expect(result.blocked).toBe(true);
      expect(result.adjustedDose).toBe(0);
    });

    it('should reduce dose 50% when glycemia 0.70-0.90', () => {
      const result = applySafetyRules({ ...baseInput, glycemia: 0.80 });
      expect(result.adjustedDose).toBeLessThanOrEqual(baseInput.suggestedDose * 0.55);
      expect(result.adjustedCorrection).toBe(0);
    });
  });

  describe('RULE 1: IOB dynamic', () => {
    it('should reduce correction when IOB > 50% of suggested dose', () => {
      const result = applySafetyRules({ ...baseInput, iobTotal: 3.0, suggestedDose: 4.0, correction: 2.0 });
      expect(result.warnings.some(w => w.type === 'iob_dynamic')).toBe(true);
      expect(result.adjustedCorrection).toBeLessThan(2.0);
    });

    it('should not warn when IOB is low', () => {
      const result = applySafetyRules({ ...baseInput, iobTotal: 0.5, suggestedDose: 4.0, correction: 1.0 });
      expect(result.warnings.some(w => w.type === 'iob_dynamic')).toBe(false);
    });
  });

  describe('RULE 2: Night mode', () => {
    it('should block correction at night when glycemia < 2.20', () => {
      const result = applySafetyRules({ ...baseInput, currentHour: 23, glycemia: 2.0, correction: 1.0 });
      expect(result.correctionBlocked).toBe(true);
      expect(result.warnings.some(w => w.type === 'night_block')).toBe(true);
    });

    it('should allow correction at night when glycemia >= 2.50', () => {
      const result = applySafetyRules({ ...baseInput, currentHour: 23, glycemia: 2.8, correction: 2.0 });
      expect(result.correctionBlocked).toBeFalsy();
    });

    it('should reduce correction by 50% at night when glycemia >= 2.50', () => {
      const result = applySafetyRules({ ...baseInput, currentHour: 23, glycemia: 2.8, correction: 2.0 });
      expect(result.adjustedCorrection).toBeLessThanOrEqual(1.0);
    });

    it('should recommend snack when glycemia < 1.50 at night', () => {
      const result = applySafetyRules({ ...baseInput, currentHour: 2, glycemia: 1.3, correction: 0 });
      expect(result.warnings.some(w => w.type === 'night_low')).toBe(true);
    });
  });

  describe('RULE 3: Recent injection cap', () => {
    it('should cap correction to 1U when last injection < 180 min', () => {
      const result = applySafetyRules({ ...baseInput, lastInjectionMinAgo: 90, correction: 3.0 });
      expect(result.adjustedCorrection).toBeLessThanOrEqual(1.0);
    });

    it('should not cap when last injection > 180 min', () => {
      const result = applySafetyRules({ ...baseInput, lastInjectionMinAgo: 200, correction: 3.0 });
      expect(result.warnings.some(w => w.type === 'timing_cap')).toBe(false);
    });
  });

  describe('RULE 4: Daily cumul', () => {
    it('should warn when cumul corrections > 15% TDD', () => {
      const result = applySafetyRules({ ...baseInput, cumulCorrections24h: 6.0, tddEstimated: 30 });
      expect(result.warnings.some(w => w.type === 'cumul_high')).toBe(true);
    });
  });

  describe('overdose check', () => {
    it('should warn when dose > maxDose', () => {
      const result = applySafetyRules({ ...baseInput, suggestedDose: 25, maxDose: 20 });
      expect(result.warnings.some(w => w.type === 'overdose')).toBe(true);
    });
  });

  describe('isNightMode', () => {
    it('should return true for 21-06', () => {
      expect(isNightMode(21)).toBe(true);
      expect(isNightMode(23)).toBe(true);
      expect(isNightMode(0)).toBe(true);
      expect(isNightMode(5)).toBe(true);
    });
    it('should return false for day hours', () => {
      expect(isNightMode(6)).toBe(false);
      expect(isNightMode(14)).toBe(false);
      expect(isNightMode(20)).toBe(false);
    });
  });
});
