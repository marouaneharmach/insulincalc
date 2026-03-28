# InsulinCalc v5 — Clinical Reframe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform InsulinCalc from a dose calculator into a clinical diabetes coach with deterministic safety rules, IOB tracking, and a simplified 3-screen interface.

**Architecture:** Progressive refactoring of v4. New clinical engine module (pure functions, TDD). New Consultation screen replaces HomeScreen + MealBuilder. Navigation reduced to 3 tabs. All state via `useLocalStorage` hook (existing pattern). No new dependencies.

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-28-clinical-reframe-design.md`

---

## File Map

### New files to create
| File | Responsibility |
|------|---------------|
| `v4/src/utils/iobCurve.js` | Walsh IOB decay curve — single pure function |
| `v4/src/utils/clinicalEngine.js` | Dose calc, safety rules, split bolus, response generation |
| `v4/src/utils/migration.js` | v4→v5 localStorage data migration |
| `v4/src/utils/__tests__/iobCurve.test.js` | IOB curve tests |
| `v4/src/utils/__tests__/clinicalEngine.test.js` | Clinical engine tests |
| `v4/src/utils/__tests__/migration.test.js` | Migration tests |
| `v4/src/components/ConsultationScreen.jsx` | Main screen orchestrator |
| `v4/src/components/ClinicalResponse.jsx` | 4-bloc clinical response display |
| `v4/src/components/GlycemiaInput.jsx` | Glycemia field + trend selector |
| `v4/src/components/MealInput.jsx` | Expert/assisted mode toggle with food search + photo |
| `v4/src/components/ContextInput.jsx` | Activity selector + IOB display |
| `v4/src/components/BottomNav3.jsx` | New 3-tab bottom navigation |

### Files to modify
| File | Changes |
|------|---------|
| `v4/src/App.jsx` | Replace 4-tab nav with 3-tab, wire ConsultationScreen, add new profile state vars, run migration on mount |
| `v4/src/components/Settings.jsx` | Add profile medical fields (insulin types, post-keto flag, slow digestion flag, DIA) |
| `v4/src/components/Onboarding.jsx` | Simplify to 3 steps (profile, params, disclaimer) |
| `v4/src/components/DayTimeline.jsx` | Adapt to new journal entry format (tendance, activitePhysique, alertes, notes) |
| `v4/src/components/PdfExport.jsx` | Adapt to new data format |
| `v4/src/data/journalStore.js` | Add new fields to entry schema, update getStats |
| `v4/src/i18n/fr.js` | Add clinical response translation keys |
| `v4/src/i18n/ar.js` | Add clinical response translation keys (AR) |
| `v4/src/utils/notifications.js` | Support split bolus reminder notifications |

### Files to delete (after full migration)
`HomeScreen.jsx`, `MealBuilder.jsx`, `FoodCategory.jsx`, `FoodList.jsx`, `QtyStepper.jsx`, `QuickAddSheet.jsx`, `BottomNav.jsx`, `InjectionTracker.jsx`, `PostMealCorrector.jsx`, `ResultCard.jsx`, `TrendChart.jsx`

---

## Task 1: IOB Curve Module

**Files:**
- Create: `v4/src/utils/iobCurve.js`
- Create: `v4/src/utils/__tests__/iobCurve.test.js`

- [ ] **Step 1: Write failing tests for IOB curve**

```js
// v4/src/utils/__tests__/iobCurve.test.js
import { describe, it, expect } from 'vitest';
import { calcIOB } from '../iobCurve.js';

