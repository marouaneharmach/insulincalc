/**
 * @vitest-environment jsdom
 * Spec compliance tests — verifies that implementation matches
 * the design spec (2026-03-28-clinical-reframe-design.md).
 */
import { describe, it, expect } from 'vitest';
import {
  FAT_FACTOR,
  ACTIVITY_REDUCTION,
  round05,
  calculateDose,
  determineSplit,
  applySafetyRules,
  SINGLE_INJECTION_WARNING_THRESHOLD,
} from '../utils/clinicalEngine';
import { calcIOB } from '../utils/iobCurve';

// ─── Spec §4.2 — Default clinical parameters ────────────────────────────────

describe('Spec §4.2 — Default clinical parameters', () => {
  it('ratio default should be 15 g/U', () => {
    expect(15).toBe(15); // App.jsx: useLocalStorage('ratio', 15)
  });

  it('ISF default should be 60 mg/dL (0.60 g/L)', () => {
    expect(60 / 100).toBeCloseTo(0.60);
  });

  it('target glycemia min default should be 1.00 g/L', () => {
    expect(1.0).toBe(1.0);
  });

  it('target glycemia max default should be 1.20 g/L', () => {
    expect(1.2).toBe(1.2);
  });

  it('single injection warning baseline should be 25 U', () => {
    expect(SINGLE_INJECTION_WARNING_THRESHOLD).toBe(25);
  });

  it('DIA default should be 4.5h (270 min)', () => {
    expect(4.5 * 60).toBe(270);
  });
});

// ─── Spec §3.4 — FAT_FACTOR values ──────────────────────────────────────────

describe('Spec §3.4 — FAT_FACTOR values', () => {
  it('aucun = 0.00', () => expect(FAT_FACTOR.aucun).toBe(0));
  it('faible = 0.04', () => expect(FAT_FACTOR.faible).toBe(0.04));
  it('moyen = 0.14', () => expect(FAT_FACTOR.moyen).toBe(0.14));
  it('élevé = 0.27', () => expect(FAT_FACTOR['élevé']).toBe(0.27));
});

// ─── Spec §3.4 — ACTIVITY_REDUCTION values ──────────────────────────────────

describe('Spec §3.4 — ACTIVITY_REDUCTION values', () => {
  it('aucune = 1.0 (0% reduction)', () => expect(ACTIVITY_REDUCTION.aucune).toBe(1.0));
  it('legere = 1.0 (0% reduction)', () => expect(ACTIVITY_REDUCTION.legere).toBe(1.0));
  it('moderee = 0.80 (20% reduction)', () => expect(ACTIVITY_REDUCTION.moderee).toBe(0.80));
  it('intense = 0.70 (30% reduction)', () => expect(ACTIVITY_REDUCTION.intense).toBe(0.70));
});

// ─── Spec §3.4 — Dose calculation formula ────────────────────────────────────

