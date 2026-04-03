// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { addEntry, getEntries, getStats } from '../../data/journalStore.js';
import { applySafetyRules, isNightMode, predictGlycemia } from '../clinicalEngine.js';
import { calcVelocity, classifyVelocity, adjustDoseForVelocity } from '../velocity.js';
import { calcHypoRiskScore, classifyRisk } from '../hypoRisk.js';
import { detectAdvancedPatterns } from '../patternDetector.js';
import { getActiveProfile, createDefaultProfiles } from '../timeProfiles.js';
import { calcIOB, round05, INSULIN_DURATION_MIN } from '../calculations.js';

// ─── INTEGRATION TESTS ─────────────────────────────────────────────────────
// These tests verify that all modules work together correctly,
// simulating real user flows end-to-end.

describe('integration', () => {
  beforeEach(() => localStorage.clear());

  // ── Flow 1: Full meal → calculate → save → view in journal ──────────
  it('full flow: save entry → compute velocity → assess risk', () => {
    // Save first entry
    addEntry({
      mealType: 'déjeuner', preMealGlycemia: 1.4,
      foods: [], totalCarbs: 30, doseCalculated: 3.0, doseInjected: 3.0,
    });

    // Verify entry was saved
    const entries1 = getEntries(1);
    expect(entries1.length).toBe(1);
    const firstEntry = entries1[0];
    expect(firstEntry.mealType).toBe('déjeuner');
    expect(firstEntry.preMealGlycemia).toBe(1.4);
    expect(firstEntry.totalCarbs).toBe(30);
    expect(firstEntry.id).toBeTruthy();

    // Simulate velocity calculation (120 min later, glycemia rose from 1.4 to 1.8)
    const velocity = calcVelocity(1.8, 1.4, 120);
    expect(velocity).toBeCloseTo(0.2);
    const trend = classifyVelocity(velocity);
    expect(trend).toBe('rising');

    // Compute risk score with IOB from first injection
    const iob = calcIOB(3.0, 120, 270);
    expect(iob).toBeGreaterThan(0);
    expect(iob).toBeLessThan(3.0);

    const riskScore = calcHypoRiskScore({
      glycemia: 1.8, iobTotal: iob,
      trend, hypoIn24h: false, activity: 'none', currentHour: 14,
    });
    expect(classifyRisk(riskScore)).toBe('low');

    // Safety check
    const safety = applySafetyRules({
      glycemia: 1.8, suggestedDose: 3.0, iobTotal: iob,
      currentHour: 14, lastInjectionMinAgo: 120,
      cumulCorrections24h: 0, tddEstimated: 30,
      correction: 0.5, maxDose: 20,
    });
    expect(safety.blocked).toBe(false);
    expect(safety.warnings).toBeDefined();
    expect(Array.isArray(safety.warnings)).toBe(true);
  });

  // ── Flow 1b: Save multiple entries and verify stats ──────────────────
  it('save multiple entries → stats are correct', () => {
    addEntry({ preMealGlycemia: 1.2, totalCarbs: 40, doseCalculated: 4, doseInjected: 4 });
    addEntry({ preMealGlycemia: 1.6, totalCarbs: 30, doseCalculated: 3, doseInjected: 3 });
    addEntry({ preMealGlycemia: 0.9, totalCarbs: 20, doseCalculated: 2, doseInjected: 2 });

    const stats = getStats(30);
    expect(stats.count).toBe(3);
    expect(stats.measureCount).toBe(3);
    expect(stats.average).toBeGreaterThan(0);
    // All three values (0.9, 1.2, 1.6) are in range [1.0, 1.8] except 0.9
    expect(stats.targetPercent).toBeLessThan(100);
  });

  // ── Flow 2: Safety engine integration ────────────────────────────────
  it('night mode blocks corrections appropriately', () => {
    expect(isNightMode(23)).toBe(true);
    expect(isNightMode(3)).toBe(true);
    expect(isNightMode(14)).toBe(false);

    // Test night block: glycemia < 1.50 blocks correction entirely
    const safetyBlock = applySafetyRules({
      glycemia: 1.3, suggestedDose: 3.0, iobTotal: 0,
      currentHour: 23, lastInjectionMinAgo: 300,
      cumulCorrections24h: 0, tddEstimated: 30,
      correction: 1.0, maxDose: 20,
    });
    expect(safetyBlock.correctionBlocked).toBe(true);
    expect(safetyBlock.nightMode).toBe(true);
    expect(safetyBlock.adjustedCorrection).toBe(0);
    expect(safetyBlock.warnings.some(w => w.type === 'night_block')).toBe(true);

    // Test night reduce: glycemia >= 1.50 reduces correction by 50%
    const safetyReduce = applySafetyRules({
      glycemia: 1.9, suggestedDose: 3.0, iobTotal: 0,
      currentHour: 23, lastInjectionMinAgo: 300,
      cumulCorrections24h: 0, tddEstimated: 30,
      correction: 1.0, maxDose: 20,
    });
    expect(safetyReduce.nightMode).toBe(true);
    expect(safetyReduce.adjustedCorrection).toBeLessThanOrEqual(0.5);
    expect(safetyReduce.warnings.some(w => w.type === 'night_reduce')).toBe(true);
  });

  it('hypo block prevents all injection', () => {
    const safety = applySafetyRules({
      glycemia: 0.5, suggestedDose: 5.0, iobTotal: 0,
      currentHour: 12, lastInjectionMinAgo: 300,
      cumulCorrections24h: 0, tddEstimated: 30,
      correction: 2.0, maxDose: 20,
    });
    expect(safety.blocked).toBe(true);
    expect(safety.adjustedDose).toBe(0);
    expect(safety.warnings.some(w => w.type === 'hypo_block')).toBe(true);
  });

  it('safety warnings propagate from clinical engine to result object shape', () => {
    // Simulate what App.jsx does: compute safety then merge warnings
    const total = 5.0;
    const correction = 2.0;
    const safety = applySafetyRules({
      glycemia: 0.85, suggestedDose: total, iobTotal: 0,
      currentHour: 14, lastInjectionMinAgo: 300,
      cumulCorrections24h: 0, tddEstimated: 30,
      correction, maxDose: 20,
    });

    // App.jsx merges safety.warnings into the result warnings array
    const warnings = [];
    for (const sw of safety.warnings) {
      warnings.push({ t: sw.severity === 'critical' ? 'w' : sw.severity === 'warning' ? 'w' : 'i', txt: sw.message });
    }
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].txt).toContain('basse');
  });

  // ── Flow 3: Variable ratios apply correct period profile ─────────────
  it('variable ratios apply correct period profile', () => {
    const profiles = createDefaultProfiles(10, 50);
    // Override morning profile
    profiles.matin = { ratio: 8, isf: 40 };

    const morning = getActiveProfile(profiles, 8);
    expect(morning.ratio).toBe(8);
    expect(morning.isf).toBe(40);

    const afternoon = getActiveProfile(profiles, 14);
    expect(afternoon.ratio).toBe(10);
    expect(afternoon.isf).toBe(50);

    // Night period (22-6)
    const night = getActiveProfile(profiles, 23);
    expect(night.period).toBe('nuit');
    expect(night.ratio).toBe(10);
  });

  // ── Flow 4: Prediction uses velocity and IOB together ────────────────
  it('prediction uses velocity and IOB together', () => {
    const pred = predictGlycemia({
      currentG: 1.5, velocity: -0.3, iobRemaining: 2.0, isf: 50,
    });
    expect(pred).not.toBeNull();
    expect(pred.glyc1h).toBeLessThan(1.5);
    expect(pred.glyc2h).toBeLessThan(pred.glyc1h);
    // Both should have numeric values
    expect(typeof pred.glyc1h).toBe('number');
    expect(typeof pred.glyc2h).toBe('number');
  });

  it('prediction returns null when velocity is unknown', () => {
    const pred = predictGlycemia({
      currentG: 1.5, velocity: null, iobRemaining: 2.0, isf: 50,
    });
    expect(pred).toBeNull();
  });

  it('prediction alerts on imminent hypo', () => {
    const pred = predictGlycemia({
      currentG: 0.85, velocity: -0.4, iobRemaining: 3.0, isf: 50,
    });
    expect(pred).not.toBeNull();
    // With dropping velocity and high IOB, should predict hypo
    expect(pred.glyc1h).toBeLessThan(0.85);
    expect(pred.alert1h).toBe('hypo_imminent');
  });

  // ── Flow 5: Velocity adjustment affects correction dose ──────────────
  it('velocity adjustments modify correction dose correctly', () => {
    const baseDose = 2.0;

    // Falling fast -> zero correction (safety)
    expect(adjustDoseForVelocity(baseDose, 'falling_fast')).toBe(0);

    // Falling -> 50% correction
    expect(adjustDoseForVelocity(baseDose, 'falling')).toBe(1.0);

    // Stable -> no change
    expect(adjustDoseForVelocity(baseDose, 'stable')).toBe(2.0);

    // Rising fast -> 120% correction
    expect(adjustDoseForVelocity(baseDose, 'rising_fast')).toBe(2.5); // 2.0 * 1.2 = 2.4, rounded to 0.5 = 2.5
  });

  // ── Flow 6: IOB decay over time ─────────────────────────────────────
  it('IOB decays correctly over insulin action duration', () => {
    const dose = 5.0;
    const duration = 270; // 4.5h in minutes

    // At t=0, full dose active
    expect(calcIOB(dose, 0, duration)).toBe(dose);

    // At half-life, should be reduced
    const halfIOB = calcIOB(dose, duration / 2, duration);
    expect(halfIOB).toBeLessThan(dose);
    expect(halfIOB).toBeGreaterThan(0);

    // At end, should be 0
    expect(calcIOB(dose, duration, duration)).toBe(0);

    // Past duration, should be 0
    expect(calcIOB(dose, duration + 60, duration)).toBe(0);
  });

  // ── Flow 7: Complete save → retrieve → stats pipeline ────────────────
  it('journal entry enrichment matches what saveToJournal would produce', () => {
    // Simulate what App.jsx saveToJournal does
    const gVal = 1.5;
    const h = 14;
    const mealType = h < 10 ? 'petit-déjeuner' : h < 15 ? 'déjeuner' : h < 18 ? 'collation' : 'dîner';
    expect(mealType).toBe('déjeuner');

    // No previous entry, so velocity is null
    const recentAll = getEntries(7);
    expect(recentAll.length).toBe(0);

    const entry = addEntry({
      mealType,
      preMealGlycemia: gVal,
      foods: [{ foodId: 'test1', name: 'Pain', mult: 1, carbs: 25 }],
      totalCarbs: 25,
      doseCalculated: 2.5,
      doseInjected: 2.5,
      correction: 0.5,
      velocity: null,
      velocityTrend: null,
      iobAuMoment: 0,
      hypoRiskScore: 1,
      hypoRiskLevel: 'low',
      modeNocturne: isNightMode(h),
    });

    expect(entry.id).toBeTruthy();
    expect(entry.date).toBeTruthy();
    expect(entry.modeNocturne).toBe(false); // 14h is not night
    expect(entry.hypoRiskLevel).toBe('low');

    // Retrieve and verify
    const retrieved = getEntries(1);
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].foods[0].name).toBe('Pain');

    // Stats should reflect the entry
    const stats = getStats(1);
    expect(stats.count).toBe(1);
    expect(stats.average).toBe(1.5);
  });

  // ── Flow 8: Pattern detection with sufficient data ───────────────────
  it('advanced pattern detection works with journal entries', () => {
    // Need at least 5 entries for patterns
    for (let i = 0; i < 6; i++) {
      addEntry({
        mealType: 'déjeuner',
        preMealGlycemia: 1.2 + (i * 0.1),
        totalCarbs: 30,
        doseCalculated: 3,
        doseInjected: 3,
      });
    }

    const entries = getEntries(30);
    expect(entries.length).toBe(6);

    // Should not throw even with minimal data
    const patterns = detectAdvancedPatterns(entries);
    expect(Array.isArray(patterns)).toBe(true);
  });

  // ── Flow 9: Dashboard data pipeline simulation ───────────────────────
  it('dashboard data pipeline: IOB computed from journal entries', () => {
    // Add a recent entry (simulating "just now")
    const entry = addEntry({
      mealType: 'déjeuner',
      preMealGlycemia: 1.3,
      totalCarbs: 40,
      doseCalculated: 4.0,
      doseInjected: 4.0,
    });

    // Simulate what Dashboard.jsx does
    const now = new Date();
    const recentEntries = getEntries(7);
    const lastEntry = recentEntries[0];
    expect(lastEntry).toBeTruthy();
    expect(lastEntry.id).toBe(entry.id);

    const iobTotal = recentEntries.reduce((sum, e) => {
      const entryTime = new Date(e.date).getTime();
      const minutesAgo = (now.getTime() - entryTime) / 60000;
      if (minutesAgo >= INSULIN_DURATION_MIN || minutesAgo < 0) return sum;
      const dose = e.doseInjected || e.doseCalculated || 0;
      if (dose <= 0) return sum;
      return sum + calcIOB(dose, minutesAgo, INSULIN_DURATION_MIN);
    }, 0);

    // Entry was just added, so IOB should be close to the full dose
    expect(iobTotal).toBeGreaterThan(3.5);
    expect(iobTotal).toBeLessThanOrEqual(4.0);
  });

  // ── Flow 10: Cumulative corrections trigger warning ──────────────────
  it('cumulative corrections in 24h trigger safety warning', () => {
    const safety = applySafetyRules({
      glycemia: 2.0, suggestedDose: 5.0, iobTotal: 1.0,
      currentHour: 14, lastInjectionMinAgo: 90,
      cumulCorrections24h: 6.0, // high cumulative corrections
      tddEstimated: 30, // 15% of 30 = 4.5, 6.0 > 4.5
      correction: 2.0, maxDose: 20,
    });
    expect(safety.warnings.some(w => w.type === 'cumul_high')).toBe(true);
    // Also should have timing_cap since lastInjection < 180min and correction > 1.0
    expect(safety.warnings.some(w => w.type === 'timing_cap')).toBe(true);
  });

  // ── Flow 11: Night mode + high glycemia reduces but doesn't block ────
  it('night mode with high glycemia reduces correction by 50%', () => {
    const safety = applySafetyRules({
      glycemia: 2.80, suggestedDose: 6.0, iobTotal: 0,
      currentHour: 23, lastInjectionMinAgo: 300,
      cumulCorrections24h: 0, tddEstimated: 30,
      correction: 3.0, maxDose: 20,
    });
    expect(safety.correctionBlocked).toBe(false);
    expect(safety.nightMode).toBe(true);
    // Correction should be reduced by 50%
    expect(safety.adjustedCorrection).toBe(round05(3.0 * 0.5));
    expect(safety.warnings.some(w => w.type === 'night_reduce')).toBe(true);
  });
});