describe('calcIOB – Walsh model', () => {
  const DIA = 270; // 4h30 default

  it('returns full dose at T=0', () => {
    expect(calcIOB(4, 0, DIA)).toBeCloseTo(4, 1);
  });

  it('returns 0 when T >= DIA', () => {
    expect(calcIOB(4, 270, DIA)).toBe(0);
    expect(calcIOB(4, 300, DIA)).toBe(0);
  });

  it('returns 0 for dose=0', () => {
    expect(calcIOB(0, 60, DIA)).toBe(0);
  });

  it('decreases over time', () => {
    const iob60 = calcIOB(4, 60, DIA);
    const iob120 = calcIOB(4, 120, DIA);
    const iob200 = calcIOB(4, 200, DIA);
    expect(iob60).toBeGreaterThan(iob120);
    expect(iob120).toBeGreaterThan(iob200);
    expect(iob200).toBeGreaterThan(0);
  });

  it('is roughly 50% at midpoint', () => {
    const mid = calcIOB(4, 135, DIA);
    expect(mid).toBeGreaterThan(1.0);
    expect(mid).toBeLessThan(3.0);
  });

  it('clamps to [0, dose]', () => {
    // Near DIA boundary
    const nearEnd = calcIOB(4, 269, DIA);
    expect(nearEnd).toBeGreaterThanOrEqual(0);
    expect(nearEnd).toBeLessThanOrEqual(4);
  });

  it('handles negative minutes gracefully', () => {
    expect(calcIOB(4, -10, DIA)).toBeCloseTo(4, 1);
  });

  it('works with custom DIA', () => {
    const shortDIA = calcIOB(4, 120, 180); // 3h DIA
    const longDIA = calcIOB(4, 120, 360);  // 6h DIA
    expect(longDIA).toBeGreaterThan(shortDIA);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd v4 && npx vitest run src/utils/__tests__/iobCurve.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement IOB curve**

```js
// v4/src/utils/iobCurve.js

/**
 * Walsh model IOB decay curve for rapid-acting insulin (NovoRapid).
 * @param {number} dose - Units injected
 * @param {number} minutesElapsed - Minutes since injection
 * @param {number} dia - Duration of insulin action in minutes (default 270 = 4h30)
 * @returns {number} Remaining active insulin units
 */
export function calcIOB(dose, minutesElapsed, dia = 270) {
  if (dose <= 0) return 0;
  if (minutesElapsed <= 0) return dose;
  if (minutesElapsed >= dia) return 0;

  const T = minutesElapsed;
  const peak = 75; // NovoRapid peak at ~75 min
  const a = 2.0 * (dia - peak) / 5.0;
  const denom = a * (dia - T);

  // Guard near DIA boundary
  if (denom <= 0) return 0;

  const iob = dose * (1 - 0.5 * ((T * T) / denom));
  return Math.max(0, Math.min(dose, iob));
}

/**
 * Calculate total IOB from multiple recent injections.
 * @param {Array<{dose: number, minutesAgo: number}>} injections
 * @param {number} dia - Duration of insulin action in minutes
 * @returns {number} Total active insulin units
 */
export function calcTotalIOB(injections, dia = 270) {
  return injections.reduce((sum, inj) => sum + calcIOB(inj.dose, inj.minutesAgo, dia), 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v4 && npx vitest run src/utils/__tests__/iobCurve.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add v4/src/utils/iobCurve.js v4/src/utils/__tests__/iobCurve.test.js
git commit -m "feat: add Walsh IOB decay curve module with tests"
```

---

## Task 2: Clinical Engine — Dose Calculation & Safety Rules

**Files:**
- Create: `v4/src/utils/clinicalEngine.js`
- Create: `v4/src/utils/__tests__/clinicalEngine.test.js`

- [ ] **Step 1: Write failing tests for dose calculation**

```js
// v4/src/utils/__tests__/clinicalEngine.test.js
import { describe, it, expect } from 'vitest';
import { calculateDose, FAT_FACTOR, ACTIVITY_REDUCTION } from '../clinicalEngine.js';

describe('calculateDose', () => {
  const baseParams = {
    totalCarbs: 60,
    glycemia: 1.10, // in range
    ratio: 15,
    isf: 0.60,
    targetMax: 1.20,
    iobTotal: 0,
    fatLevel: 'aucun',
    activity: 'aucune',
    trend: '?',
    slowDigestion: false,
    postKeto: false,
    maxDose: 10,
  };

  it('calculates simple meal bolus without correction', () => {
    const result = calculateDose(baseParams);
    // 60/15 = 4.0u, no correction, no fat bonus
    expect(result.bolusRepas).toBeCloseTo(4.0);
    expect(result.correction).toBe(0);
    expect(result.doseSuggeree).toBe(4.0);
  });

  it('adds correction when glycemia > targetMax', () => {
    const result = calculateDose({ ...baseParams, glycemia: 1.80 });
    // bolus = 4.0, correction = (1.80 - 1.20) / 0.60 = 1.0
    expect(result.correction).toBeCloseTo(1.0);
    expect(result.doseSuggeree).toBe(5.0);
  });

  it('subtracts IOB from correction only', () => {
    const result = calculateDose({ ...baseParams, glycemia: 1.80, iobTotal: 0.5 });
    // correction = 1.0, correctionNette = 1.0 - 0.5 = 0.5
    // total = 4.0 + 0.5 = 4.5
    expect(result.correctionNette).toBeCloseTo(0.5);
    expect(result.doseSuggeree).toBe(4.5);
  });

  it('does not let IOB make correction negative', () => {
    const result = calculateDose({ ...baseParams, glycemia: 1.50, iobTotal: 3 });
    // correction = (1.50-1.20)/0.60 = 0.5, correctionNette = max(0, 0.5-3) = 0
    expect(result.correctionNette).toBe(0);
    expect(result.doseSuggeree).toBe(4.0);
  });

  it('applies fat bonus', () => {
    const result = calculateDose({ ...baseParams, fatLevel: 'moyen' });
    // bolus = 4.0, fat bonus = 4.0 * 0.14 = 0.56
    // total = 4.0 + 0 + 0.56 = 4.56 → rounded to 4.5
    expect(result.bonusGras).toBeCloseTo(0.56);
    expect(result.doseSuggeree).toBe(4.5);
  });

  it('reduces dose for moderate activity', () => {
    const result = calculateDose({ ...baseParams, activity: 'moderee' });
    // 4.0 * 0.80 = 3.2 → rounded to 3.0
    expect(result.doseSuggeree).toBe(3.0);
  });

  it('reduces dose for intense activity', () => {
    const result = calculateDose({ ...baseParams, activity: 'intense' });
    // 4.0 * 0.70 = 2.8 → rounded to 3.0
    expect(result.doseSuggeree).toBe(3.0);
  });

  it('rounds to nearest 0.5', () => {
    const result = calculateDose({ ...baseParams, totalCarbs: 37 });
    // 37/15 = 2.467 → rounded to 2.5
    expect(result.doseSuggeree).toBe(2.5);
  });
});

describe('FAT_FACTOR', () => {
  it('has correct values', () => {
    expect(FAT_FACTOR.aucun).toBe(0);
    expect(FAT_FACTOR.faible).toBe(0.04);
    expect(FAT_FACTOR.moyen).toBe(0.14);
    expect(FAT_FACTOR['élevé']).toBe(0.27);
  });
});

describe('ACTIVITY_REDUCTION', () => {
  it('has correct values', () => {
    expect(ACTIVITY_REDUCTION.aucune).toBe(1.0);
    expect(ACTIVITY_REDUCTION.legere).toBe(1.0);
    expect(ACTIVITY_REDUCTION.moderee).toBe(0.80);
    expect(ACTIVITY_REDUCTION.intense).toBe(0.70);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd v4 && npx vitest run src/utils/__tests__/clinicalEngine.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement dose calculation**

```js
// v4/src/utils/clinicalEngine.js

export const FAT_FACTOR = {
  aucun: 0, faible: 0.04, moyen: 0.14, 'élevé': 0.27,
};

export const ACTIVITY_REDUCTION = {
  aucune: 1.0, legere: 1.0, moderee: 0.80, intense: 0.70,
};

/** Round to nearest 0.5 */
export function round05(v) {
  return Math.round(v * 2) / 2;
}

/**
 * Core dose calculation.
 * @returns {{ bolusRepas, correction, correctionNette, bonusGras, doseBeforeActivity, doseSuggeree }}
 */
export function calculateDose({
  totalCarbs, glycemia, ratio, isf, targetMax, iobTotal,
  fatLevel, activity,
}) {
  const bolusRepas = totalCarbs / ratio;
  const correction = glycemia > targetMax
    ? (glycemia - targetMax) / isf
    : 0;
  const correctionNette = Math.max(0, correction - iobTotal);
  const bonusGras = bolusRepas * (FAT_FACTOR[fatLevel] || 0);
  const doseBeforeActivity = bolusRepas + correctionNette + bonusGras;
  const activityFactor = ACTIVITY_REDUCTION[activity] || 1.0;
  const doseSuggeree = round05(doseBeforeActivity * activityFactor);

  return { bolusRepas, correction, correctionNette, bonusGras, doseBeforeActivity, doseSuggeree };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v4 && npx vitest run src/utils/__tests__/clinicalEngine.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add v4/src/utils/clinicalEngine.js v4/src/utils/__tests__/clinicalEngine.test.js
git commit -m "feat: add clinical engine dose calculation with tests"
```

---

## Task 3: Clinical Engine — Safety Rules

**Files:**
- Modify: `v4/src/utils/clinicalEngine.js`
- Modify: `v4/src/utils/__tests__/clinicalEngine.test.js`

- [ ] **Step 1: Write failing tests for safety rules**

Add to `clinicalEngine.test.js`:

```js
import { applySafetyRules } from '../clinicalEngine.js';

describe('applySafetyRules', () => {
  const baseContext = {
    glycemia: 1.10,
    doseSuggeree: 4.0,
    correction: 0,
    iobTotal: 0,
    trend: '?',
    activity: 'aucune',
    postKeto: false,
    maxDose: 10,
    lastInjectionMinutesAgo: null,
  };

  it('blocks injection and suggests resucrage for severe hypo', () => {
    const result = applySafetyRules({ ...baseContext, glycemia: 0.55, doseSuggeree: 2 });
    expect(result.blocked).toBe(true);
    expect(result.risks).toContainEqual(expect.objectContaining({ type: 'anti-hypo' }));
    expect(result.adjustedDose).toBe(0);
  });

  it('reduces dose 50% for near-hypo (0.70-0.90)', () => {
    const result = applySafetyRules({ ...baseContext, glycemia: 0.80, doseSuggeree: 4.0 });
    expect(result.adjustedDose).toBe(2.0);
    expect(result.risks).toContainEqual(expect.objectContaining({ type: 'hypo-proche' }));
  });

  it('warns about stacking when IOB > 2u and correction present', () => {
    const result = applySafetyRules({ ...baseContext, iobTotal: 3, correction: 1 });
    expect(result.warnings).toContainEqual(expect.objectContaining({ type: 'anti-stacking' }));
  });

  it('warns about timing when last injection < 2h ago', () => {
    const result = applySafetyRules({ ...baseContext, lastInjectionMinutesAgo: 90 });
    expect(result.warnings).toContainEqual(expect.objectContaining({ type: 'alerte-timing' }));
  });

  it('blocks overdose and requires confirmation', () => {
    const result = applySafetyRules({ ...baseContext, doseSuggeree: 12, maxDose: 10 });
    expect(result.blocked).toBe(true);
    expect(result.risks).toContainEqual(expect.objectContaining({ type: 'surdosage' }));
  });

  it('reduces correction 50% when trend is falling', () => {
    const result = applySafetyRules({
      ...baseContext, glycemia: 1.80, doseSuggeree: 5.0, correction: 1.0, trend: '↓',
    });
    expect(result.adjustedDose).toBeLessThan(5.0);
    expect(result.warnings).toContainEqual(expect.objectContaining({ type: 'sur-correction' }));
  });

  it('ignores trend rules when trend is unknown', () => {
    const result = applySafetyRules({
      ...baseContext, glycemia: 1.80, doseSuggeree: 5.0, correction: 1.0, trend: '?',
    });
    expect(result.warnings.find(w => w.type === 'sur-correction')).toBeUndefined();
  });

  it('adds post-keto warning when flag is on', () => {
    const result = applySafetyRules({ ...baseContext, postKeto: true });
    expect(result.warnings).toContainEqual(expect.objectContaining({ type: 'post-keto' }));
  });

  it('returns no issues for normal situation', () => {
    const result = applySafetyRules(baseContext);
    expect(result.blocked).toBe(false);
    expect(result.risks).toHaveLength(0);
    expect(result.adjustedDose).toBe(4.0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd v4 && npx vitest run src/utils/__tests__/clinicalEngine.test.js`
Expected: FAIL — `applySafetyRules` not found

- [ ] **Step 3: Implement safety rules**

Add to `v4/src/utils/clinicalEngine.js`:

```js
const FALLING_TRENDS = ['↓', '↘'];

/**
 * Apply safety rules to a calculated dose.
 * @returns {{ blocked, adjustedDose, risks: Array<{type, message}>, warnings: Array<{type, message}> }}
 */
export function applySafetyRules({
  glycemia, doseSuggeree, correction, iobTotal, trend,
  activity, postKeto, maxDose, lastInjectionMinutesAgo,
}) {
  const risks = [];
  const warnings = [];
  let adjustedDose = doseSuggeree;
  let blocked = false;

  // Anti-hypo: block everything
  if (glycemia < 0.70) {
    blocked = true;
    adjustedDose = 0;
    risks.push({ type: 'anti-hypo', message: 'Glycémie très basse. Ne pas injecter. Prendre 15g de sucre rapide.' });
    return { blocked, adjustedDose, risks, warnings };
  }

  // Near-hypo: reduce total dose 50%
  if (glycemia >= 0.70 && glycemia < 0.90) {
    adjustedDose = round05(doseSuggeree * 0.5);
    risks.push({ type: 'hypo-proche', message: 'Glycémie basse. Dose réduite de 50%.' });
  }

  // Overdose check
  if (adjustedDose > maxDose) {
    blocked = true;
    risks.push({ type: 'surdosage', message: `Dose (${adjustedDose}u) dépasse le seuil de sécurité (${maxDose}u).` });
  }

  // Falling trend + correction → reduce correction 50%
  const trendKnown = trend && trend !== '?' && trend !== null;
  if (trendKnown && FALLING_TRENDS.includes(trend) && correction > 0) {
    const reductionCorrection = round05(correction * 0.5);
    adjustedDose = round05(adjustedDose - reductionCorrection);
    warnings.push({ type: 'sur-correction', message: 'Tendance à la baisse. Correction réduite.' });
  }

  // Anti-stacking warning
  if (iobTotal > 2 && correction > 0) {
    warnings.push({ type: 'anti-stacking', message: `${round05(iobTotal)}u d'insuline encore active. IOB déjà soustraite de la correction.` });
  }

  // Timing warning
  if (lastInjectionMinutesAgo !== null && lastInjectionMinutesAgo < 120) {
    warnings.push({ type: 'alerte-timing', message: 'Dernière injection il y a moins de 2h. Prudence.' });
  }

  // Post-keto warning
  if (postKeto) {
    warnings.push({ type: 'post-keto', message: 'Profil post-keto : attention aux hausses retardées après repas riches en protéines/graisses.' });
  }

  return { blocked, adjustedDose, risks, warnings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v4 && npx vitest run src/utils/__tests__/clinicalEngine.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add v4/src/utils/clinicalEngine.js v4/src/utils/__tests__/clinicalEngine.test.js
git commit -m "feat: add safety rules to clinical engine with tests"
```

---

## Task 4: Clinical Engine — Split Bolus & Response Generation

**Files:**
- Modify: `v4/src/utils/clinicalEngine.js`
- Modify: `v4/src/utils/__tests__/clinicalEngine.test.js`

- [ ] **Step 1: Write failing tests for split bolus**

Add to `clinicalEngine.test.js`:

```js
import { determineSplit, analyzeAndRecommend } from '../clinicalEngine.js';

describe('determineSplit', () => {
  it('returns unique bolus for low fat without slow digestion', () => {
    const result = determineSplit(4.0, 'faible', false);
    expect(result.type).toBe('unique');
    expect(result.immediate).toBe(4.0);
  });

  it('splits 60/40 for medium fat', () => {
    const result = determineSplit(4.0, 'moyen', false);
    expect(result.type).toBe('fractionne');
    expect(result.immediate).toBe(2.5); // round05(4.0*0.6) = 2.5
    expect(result.delayed).toBe(1.5);
    expect(result.delayMinutes).toBe(45);
  });

  it('splits 50/50 for high fat', () => {
    const result = determineSplit(4.0, 'élevé', false);
    expect(result.type).toBe('fractionne');
    expect(result.immediate).toBe(2.0);
    expect(result.delayed).toBe(2.0);
    expect(result.delayMinutes).toBe(60);
  });

  it('splits 70/30 for slow digestion alone', () => {
    const result = determineSplit(4.0, 'faible', true);
    expect(result.type).toBe('fractionne');
    expect(result.immediate).toBe(3.0); // round05(4.0*0.7) = 3.0
    expect(result.delayed).toBe(1.0);
    expect(result.delayMinutes).toBe(60);
  });

  it('uses fat scheme when both slow digestion and high fat', () => {
    const result = determineSplit(4.0, 'élevé', true);
    expect(result.type).toBe('fractionne');
    expect(result.immediate).toBe(2.0); // fat scheme takes priority
    expect(result.delayed).toBe(2.0);
  });

  it('returns unique for zero dose', () => {
    const result = determineSplit(0, 'élevé', true);
    expect(result.type).toBe('unique');
    expect(result.immediate).toBe(0);
  });
});

describe('analyzeAndRecommend', () => {
  it('returns all 4 sections of clinical response', () => {
    const result = analyzeAndRecommend({
      glycemia: 1.40, trend: '→', totalCarbs: 60, fatLevel: 'faible',
      activity: 'aucune', ratio: 15, isf: 0.60, targetMin: 1.00, targetMax: 1.20,
      iobTotal: 0, lastInjectionMinutesAgo: null, slowDigestion: false,
      postKeto: false, maxDose: 10, lang: 'fr',
    });
    expect(result).toHaveProperty('analysis');
    expect(result).toHaveProperty('recommendation');
    expect(result).toHaveProperty('vigilance');
    expect(result).toHaveProperty('nextStep');
    expect(result.recommendation.dose).toBeGreaterThan(0);
  });

  it('blocks and recommends resucrage for hypo', () => {
    const result = analyzeAndRecommend({
      glycemia: 0.55, trend: '↓', totalCarbs: 0, fatLevel: 'aucun',
      activity: 'aucune', ratio: 15, isf: 0.60, targetMin: 1.00, targetMax: 1.20,
      iobTotal: 0, lastInjectionMinutesAgo: null, slowDigestion: false,
      postKeto: false, maxDose: 10, lang: 'fr',
    });
    expect(result.recommendation.dose).toBe(0);
    expect(result.vigilance.risks.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd v4 && npx vitest run src/utils/__tests__/clinicalEngine.test.js`
Expected: FAIL — functions not found

- [ ] **Step 3: Implement split bolus and response generation**

Add to `v4/src/utils/clinicalEngine.js`:

```js
const SPLIT_SCHEMAS = {
  moyen:    { immediatePct: 0.60, delayMin: 45 },
  'élevé': { immediatePct: 0.50, delayMin: 60 },
  digestion:{ immediatePct: 0.70, delayMin: 60 },
};

/**
 * Determine if bolus should be split and how.
 */
export function determineSplit(dose, fatLevel, slowDigestion) {
  if (dose <= 0) return { type: 'unique', immediate: 0, delayed: 0, delayMinutes: 0 };

  let schema = null;
  if (fatLevel === 'élevé' || fatLevel === 'moyen') {
    schema = SPLIT_SCHEMAS[fatLevel];
  } else if (slowDigestion) {
    schema = SPLIT_SCHEMAS.digestion;
  }

  if (!schema) return { type: 'unique', immediate: dose, delayed: 0, delayMinutes: 0 };

  const immediate = round05(dose * schema.immediatePct);
  const delayed = round05(dose - immediate);
  return { type: 'fractionne', immediate, delayed, delayMinutes: schema.delayMin };
}

/** Classify glycemia status */
function glycemiaStatus(g, targetMin, targetMax) {
  if (g < 0.54) return 'hypo-severe';
  if (g < 0.70) return 'hypo';
  if (g < 0.90) return 'hypo-proche';
  if (g >= targetMin && g <= targetMax) return 'cible';
  if (g > targetMax && g <= 1.80) return 'elevee';
  if (g > 1.80 && g <= 2.50) return 'haute';
  if (g > 2.50) return 'hyper-severe';
  return 'sous-cible'; // 0.90 - targetMin
}

/** Time slot from hour */
function getTimeSlot(hour) {
  if (hour >= 6 && hour < 12) return 'matin';
  if (hour >= 12 && hour < 18) return 'midi';
  if (hour >= 18 && hour < 23) return 'soir';
  return 'nuit';
}

/**
 * Main clinical analysis function.
 * @returns {{ analysis, recommendation, vigilance, nextStep }}
 */
export function analyzeAndRecommend({
  glycemia, trend, totalCarbs, fatLevel, activity,
  ratio, isf, targetMin, targetMax, iobTotal,
  lastInjectionMinutesAgo, slowDigestion, postKeto, maxDose,
}) {
  const status = glycemiaStatus(glycemia, targetMin, targetMax);

  // Calculate dose
  const doseResult = calculateDose({
    totalCarbs, glycemia, ratio, isf, targetMax, iobTotal,
    fatLevel, activity,
  });

  // Apply safety rules
  const safety = applySafetyRules({
    glycemia, doseSuggeree: doseResult.doseSuggeree, correction: doseResult.correction,
    iobTotal, trend, activity, postKeto, maxDose, lastInjectionMinutesAgo,
  });

  // Determine split
  const split = determineSplit(safety.adjustedDose, fatLevel, slowDigestion);

  // Determine timing
  let timing = 'immédiat';
  if (split.type === 'fractionne') timing = 'fractionné';

  // Next step
  let checkTime = 120; // default: check in 2h
  if (status === 'hypo' || status === 'hypo-severe') checkTime = 15;
  else if (status === 'hypo-proche') checkTime = 30;
  else if (safety.warnings.some(w => w.type === 'alerte-timing')) checkTime = 60;

  return {
    analysis: {
      glycemiaStatus: status,
      iob: round05(iobTotal),
      trend: trend || '?',
      totalCarbs,
      fatLevel,
    },
    recommendation: {
      dose: safety.adjustedDose,
      timing,
      split,
      blocked: safety.blocked,
      reasoning: doseResult,
    },
    vigilance: {
      risks: safety.risks,
      warnings: safety.warnings,
    },
    nextStep: {
      checkTime,
      instruction: status.startsWith('hypo')
        ? `Recontrôler dans ${checkTime} min après resucrage`
        : `Recontrôler la glycémie dans ${checkTime} min`,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v4 && npx vitest run src/utils/__tests__/clinicalEngine.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add v4/src/utils/clinicalEngine.js v4/src/utils/__tests__/clinicalEngine.test.js
git commit -m "feat: add split bolus and response generation to clinical engine"
```

---

## Task 5: Data Migration (v4 → v5)

**Files:**
- Create: `v4/src/utils/migration.js`
- Create: `v4/src/utils/__tests__/migration.test.js`

- [ ] **Step 1: Write failing tests**

```js
// v4/src/utils/__tests__/migration.test.js
import { describe, it, expect } from 'vitest';
import { migrateEntry, needsMigration } from '../migration.js';

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
    id: '123', date: '2026-03-20', mealType: 'dejeuner',
    preMealGlycemia: 1.30, foods: [{ id: 'khobz', name: 'Khobz' }],
    totalCarbs: 60, doseCalculated: 4.0, doseInjected: 4.0,
    postMealGlycemia: null, schedule: [],
  };

  it('adds missing v5 fields with defaults', () => {
    const migrated = migrateEntry(v4Entry);
    expect(migrated.tendance).toBeNull();
    expect(migrated.iobAuMoment).toBeNull();
    expect(migrated.activitePhysique).toBe('aucune');
    expect(migrated.alertes).toEqual([]);
    expect(migrated.notes).toBe('');
    expect(migrated.niveauGras).toBe('aucun');
    expect(migrated.bolusType).toBe('unique');
  });

  it('maps old field names to new ones', () => {
    const migrated = migrateEntry(v4Entry);
    expect(migrated.glycPre).toBe(1.30);
    expect(migrated.doseSuggeree).toBe(4.0);
    expect(migrated.doseReelle).toBe(4.0);
    expect(migrated.aliments).toEqual(v4Entry.foods);
    expect(migrated.heure).toBeDefined();
  });

  it('preserves existing v5 fields if already present', () => {
    const v5Entry = { ...v4Entry, tendance: '→', activitePhysique: 'legere' };
    const migrated = migrateEntry(v5Entry);
    expect(migrated.tendance).toBe('→');
    expect(migrated.activitePhysique).toBe('legere');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd v4 && npx vitest run src/utils/__tests__/migration.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement migration**

```js
// v4/src/utils/migration.js

/**
 * Check if data needs migration to v5 format.
 */
export function needsMigration(appVersion) {
  if (!appVersion) return true;
  const major = parseInt(appVersion.split('.')[0], 10);
  return major < 5;
}

/**
 * Migrate a single journal entry from v4 to v5 format.
 */
export function migrateEntry(entry) {
  return {
    // Preserve existing fields
    id: entry.id,
    date: entry.date,
    // Map old → new field names (fallback to v5 if already present)
    heure: entry.heure || entry.date?.split('T')[1]?.substring(0, 5) || '12:00',
    glycPre: entry.glycPre ?? entry.preMealGlycemia ?? null,
    glycPost: entry.glycPost ?? entry.postMealGlycemia ?? null,
    totalGlucides: entry.totalGlucides ?? entry.totalCarbs ?? 0,
    aliments: entry.aliments ?? entry.foods ?? null,
    doseSuggeree: entry.doseSuggeree ?? entry.doseCalculated ?? 0,
    doseReelle: entry.doseReelle ?? entry.doseInjected ?? 0,
    // New v5 fields with defaults
    tendance: entry.tendance ?? null,
    niveauGras: entry.niveauGras ?? 'aucun',
    iobAuMoment: entry.iobAuMoment ?? null,
    bolusType: entry.bolusType ?? 'unique',
    activitePhysique: entry.activitePhysique ?? 'aucune',
    alertes: entry.alertes ?? [],
    notes: entry.notes ?? '',
  };
}

/**
 * Migrate all journal entries in localStorage.
 * @param {Array} entries - Current entries
 * @returns {Array} Migrated entries
 */
export function migrateAllEntries(entries) {
  return entries.map(migrateEntry);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v4 && npx vitest run src/utils/__tests__/migration.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add v4/src/utils/migration.js v4/src/utils/__tests__/migration.test.js
git commit -m "feat: add v4-to-v5 data migration module with tests"
```

---

## Task 6: i18n — Clinical Response Translation Keys

**Files:**
- Modify: `v4/src/i18n/fr.js`
- Modify: `v4/src/i18n/ar.js`

- [ ] **Step 1: Add French clinical keys**

Add the following keys to `v4/src/i18n/fr.js` in the exported object:

```js
// Clinical response
cl_analyse: 'Analyse',
cl_recommandation: 'Recommandation',
cl_vigilance: 'Vigilance',
cl_prochaineEtape: 'Prochaine étape',
cl_analyser: 'Analyser',

// Glycemia status
cl_hypoSevere: 'Hypoglycémie sévère',
cl_hypo: 'Hypoglycémie',
cl_hypoProche: 'Glycémie basse',
cl_cible: 'Dans la cible',
cl_elevee: 'Glycémie élevée',
cl_haute: 'Glycémie haute',
cl_hyperSevere: 'Hyperglycémie sévère',
cl_sousCible: 'Sous la cible',

// Recommendation
cl_doseUnique: 'Injection unique',
cl_doseFractionnee: 'Injection fractionnée',
cl_immediat: 'immédiat',
cl_differe: 'différé',
cl_fractionne: 'fractionné',
cl_bolusRepas: 'Bolus repas',
cl_correction: 'Correction',
cl_bonusGras: 'Bonus gras',
cl_iobSoustraite: 'IOB soustraite',

// Safety
cl_antiHypo: 'Ne pas injecter. Prendre 15g de sucre rapide.',
cl_hypoProcheDose: 'Dose réduite de 50% (glycémie basse).',
cl_antiStacking: 'insuline encore active. IOB déjà soustraite de la correction.',
cl_alerteTiming: 'Dernière injection il y a moins de 2h. Prudence.',
cl_surdosage: 'Dose dépasse le seuil de sécurité.',
cl_surCorrection: 'Tendance à la baisse. Correction réduite.',
cl_postKeto: 'Profil post-keto : attention aux hausses retardées.',
cl_activiteModere: 'Activité modérée : dose réduite de 20%.',
cl_activiteIntense: 'Activité intense : dose réduite de 30%.',

// Next step
cl_recontrole: 'Recontrôler la glycémie dans',
cl_recontroleResucrage: 'Recontrôler dans {min} min après resucrage',
cl_minutes: 'min',

// IOB
cl_iobActive: 'Insuline active',
cl_unites: 'u',

// Context
cl_activite: 'Activité physique',
cl_aucune: 'Aucune',
cl_legere: 'Légère',
cl_moderee: 'Modérée',
cl_intense: 'Intense',

// Trend
cl_tendance: 'Tendance',
cl_tendanceInconnue: 'Inconnue',

// Meal input
cl_modeExpert: 'Glucides directs',
cl_modeAssiste: 'Base alimentaire',
cl_glucidesTotal: 'Glucides totaux (g)',
cl_niveauGras: 'Niveau de gras',

// Settings - new fields
cl_insulineBasale: 'Insuline basale',
cl_insulineRapide: 'Insuline rapide',
cl_doseBasale: 'Dose basale quotidienne',
cl_profilPostKeto: 'Profil post-keto',
cl_digestionLente: 'Digestion lente habituelle',
cl_dureeAction: "Durée d'action insuline rapide",

// Consultation
cl_consultation: 'Consultation',
cl_journal: 'Journal',
cl_reglages: 'Réglages',
```

- [ ] **Step 2: Add Arabic clinical keys**

Add equivalent keys to `v4/src/i18n/ar.js` with Arabic translations. Read the existing `ar.js` file first to match the pattern, then add:

```js
cl_analyse: 'التحليل',
cl_recommandation: 'التوصية',
cl_vigilance: 'الحذر',
cl_prochaineEtape: 'الخطوة التالية',
cl_analyser: 'تحليل',
cl_hypoSevere: 'انخفاض حاد في السكر',
cl_hypo: 'انخفاض السكر',
cl_hypoProche: 'سكر منخفض',
cl_cible: 'في النطاق المستهدف',
cl_elevee: 'سكر مرتفع',
cl_haute: 'سكر مرتفع جداً',
cl_hyperSevere: 'ارتفاع حاد في السكر',
cl_sousCible: 'تحت المستهدف',
cl_doseUnique: 'حقنة واحدة',
cl_doseFractionnee: 'حقنة مجزأة',
cl_immediat: 'فوري',
cl_differe: 'مؤجل',
cl_fractionne: 'مجزأ',
cl_bolusRepas: 'جرعة الوجبة',
cl_correction: 'التصحيح',
cl_bonusGras: 'إضافة الدهون',
cl_iobSoustraite: 'الأنسولين النشط المخصوم',
cl_antiHypo: 'لا تحقن. تناول 15غ من السكر السريع.',
cl_hypoProcheDose: 'الجرعة مخفضة 50% (سكر منخفض).',
cl_antiStacking: 'أنسولين نشط. تم خصمه من التصحيح.',
cl_alerteTiming: 'آخر حقنة منذ أقل من ساعتين. توخ الحذر.',
cl_surdosage: 'الجرعة تتجاوز حد الأمان.',
cl_surCorrection: 'اتجاه نحو الانخفاض. تصحيح مخفض.',
cl_postKeto: 'نظام كيتو سابق: انتبه للارتفاعات المتأخرة.',
cl_activiteModere: 'نشاط معتدل: جرعة مخفضة 20%.',
cl_activiteIntense: 'نشاط مكثف: جرعة مخفضة 30%.',
cl_recontrole: 'أعد قياس السكر خلال',
cl_minutes: 'د',
cl_iobActive: 'الأنسولين النشط',
cl_unites: 'و',
cl_activite: 'النشاط البدني',
cl_aucune: 'لا شيء',
cl_legere: 'خفيف',
cl_moderee: 'معتدل',
cl_intense: 'مكثف',
cl_tendance: 'الاتجاه',
cl_tendanceInconnue: 'غير معروف',
cl_modeExpert: 'كربوهيدرات مباشرة',
cl_modeAssiste: 'قاعدة الأغذية',
cl_glucidesTotal: 'إجمالي الكربوهيدرات (غ)',
cl_niveauGras: 'مستوى الدهون',
cl_insulineBasale: 'الأنسولين القاعدي',
cl_insulineRapide: 'الأنسولين السريع',
cl_doseBasale: 'الجرعة القاعدية اليومية',
cl_profilPostKeto: 'نظام كيتو سابق',
cl_digestionLente: 'هضم بطيء معتاد',
cl_dureeAction: 'مدة تأثير الأنسولين السريع',
cl_consultation: 'الاستشارة',
cl_journal: 'السجل',
cl_reglages: 'الإعدادات',
cl_postPrandialGood: 'تصحيح جيد',
cl_postPrandialUnder: 'تصحيح ناقص',
cl_postPrandialOver: 'تصحيح زائد',
```

- [ ] **Step 3: Commit**

```bash
git add v4/src/i18n/fr.js v4/src/i18n/ar.js
git commit -m "feat: add clinical response i18n keys (FR + AR)"
```

---

## Task 7: Settings — New Profile Fields

**Files:**
- Modify: `v4/src/components/Settings.jsx`
- Modify: `v4/src/App.jsx` (add new state variables)

- [ ] **Step 1: Add new state variables to App.jsx**

Read `v4/src/App.jsx` and add these new `useLocalStorage` state variables alongside existing ones:

```js
const [insulinBasal, setInsulinBasal] = useLocalStorage('insulinBasal', 'Tresiba');
const [insulinRapid, setInsulinRapid] = useLocalStorage('insulinRapid', 'NovoRapid');
const [basalDose, setBasalDose] = useLocalStorage('basalDose', 12);
const [postKeto, setPostKeto] = useLocalStorage('postKeto', false);
const [slowDigestion, setSlowDigestion] = useLocalStorage('slowDigestion', false);
const [dia, setDia] = useLocalStorage('dia', 4.5); // hours
```

- [ ] **Step 2: Add profile fields to Settings.jsx**

Read `v4/src/components/Settings.jsx` and add a new "Profil médical" section with:
- Text inputs for `insulinBasal` and `insulinRapid` (free text)
- Number input for `basalDose` (range 1-100)
- Toggle switches for `postKeto` and `slowDigestion`
- Number input for `dia` (range 2-8 hours, step 0.5)

Follow the existing UI pattern in Settings.jsx (Tailwind classes, `t()` for labels, slider/input patterns).

- [ ] **Step 3: Verify settings render correctly**

Run: `cd v4 && npm run dev`
Open browser, navigate to Settings tab, verify new fields appear and save to localStorage.

- [ ] **Step 4: Commit**

```bash
git add v4/src/App.jsx v4/src/components/Settings.jsx
git commit -m "feat: add medical profile fields to settings (insulin types, post-keto, DIA)"
```

---

## Task 8: Onboarding — Simplify to 3 Steps

**Files:**
- Modify: `v4/src/components/Onboarding.jsx`

- [ ] **Step 1: Read current Onboarding.jsx**

Read `v4/src/components/Onboarding.jsx` fully to understand the current 3-step flow.

- [ ] **Step 2: Simplify the onboarding**

Modify the Onboarding component:
- **Step 1 (Profil)**: Keep age, poids, sexe, taille. Add type d'insuline basale + rapide.
- **Step 2 (Paramètres)**: Keep ratio, ISF, cible. Pre-fill with defaults.
- **Step 3 (Disclaimer)**: Keep the medical disclaimer with mandatory acceptance.

Remove any extra steps or fields that don't match the spec. Pass new profile fields to `onComplete()`.

- [ ] **Step 3: Test manually**

Run: `cd v4 && npm run dev`
Clear localStorage, open app → verify onboarding appears with 3 simplified steps.

- [ ] **Step 4: Commit**

```bash
git add v4/src/components/Onboarding.jsx
git commit -m "feat: simplify onboarding to 3 steps (profile, params, disclaimer)"
```

---

## Task 9: New UI Components — GlycemiaInput, MealInput, ContextInput

**Files:**
- Create: `v4/src/components/GlycemiaInput.jsx`
- Create: `v4/src/components/MealInput.jsx`
- Create: `v4/src/components/ContextInput.jsx`

- [ ] **Step 1: Create GlycemiaInput**

```jsx
// v4/src/components/GlycemiaInput.jsx
import { useI18n } from '../i18n/useI18n';

const TRENDS = ['↑', '↗', '→', '↘', '↓', '?'];

export default function GlycemiaInput({ glycemia, setGlycemia, trend, setTrend, hour, setHour, t }) {
  // Auto-convert mg/dL → g/L
  const handleGlycemia = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) { setGlycemia(''); return; }
    if (n >= 30) setGlycemia((n / 100).toFixed(2)); // mg/dL
    else setGlycemia(val);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium opacity-70">{t('cl_analyse') || 'Glycémie'}</label>
      <div className="flex gap-2">
        <input
          type="number" step="0.01" inputMode="decimal"
          value={glycemia} onChange={e => handleGlycemia(e.target.value)}
          placeholder="1.10" className="flex-1 rounded-lg border p-3 text-lg bg-white/5"
        />
        <span className="self-center text-sm opacity-60">g/L</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm opacity-70">{t('cl_tendance') || 'Tendance'}</span>
        <div className="flex gap-1">
          {TRENDS.map(tr => (
            <button key={tr} onClick={() => setTrend(tr)}
              className={`w-9 h-9 rounded-full text-lg ${trend === tr ? 'bg-blue-500 text-white' : 'bg-white/10'}`}>
              {tr}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm opacity-70">Heure</span>
        <input type="time" value={hour} onChange={e => setHour(e.target.value)}
          className="rounded-lg border p-2 bg-white/5" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create MealInput**

```jsx
// v4/src/components/MealInput.jsx
import { useState } from 'react';

const FAT_LEVELS = ['aucun', 'faible', 'moyen', 'élevé'];

export default function MealInput({
  totalCarbs, setTotalCarbs, fatLevel, setFatLevel,
  foods, selections, toggleFood, updateMult, customFoods,
  onPhotoMeal, t,
}) {
  const [mode, setMode] = useState('expert'); // 'expert' | 'assiste'

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex rounded-lg overflow-hidden border">
        <button onClick={() => setMode('expert')}
          className={`flex-1 py-2 text-sm ${mode === 'expert' ? 'bg-blue-500 text-white' : 'bg-white/5'}`}>
          {t('cl_modeExpert') || 'Glucides directs'}
        </button>
        <button onClick={() => setMode('assiste')}
          className={`flex-1 py-2 text-sm ${mode === 'assiste' ? 'bg-blue-500 text-white' : 'bg-white/5'}`}>
          {t('cl_modeAssiste') || 'Base alimentaire'}
        </button>
      </div>

      {mode === 'expert' ? (
        <div className="space-y-3">
          <input type="number" inputMode="numeric" value={totalCarbs || ''}
            onChange={e => setTotalCarbs(parseFloat(e.target.value) || 0)}
            placeholder="Glucides (g)"
            className="w-full rounded-lg border p-3 text-lg bg-white/5" />

          <div>
            <span className="text-sm opacity-70">{t('cl_niveauGras') || 'Niveau de gras'}</span>
            <div className="flex gap-2 mt-1">
              {FAT_LEVELS.map(level => (
                <button key={level} onClick={() => setFatLevel(level)}
                  className={`flex-1 py-2 rounded-lg text-xs ${fatLevel === level ? 'bg-blue-500 text-white' : 'bg-white/10'}`}>
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Food search with autocomplete — uses existing foods data */}
          <FoodSearch foods={foods} selections={selections}
            toggleFood={toggleFood} updateMult={updateMult}
            customFoods={customFoods} t={t} />

          {/* Photo button */}
          {onPhotoMeal && (
            <button onClick={onPhotoMeal}
              className="w-full py-2 rounded-lg border text-sm opacity-70">
              📷 {t('v4_photoMealBtn') || 'Reconnaître par photo'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Inline food search with autocomplete */
function FoodSearch({ foods, selections, toggleFood, updateMult, customFoods, t }) {
  const [query, setQuery] = useState('');
  const allFoods = [...foods, ...(customFoods || [])];
  const filtered = query.length >= 2
    ? allFoods.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : [];

  const selected = allFoods.filter(f => selections[f.id]);

  return (
    <div>
      <input type="text" value={query} onChange={e => setQuery(e.target.value)}
        placeholder={t('v4_searchFood') || 'Rechercher un aliment...'}
        className="w-full rounded-lg border p-3 bg-white/5" />

      {filtered.length > 0 && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border bg-white/5">
          {filtered.map(f => (
            <button key={f.id} onClick={() => { toggleFood(f); setQuery(''); }}
              className="w-full text-left p-2 text-sm hover:bg-white/10">
              {f.name} — {f.carbs}g
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-2 space-y-1">
          {selected.map(f => (
            <div key={f.id} className="flex justify-between items-center p-2 rounded bg-white/5 text-sm">
              <span>{f.name}</span>
              <div className="flex items-center gap-2">
                <span>{Math.round(f.carbs * (selections[f.id]?.mult || 1))}g</span>
                <button onClick={() => toggleFood(f)} className="text-red-400">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create ContextInput**

```jsx
// v4/src/components/ContextInput.jsx
import { calcTotalIOB } from '../utils/iobCurve';

const ACTIVITIES = [
  { key: 'aucune', label: 'Aucune', icon: '🚶' },
  { key: 'legere', label: 'Légère', icon: '🚶‍♀️' },
  { key: 'moderee', label: 'Modérée', icon: '🏃' },
  { key: 'intense', label: 'Intense', icon: '🏋️' },
];

export default function ContextInput({ activity, setActivity, iobTotal, t }) {
  return (
    <div className="space-y-3">
      {/* IOB display */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10">
        <span className="text-sm">{t('cl_iobActive') || 'Insuline active'}</span>
        <span className="font-bold text-amber-400">
          {iobTotal > 0 ? `${iobTotal.toFixed(1)} u` : '0 u'}
        </span>
      </div>

      {/* Activity selector */}
      <div>
        <span className="text-sm opacity-70">{t('cl_activite') || 'Activité physique'}</span>
        <div className="flex gap-2 mt-1">
          {ACTIVITIES.map(a => (
            <button key={a.key} onClick={() => setActivity(a.key)}
              className={`flex-1 py-2 rounded-lg text-xs flex flex-col items-center gap-1
                ${activity === a.key ? 'bg-blue-500 text-white' : 'bg-white/10'}`}>
              <span>{a.icon}</span>
              <span>{t(`cl_${a.key}`) || a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add v4/src/components/GlycemiaInput.jsx v4/src/components/MealInput.jsx v4/src/components/ContextInput.jsx
git commit -m "feat: create GlycemiaInput, MealInput, ContextInput components"
```

---

## Task 10: ClinicalResponse Component

**Files:**
- Create: `v4/src/components/ClinicalResponse.jsx`

- [ ] **Step 1: Create ClinicalResponse**

```jsx
// v4/src/components/ClinicalResponse.jsx

export default function ClinicalResponse({ result, t }) {
  if (!result) return null;

  const { analysis, recommendation, vigilance, nextStep } = result;

  return (
    <div className="space-y-4 mt-4">
      {/* Analysis */}
      <Section icon="🔍" title={t('cl_analyse') || 'Analyse'}>
        <div className="space-y-1 text-sm">
          <StatusBadge status={analysis.glycemiaStatus} t={t} />
          {analysis.iob > 0 && (
            <p>{t('cl_iobActive') || 'Insuline active'} : {analysis.iob} u</p>
          )}
          {analysis.totalCarbs > 0 && (
            <p>Glucides : {analysis.totalCarbs}g | Gras : {analysis.fatLevel}</p>
          )}
        </div>
      </Section>

      {/* Recommendation */}
      <Section icon="💉" title={t('cl_recommandation') || 'Recommandation'}>
        {recommendation.blocked ? (
          <p className="text-red-400 font-bold">{vigilance.risks[0]?.message}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-2xl font-bold">{recommendation.dose} u</p>
            {recommendation.split.type === 'fractionne' ? (
              <div className="text-sm space-y-1">
                <p>➊ {recommendation.split.immediate} u — {t('cl_immediat') || 'immédiat'}</p>
                <p>➋ {recommendation.split.delayed} u — +{recommendation.split.delayMinutes} min</p>
              </div>
            ) : (
              <p className="text-sm">{t('cl_doseUnique') || 'Injection unique'} — {t('cl_immediat') || 'immédiat'}</p>
            )}
            <DoseBreakdown reasoning={recommendation.reasoning} t={t} />
          </div>
        )}
      </Section>

      {/* Vigilance */}
      {(vigilance.risks.length > 0 || vigilance.warnings.length > 0) && (
        <Section icon="⚠️" title={t('cl_vigilance') || 'Vigilance'}>
          <div className="space-y-1 text-sm">
            {vigilance.risks.map((r, i) => (
              <p key={i} className="text-red-400">● {r.message}</p>
            ))}
            {vigilance.warnings.map((w, i) => (
              <p key={i} className="text-amber-400">● {w.message}</p>
            ))}
          </div>
        </Section>
      )}

      {/* Next step */}
      <Section icon="⏱️" title={t('cl_prochaineEtape') || 'Prochaine étape'}>
        <p className="text-sm">{nextStep.instruction}</p>
      </Section>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="rounded-xl p-4 bg-white/5">
      <h3 className="font-semibold mb-2">{icon} {title}</h3>
      {children}
    </div>
  );
}

function StatusBadge({ status, t }) {
  const colors = {
    'hypo-severe': 'bg-red-600', 'hypo': 'bg-red-500', 'hypo-proche': 'bg-orange-500',
    'cible': 'bg-green-500', 'sous-cible': 'bg-yellow-500', 'elevee': 'bg-orange-400',
    'haute': 'bg-red-400', 'hyper-severe': 'bg-red-700',
  };
  const labels = {
    'hypo-severe': 'cl_hypoSevere', 'hypo': 'cl_hypo', 'hypo-proche': 'cl_hypoProche',
    'cible': 'cl_cible', 'sous-cible': 'cl_sousCible', 'elevee': 'cl_elevee',
    'haute': 'cl_haute', 'hyper-severe': 'cl_hyperSevere',
  };
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs text-white ${colors[status] || 'bg-gray-500'}`}>
      {t(labels[status]) || status}
    </span>
  );
}

function DoseBreakdown({ reasoning, t }) {
  if (!reasoning) return null;
  return (
    <div className="text-xs opacity-60 space-y-0.5 mt-2 border-t border-white/10 pt-2">
      {reasoning.bolusRepas > 0 && <p>{t('cl_bolusRepas') || 'Bolus repas'} : {reasoning.bolusRepas.toFixed(1)} u</p>}
      {reasoning.correctionNette > 0 && <p>{t('cl_correction') || 'Correction'} : +{reasoning.correctionNette.toFixed(1)} u</p>}
      {reasoning.bonusGras > 0 && <p>{t('cl_bonusGras') || 'Bonus gras'} : +{reasoning.bonusGras.toFixed(1)} u</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add v4/src/components/ClinicalResponse.jsx
git commit -m "feat: create ClinicalResponse component (4-bloc clinical display)"
```

---

## Task 11: ConsultationScreen — Main Orchestrator

**Files:**
- Create: `v4/src/components/ConsultationScreen.jsx`

- [ ] **Step 1: Create ConsultationScreen**

This is the main screen. It orchestrates GlycemiaInput, MealInput, ContextInput, and ClinicalResponse. Read `v4/src/App.jsx` to understand the current prop drilling pattern and follow it.

```jsx
// v4/src/components/ConsultationScreen.jsx
import { useState, useMemo } from 'react';
import GlycemiaInput from './GlycemiaInput';
import MealInput from './MealInput';
import ContextInput from './ContextInput';
import ClinicalResponse from './ClinicalResponse';
import { analyzeAndRecommend } from '../utils/clinicalEngine';
import { calcTotalIOB } from '../utils/iobCurve';
import { getOverallFat } from '../utils/calculations';

export default function ConsultationScreen({
  // From App state
  glycemia, setGlycemia, ratio, isf, targetGMin, targetGMax,
  maxDose, postKeto, slowDigestion, dia,
  journal, selections, foods, customFoods, toggleFood, updateMult,
  timeProfiles, onSaveToJournal, onPhotoMeal, t, isRTL,
}) {
  const [trend, setTrend] = useState('?');
  const [hour, setHour] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  });
  const [activity, setActivity] = useState('aucune');
  const [fatLevel, setFatLevel] = useState('aucun');
  const [manualCarbs, setManualCarbs] = useState(0);
  const [result, setResult] = useState(null);

  // Calculate total carbs (expert mode: manual, assisted mode: from selections)
  const totalCarbs = useMemo(() => {
    const fromSelections = Object.entries(selections).reduce((sum, [id, sel]) => {
      const food = [...foods, ...(customFoods || [])].find(f => f.id === id);
      return sum + (food ? food.carbs * (sel.mult || 1) : 0);
    }, 0);
    return manualCarbs > 0 ? manualCarbs : Math.round(fromSelections);
  }, [manualCarbs, selections, foods, customFoods]);

  // Fat level from selections (assisted mode)
  const autoFat = useMemo(() => getOverallFat(selections), [selections]);

  // Calculate IOB from recent journal entries
  const diaMinutes = (dia || 4.5) * 60;
  const iobTotal = useMemo(() => {
    const now = Date.now();
    const injections = journal
      .filter(e => e.doseReelle > 0 || e.doseInjected > 0)
      .map(e => ({
        dose: e.doseReelle || e.doseInjected || 0,
        minutesAgo: (now - new Date(e.date).getTime()) / 60000,
      }))
      .filter(i => i.minutesAgo < diaMinutes && i.minutesAgo >= 0);
    return calcTotalIOB(injections, diaMinutes);
  }, [journal, diaMinutes]);

  // Last injection time
  const lastInjectionMinutesAgo = useMemo(() => {
    const now = Date.now();
    const recent = journal
      .filter(e => (e.doseReelle || e.doseInjected || 0) > 0)
      .map(e => (now - new Date(e.date).getTime()) / 60000)
      .filter(m => m >= 0)
      .sort((a, b) => a - b);
    return recent.length > 0 ? recent[0] : null;
  }, [journal]);

  // Get active time profile ratio/isf
  const activeParams = useMemo(() => {
    const h = parseInt(hour.split(':')[0], 10);
    if (timeProfiles && timeProfiles.length > 0) {
      const match = timeProfiles.find(p => {
        if (p.startH <= p.endH) return h >= p.startH && h < p.endH;
        return h >= p.startH || h < p.endH; // wraps midnight
      });
      if (match) return { ratio: match.ratio || ratio, isf: match.isf || isf };
    }
    return { ratio, isf };
  }, [hour, timeProfiles, ratio, isf]);

  const gVal = parseFloat(glycemia);

  const handleAnalyze = () => {
    if (isNaN(gVal) || gVal <= 0) return;

    const r = analyzeAndRecommend({
      glycemia: gVal, trend, totalCarbs,
      fatLevel: manualCarbs > 0 ? fatLevel : autoFat || fatLevel,
      activity,
      ratio: activeParams.ratio, isf: activeParams.isf,
      targetMin: targetGMin, targetMax: targetGMax,
      iobTotal, lastInjectionMinutesAgo,
      slowDigestion, postKeto, maxDose,
    });
    setResult(r);
  };

  const handleSave = () => {
    if (!result) return;
    onSaveToJournal({
      glycPre: gVal, tendance: trend, heure: hour,
      totalGlucides: totalCarbs,
      niveauGras: manualCarbs > 0 ? fatLevel : autoFat || fatLevel,
      aliments: Object.keys(selections).length > 0
        ? Object.entries(selections).map(([id, sel]) => {
            const f = [...foods, ...(customFoods || [])].find(f => f.id === id);
            return f ? { id: f.id, name: f.name, carbs: f.carbs, qty: sel.mult || 1, fat: f.fat, gi: f.gi } : null;
          }).filter(Boolean)
        : null,
      iobAuMoment: parseFloat(iobTotal.toFixed(1)),
      doseSuggeree: result.recommendation.dose,
      bolusType: result.recommendation.split.type,
      activitePhysique: activity,
      alertes: [...result.vigilance.risks, ...result.vigilance.warnings],
      notes: '',
    });
    // Reset
    setResult(null);
    setTrend('?');
    setActivity('aucune');
    setFatLevel('aucun');
    setManualCarbs(0);
  };

  return (
    <div className="space-y-4 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <GlycemiaInput glycemia={glycemia} setGlycemia={setGlycemia}
        trend={trend} setTrend={setTrend} hour={hour} setHour={setHour} t={t} />

      <MealInput totalCarbs={manualCarbs} setTotalCarbs={setManualCarbs}
        fatLevel={fatLevel} setFatLevel={setFatLevel}
        foods={foods} selections={selections} toggleFood={toggleFood}
        updateMult={updateMult} customFoods={customFoods}
        onPhotoMeal={onPhotoMeal} t={t} />

      <ContextInput activity={activity} setActivity={setActivity}
        iobTotal={iobTotal} t={t} />

      <button onClick={handleAnalyze}
        disabled={isNaN(gVal) || gVal <= 0}
        className="w-full py-3 rounded-xl bg-blue-500 text-white font-bold text-lg disabled:opacity-40">
        {t('cl_analyser') || 'Analyser'}
      </button>

      <ClinicalResponse result={result} t={t} />

      {result && !result.recommendation.blocked && (
        <button onClick={handleSave}
          className="w-full py-3 rounded-xl bg-green-500 text-white font-bold">
          💉 Enregistrer & Injecter
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add v4/src/components/ConsultationScreen.jsx
git commit -m "feat: create ConsultationScreen orchestrator component"
```

---

## Task 12: 3-Tab Navigation & App.jsx Wiring

**Files:**
- Create: `v4/src/components/BottomNav3.jsx`
- Modify: `v4/src/App.jsx`

- [ ] **Step 1: Create BottomNav3**

```jsx
// v4/src/components/BottomNav3.jsx
const TABS = [
  { key: 'consultation', icon: '💉', labelKey: 'cl_consultation', fallback: 'Consultation' },
  { key: 'journal', icon: '📋', labelKey: 'cl_journal', fallback: 'Journal' },
  { key: 'reglages', icon: '⚙️', labelKey: 'cl_reglages', fallback: 'Réglages' },
];

export default function BottomNav3({ tab, setTab, t }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around bg-gray-900/95 backdrop-blur border-t border-white/10 py-2 z-50 max-w-[28rem] mx-auto">
      {TABS.map(({ key, icon, labelKey, fallback }) => (
        <button key={key} onClick={() => setTab(key)}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors
            ${tab === key ? 'text-blue-400' : 'text-white/50'}`}>
          <span className="text-xl">{icon}</span>
          <span>{t(labelKey) || fallback}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Wire App.jsx to use new 3-tab navigation**

Read `v4/src/App.jsx` and make these changes:
1. Replace the old tab state `'home'|'repas'|'timeline'|'settings'` with `'consultation'|'journal'|'reglages'`
2. Replace `<BottomNav>` with `<BottomNav3>`
3. Replace the tab content switch:
   - `'consultation'` → `<ConsultationScreen>` with all necessary props
   - `'journal'` → existing `<DayTimeline>` + `<PdfExport>` + `<GlycEvolutionChart>`
   - `'reglages'` → existing `<Settings>` (with new profile props)
4. Add migration on mount: import `needsMigration`, `migrateAllEntries` and run on first render
5. Pass new state variables (postKeto, slowDigestion, dia, etc.) to ConsultationScreen

- [ ] **Step 3: Run the app and verify**

Run: `cd v4 && npm run dev`
Verify:
- 3 tabs appear at bottom
- Consultation screen shows glycemia input, meal input, context
- Journal tab shows timeline
- Settings tab shows all fields including new medical profile

- [ ] **Step 4: Commit**

```bash
git add v4/src/components/BottomNav3.jsx v4/src/App.jsx
git commit -m "feat: wire 3-tab navigation with ConsultationScreen"
```

---

## Task 13: Journal Adaptation (DayTimeline + journalStore)

**Files:**
- Modify: `v4/src/data/journalStore.js`
- Modify: `v4/src/components/DayTimeline.jsx`

- [ ] **Step 1: Update journalStore.js**

Read `v4/src/data/journalStore.js` and update:
- `addEntry()`: accept v5 schema fields (tendance, iobAuMoment, activitePhysique, alertes, notes, niveauGras, bolusType)
- `getStats()`: keep existing stats, ensure it works with both `glycPre`/`preMealGlycemia` field names

- [ ] **Step 2: Update DayTimeline.jsx**

Read `v4/src/components/DayTimeline.jsx` and adapt:
- Display `tendance` (trend arrow) next to glycemia
- Display `activitePhysique` icon if not "aucune"
- Display `alertes` count as a badge if > 0
- Show `notes` if present
- Support adding `glycPost` on existing entry (existing feature, ensure it still works)
- Color-code glycemia: green (1.00-1.20), orange (0.90-1.00 or 1.20-1.80), red (<0.90 or >1.80)

- [ ] **Step 3: Verify journal works end-to-end**

Run: `cd v4 && npm run dev`
1. Make a consultation (enter glycemia, carbs, analyze, save)
2. Switch to Journal tab
3. Verify the new entry appears with all fields

- [ ] **Step 4: Commit**

```bash
git add v4/src/data/journalStore.js v4/src/components/DayTimeline.jsx
git commit -m "feat: adapt journal to v5 entry format with clinical data"
```

---

## Task 14: Split Bolus Notifications

**Files:**
- Modify: `v4/src/utils/notifications.js`

- [ ] **Step 1: Read current notifications.js**

Read `v4/src/utils/notifications.js` to understand the current `scheduleFromPlan()` API.

- [ ] **Step 2: Add split bolus notification support**

Add a new function:

```js
/**
 * Schedule a notification for the delayed part of a split bolus.
 * @param {number} delayMinutes - Minutes from now
 * @param {number} units - Delayed dose units
 */
export function scheduleSplitReminder(delayMinutes, units) {
  const timer = setTimeout(() => {
    fireNotification(
      '💉 Dose différée',
      `Injecter ${units} unités maintenant (2e partie du bolus fractionné)`,
      'split-bolus-reminder'
    );
  }, delayMinutes * 60 * 1000);
  scheduledTimers.push(timer);
}
```

- [ ] **Step 3: Wire from ConsultationScreen**

In `ConsultationScreen.jsx`, after saving a fractionated bolus, call `scheduleSplitReminder()` if notifications are enabled.

- [ ] **Step 4: Commit**

```bash
git add v4/src/utils/notifications.js v4/src/components/ConsultationScreen.jsx
git commit -m "feat: add split bolus reminder notifications"
```

---

## Task 15: Remove Deprecated Components

**Files:**
- Delete: `v4/src/components/HomeScreen.jsx`
- Delete: `v4/src/components/MealBuilder.jsx`
- Delete: `v4/src/components/FoodCategory.jsx`
- Delete: `v4/src/components/FoodList.jsx`
- Delete: `v4/src/components/QtyStepper.jsx`
- Delete: `v4/src/components/QuickAddSheet.jsx`
- Delete: `v4/src/components/BottomNav.jsx`
- Delete: `v4/src/components/InjectionTracker.jsx`
- Delete: `v4/src/components/PostMealCorrector.jsx`
- Delete: `v4/src/components/ResultCard.jsx`
- Delete: `v4/src/components/TrendChart.jsx`
- Modify: `v4/src/App.jsx` (remove imports)

- [ ] **Step 1: Verify no remaining imports of old components**

Search for imports of each deprecated component in all .jsx files. Ensure App.jsx no longer references them.

- [ ] **Step 2: Delete the files**

```bash
cd v4/src/components
rm HomeScreen.jsx MealBuilder.jsx FoodCategory.jsx FoodList.jsx QtyStepper.jsx \
   QuickAddSheet.jsx BottomNav.jsx InjectionTracker.jsx PostMealCorrector.jsx \
   ResultCard.jsx TrendChart.jsx
```

- [ ] **Step 3: Remove stale imports from App.jsx**

Clean up any remaining imports of deleted components.

- [ ] **Step 4: Run the app to verify nothing is broken**

Run: `cd v4 && npm run dev`
Expected: App loads with no errors, all 3 tabs functional.

- [ ] **Step 5: Commit**

```bash
git add -A v4/src/components/ v4/src/App.jsx
git commit -m "chore: remove deprecated v4 components replaced by consultation flow"
```

---

## Task 16: Run All Tests & Fix

**Files:**
- All test files

- [ ] **Step 1: Run full test suite**

Run: `cd v4 && npx vitest run`
Expected: Note any failures.

- [ ] **Step 2: Fix any failing tests**

Update old tests that reference removed functions or changed APIs. The existing `calculations.test.js` may reference functions that have been superseded by `clinicalEngine.js`.

- [ ] **Step 3: Run tests again to verify all pass**

Run: `cd v4 && npx vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add -A v4/src/
git commit -m "fix: update tests for v5 clinical engine migration"
```

---

## Task 17: Final Integration Test & Version Bump

**Files:**
- Modify: `v4/package.json`

- [ ] **Step 1: Verify full app flow end-to-end**

Run: `cd v4 && npm run dev`
Test these scenarios manually:
1. **Normal consultation**: glycémie 1.10, 45g glucides, gras faible → dose ~3u unique
2. **High glycemia + fat**: glycémie 1.80, 60g glucides, gras élevé → dose fractionnée + correction
3. **Hypo block**: glycémie 0.55 → blocked, resucrage recommended
4. **IOB stacking**: save a consultation, then immediately do another with correction → IOB warning
5. **Journal**: verify entries appear with all clinical data
6. **Settings**: verify all new fields save correctly
7. **Onboarding**: clear localStorage, verify 3-step flow

- [ ] **Step 2: Bump version to 5.0.0**

In `v4/package.json`, change version to `"5.0.0"`.

- [ ] **Step 3: Run build**

Run: `cd v4 && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add v4/package.json
git commit -m "chore: bump version to 5.0.0 — clinical reframe complete"
```

---

## Task 18: Post-Prandial Feedback Logic

**Files:**
- Modify: `v4/src/utils/clinicalEngine.js`
- Modify: `v4/src/utils/__tests__/clinicalEngine.test.js`
- Modify: `v4/src/components/DayTimeline.jsx`

- [ ] **Step 1: Write failing tests for post-prandial feedback**

Add to `clinicalEngine.test.js`:

```js
import { evaluatePostPrandial } from '../clinicalEngine.js';

describe('evaluatePostPrandial', () => {
  it('returns "good" when glycPost is within target', () => {
    const result = evaluatePostPrandial(1.10, 1.15, 1.00, 1.80);
    expect(result.verdict).toBe('good');
  });

  it('returns "under" when glycPost is too high (under-corrected)', () => {
    const result = evaluatePostPrandial(1.10, 2.20, 1.00, 1.80);
    expect(result.verdict).toBe('under');
  });

  it('returns "over" when glycPost is too low (over-corrected)', () => {
    const result = evaluatePostPrandial(1.10, 0.75, 1.00, 1.80);
    expect(result.verdict).toBe('over');
  });

  it('returns null if glycPost is missing', () => {
    expect(evaluatePostPrandial(1.10, null, 1.00, 1.80)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd v4 && npx vitest run src/utils/__tests__/clinicalEngine.test.js`

- [ ] **Step 3: Implement post-prandial feedback**

Add to `clinicalEngine.js`:

```js
/**
 * Evaluate post-prandial glycemia result.
 * @returns {{ verdict: 'good'|'under'|'over', message: string, ratioSuggestion: string|null }} | null
 */
export function evaluatePostPrandial(glycPre, glycPost, targetMin, targetPostMax) {
  if (glycPost == null || glycPost <= 0) return null;

  if (glycPost >= targetMin && glycPost <= targetPostMax) {
    return { verdict: 'good', message: 'Bonne correction', ratioSuggestion: null };
  }
  if (glycPost > targetPostMax) {
    return {
      verdict: 'under',
      message: 'Sous-corrigé — glycémie post-repas trop haute',
      ratioSuggestion: 'Envisager de réduire le ratio (plus d\'insuline par g de glucides)',
    };
  }
  return {
    verdict: 'over',
    message: 'Sur-corrigé — glycémie post-repas trop basse',
    ratioSuggestion: 'Envisager d\'augmenter le ratio (moins d\'insuline par g de glucides)',
  };
}
```

- [ ] **Step 4: Wire feedback display in DayTimeline**

In `DayTimeline.jsx`, when an entry has both `glycPre` and `glycPost`, call `evaluatePostPrandial()` and display the verdict as a colored badge (green/orange/red) with the suggestion text.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd v4 && npx vitest run src/utils/__tests__/clinicalEngine.test.js`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add v4/src/utils/clinicalEngine.js v4/src/utils/__tests__/clinicalEngine.test.js v4/src/components/DayTimeline.jsx
git commit -m "feat: add post-prandial glycemia feedback with ratio suggestions"
```

---

## Task 19: OverdoseDialog Integration

**Files:**
- Modify: `v4/src/components/ConsultationScreen.jsx`

- [ ] **Step 1: Wire OverdoseDialog for surdosage confirmation**

In `ConsultationScreen.jsx`, when the clinical engine returns `blocked: true` with a `surdosage` risk:
1. Show the existing `OverdoseDialog` component (import it)
2. If user confirms → allow saving with the high dose
3. If user cancels → keep the block

Read `v4/src/components/OverdoseDialog.jsx` first to understand its props API, then integrate:

```jsx
// Add state
const [showOverdoseDialog, setShowOverdoseDialog] = useState(false);

// In handleSave or handleAnalyze, when surdosage detected:
if (result.recommendation.blocked && result.vigilance.risks.some(r => r.type === 'surdosage')) {
  setShowOverdoseDialog(true);
  return;
}

// In render, add:
<OverdoseDialog
  open={showOverdoseDialog}
  dose={result?.recommendation?.dose}
  maxDose={maxDose}
  onConfirm={() => { setShowOverdoseDialog(false); /* proceed with save */ }}
  onCancel={() => setShowOverdoseDialog(false)}
/>
```

- [ ] **Step 2: Commit**

```bash
git add v4/src/components/ConsultationScreen.jsx
git commit -m "feat: wire OverdoseDialog for surdosage confirmation in consultation"
```

---

## Task 20: PdfExport Adaptation

**Files:**
- Modify: `v4/src/components/PdfExport.jsx`

- [ ] **Step 1: Read current PdfExport.jsx**

Read `v4/src/components/PdfExport.jsx` to understand the current data format expectations.

- [ ] **Step 2: Update PdfExport for v5 journal format**

Adapt the PDF generation to use v5 field names:
- `glycPre` instead of `preMealGlycemia`
- `glycPost` instead of `postMealGlycemia`
- `doseSuggeree` / `doseReelle` instead of `doseCalculated` / `doseInjected`
- `totalGlucides` instead of `totalCarbs`
- Add display of `tendance`, `activitePhysique`, `bolusType`
- Include post-prandial feedback verdict if glycPost exists

- [ ] **Step 3: Test PDF export manually**

Run app, add a few journal entries, go to Journal tab, click Export PDF. Verify the PDF generates correctly with the new field names.

- [ ] **Step 4: Commit**

```bash
git add v4/src/components/PdfExport.jsx
git commit -m "feat: adapt PdfExport to v5 journal entry format"
```

---

## Task 21: Migration Trigger in App.jsx

**Files:**
- Modify: `v4/src/App.jsx`

- [ ] **Step 1: Wire migration on app mount**

Add to App.jsx, after the `useLocalStorage` declarations:

```jsx
import { needsMigration, migrateAllEntries } from './utils/migration';

// Inside component, after journal state is declared:
useEffect(() => {
  const version = localStorage.getItem('insulincalc_v4_app_version');
  if (needsMigration(version)) {
    const migrated = migrateAllEntries(journal);
    setJournal(migrated);
    localStorage.setItem('insulincalc_v4_app_version', '5.0.0');
  }
}, []); // Run once on mount
```

- [ ] **Step 2: Verify migration works**

1. Run: `cd v4 && npm run dev`
2. Manually add a test entry in old format to localStorage
3. Reload the app
4. Verify the entry is migrated (has new fields)
5. Verify `app_version` is set to "5.0.0"

- [ ] **Step 3: Commit**

```bash
git add v4/src/App.jsx
git commit -m "feat: wire v4-to-v5 data migration on app mount"
```

---

## Important Notes

- **Task 7 and Task 12 both modify App.jsx.** Do Task 7 first (adds state vars), then Task 12 (rewires navigation). The implementer should be aware of this dependency.
- **Task 11 uses `getOverallFat` from `calculations.js`** — this function exists in the current v4 codebase (confirmed by exploration). It accepts a selections object and returns the dominant fat level.
- **Safety rule stacking**: The `applySafetyRules` function applies hypo-proche (50% total reduction) and sur-correction (50% correction reduction) independently. If glycemia is 0.85 (hypo-proche) with falling trend, both apply. This is intentional — prudence is the priority. The maximum compound reduction keeps the dose safe.
- **`timeProfiles` must be passed as prop** to ConsultationScreen in Task 12 when wiring App.jsx.