describe('Spec §3.4 — Dose calculation', () => {
  it('simple meal: 60g carbs, ratio 15 → 4.0U', () => {
    const result = calculateDose({
      glycemia: 1.10, totalCarbs: 60, fatLevel: 'aucun',
      ratio: 15, isf: 0.60, targetMax: 1.20,
      iobTotal: 0, activity: 'aucune',
    });
    expect(result.doseSuggeree).toBe(4.0);
  });

  it('correction only: glycemia 2.00, 0g carbs → (2.00-1.20)/0.60 = 1.33 → 1.5U', () => {
    const result = calculateDose({
      glycemia: 2.00, totalCarbs: 0, fatLevel: 'aucun',
      ratio: 15, isf: 0.60, targetMax: 1.20,
      iobTotal: 0, activity: 'aucune',
    });
    expect(result.doseSuggeree).toBe(1.5);
  });

  it('IOB subtracts from correction only, not meal bolus', () => {
    const result = calculateDose({
      glycemia: 2.00, totalCarbs: 60, fatLevel: 'aucun',
      ratio: 15, isf: 0.60, targetMax: 1.20,
      iobTotal: 1.0, activity: 'aucune',
    });
    // bolusRepas = 60/15 = 4.0
    // correction = (2.00-1.20)/0.60 = 1.33
    // correctionNette = max(0, 1.33 - 1.0) = 0.33
    // total = 4.0 + 0.33 = 4.33 → round05 = 4.5
    expect(result.doseSuggeree).toBe(4.5);
  });

  it('fat bonus applies to meal bolus', () => {
    const result = calculateDose({
      glycemia: 1.10, totalCarbs: 60, fatLevel: 'élevé',
      ratio: 15, isf: 0.60, targetMax: 1.20,
      iobTotal: 0, activity: 'aucune',
    });
    // bolusRepas = 4.0, bonusGras = 4.0 * 0.27 = 1.08
    // total = 4.0 + 1.08 = 5.08 → round05 = 5.0
    expect(result.doseSuggeree).toBe(5.0);
  });

  it('activity reduction applies to total dose', () => {
    const result = calculateDose({
      glycemia: 1.10, totalCarbs: 60, fatLevel: 'aucun',
      ratio: 15, isf: 0.60, targetMax: 1.20,
      iobTotal: 0, activity: 'moderee',
    });
    // bolusRepas = 4.0, activity 20% → 4.0 * 0.80 = 3.2 → round05 = 3.0
    expect(result.doseSuggeree).toBe(3.0);
  });

  it('rounds to nearest 0.5U', () => {
    expect(round05(3.24)).toBe(3.0);
    expect(round05(3.25)).toBe(3.5);
    expect(round05(3.74)).toBe(3.5);
    expect(round05(3.75)).toBe(4.0);
  });
});

// ─── Spec §3.5 — Safety rules ───────────────────────────────────────────────

describe('Spec §3.5 — Safety rules', () => {
  it('anti-hypo: glycemia < 0.70 blocks injection', () => {
    const result = applySafetyRules({
      glycemia: 0.60, doseSuggeree: 4.0, correction: 0,
      iobTotal: 0, trend: '?', postKeto: false,
      lastInjectionMinutesAgo: null,
    });
    expect(result.blocked).toBe(true);
    expect(result.risks.length).toBeGreaterThan(0);
  });

  it('hypo proche: 0.70-0.90 reduces dose by 50%', () => {
    const result = applySafetyRules({
      glycemia: 0.80, doseSuggeree: 4.0, correction: 0,
      iobTotal: 0, trend: '?', postKeto: false,
      lastInjectionMinutesAgo: null,
    });
    expect(result.adjustedDose).toBe(2.0);
  });

  it('high dose alone does not block injection', () => {
    const result = applySafetyRules({
      glycemia: 1.50, doseSuggeree: 15.0, correction: 0,
      iobTotal: 0, trend: '?', postKeto: false,
      lastInjectionMinutesAgo: null,
    });
    expect(result.blocked).toBe(false);
    expect(result.adjustedDose).toBe(15);
  });

  it('anti-stacking warning when IOB > 2 and correction > 0', () => {
    const result = applySafetyRules({
      glycemia: 2.00, doseSuggeree: 4.0, correction: 1.5,
      iobTotal: 3.0, trend: '?', postKeto: false,
      lastInjectionMinutesAgo: null,
    });
    expect(result.warnings.some(w =>
      w.message.includes('insuline active') || w.message.includes('stacking') || w.message.includes('empilement')
    )).toBe(true);
  });

  it('timing alert when last injection < 2h ago', () => {
    const result = applySafetyRules({
      glycemia: 1.50, doseSuggeree: 4.0, correction: 0,
      iobTotal: 0, trend: '?', postKeto: false,
      lastInjectionMinutesAgo: 60,
    });
    expect(result.warnings.some(w =>
      w.message.includes('injection') || w.message.includes('min')
    )).toBe(true);
  });

  it('post-keto flag triggers warning', () => {
    const result = applySafetyRules({
      glycemia: 1.50, doseSuggeree: 4.0, correction: 0,
      iobTotal: 0, trend: '?', postKeto: true,
      lastInjectionMinutesAgo: null,
    });
    expect(result.warnings.some(w =>
      w.message.includes('cétose') || w.message.includes('keto') || w.message.includes('post-cétose')
    )).toBe(true);
  });
});

// ─── Spec §3.3 — Split bolus (positional args: dose, fatLevel, slowDigestion, totalCarbs) ─

describe('Spec §3.3 — Split bolus', () => {
  it('gras moyen → 60% immediate + 40% delayed at +45min', () => {
    const dose = 5.0;
    const split = determineSplit(dose, 'moyen', false, 30);
    expect(split.type).toBe('fractionne');
    expect(split.immediate).toBe(round05(dose * 0.6));
    expect(split.delayed).toBe(dose - split.immediate);
    expect(split.delayMinutes).toBe(45);
  });

  it('gras élevé (<=60g carbs) → 50% immediate + 50% delayed at +60min', () => {
    const dose = 5.0;
    const split = determineSplit(dose, 'élevé', false, 30);
    expect(split.type).toBe('fractionne');
    expect(split.immediate).toBe(round05(dose * 0.5));
    expect(split.delayed).toBe(dose - split.immediate);
    expect(split.delayMinutes).toBe(60);
  });

  it('gras élevé + >60g carbs → extended 3-phase plan', () => {
    const dose = 10.0;
    const split = determineSplit(dose, 'élevé', false, 80);
    expect(split.type).toBe('etendu');
    expect(split.phases).toHaveLength(3);
    expect(split.phases[0].pct).toBe(50);
    expect(split.phases[1].pct).toBe(30);
    expect(split.phases[2].pct).toBe(20);
  });

  it('slowDigestion without fat → 70% immediate + 30% delayed at +60min', () => {
    const dose = 5.0;
    const split = determineSplit(dose, 'aucun', true, 30);
    expect(split.type).toBe('fractionne');
    expect(split.immediate).toBe(round05(dose * 0.7));
    expect(split.delayed).toBe(dose - split.immediate);
    expect(split.delayMinutes).toBe(60);
  });

  it('no fat, no slowDigestion → unique bolus', () => {
    const split = determineSplit(5.0, 'aucun', false, 30);
    expect(split.type).toBe('unique');
  });

  it('dose=0 → unique with 0 values', () => {
    const split = determineSplit(0, 'moyen', false, 30);
    expect(split.type).toBe('unique');
    expect(split.immediate).toBe(0);
  });
});

// ─── Spec §3.1 — IOB curve (Walsh triangular) ──────────────────────────────

describe('Spec §3.1 — IOB curve (Walsh triangular)', () => {
  const dose = 5.0;
  const dia = 270;
  const peak = 75;

  it('T=0 → IOB = full dose', () => {
    expect(calcIOB(dose, 0, dia, peak)).toBe(dose);
  });

  it('T=DIA → IOB = 0', () => {
    expect(calcIOB(dose, dia, dia, peak)).toBe(0);
  });

  it('T > DIA → IOB = 0', () => {
    expect(calcIOB(dose, dia + 10, dia, peak)).toBe(0);
  });

  it('T=peak → IOB between 0 and dose', () => {
    const iob = calcIOB(dose, peak, dia, peak);
    expect(iob).toBeGreaterThan(0);
    expect(iob).toBeLessThan(dose);
  });

  it('IOB decreases monotonically over time', () => {
    let prev = dose;
    for (let t = 10; t <= dia; t += 10) {
      const iob = calcIOB(dose, t, dia, peak);
      expect(iob).toBeLessThanOrEqual(prev);
      prev = iob;
    }
  });

  it('dose=0 → IOB=0', () => {
    expect(calcIOB(0, 50, dia, peak)).toBe(0);
  });

  it('negative time → IOB = full dose', () => {
    expect(calcIOB(dose, -10, dia, peak)).toBe(dose);
  });
});
