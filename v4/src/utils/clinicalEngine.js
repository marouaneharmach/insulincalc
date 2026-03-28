/**
 * clinicalEngine.js — Core medical logic for InsulinCalc v5
 *
 * Pure functions with no external dependencies.
 * All glycemia values are in g/L (e.g. 1.20 = 1.20 g/L).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Fat content bonus multiplier applied to meal bolus.
 * High-fat meals delay glucose absorption — a supplemental dose is added
 * proportionally to the meal bolus.
 */
export const FAT_FACTOR = {
  aucun: 0,
  faible: 0.04,
  moyen: 0.14,
  'élevé': 0.27,
};

/**
 * Activity reduction multiplier applied to the total dose before rounding.
 * Physical activity increases insulin sensitivity and lowers effective need.
 */
export const ACTIVITY_REDUCTION = {
  aucune: 1.0,
  legere: 1.0,
  moderee: 0.80,
  intense: 0.70,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Round a value to the nearest 0.5 unit (insulin pen precision).
 * @param {number} v
 * @returns {number}
 */
export function round05(v) {
  return Math.round(v * 2) / 2;
}

// ─── Dose Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate the suggested insulin dose.
 *
 * Formula:
 *   bolusRepas       = totalCarbs / ratio
 *   correction       = (glycemia - targetMax) / isf   [only when glycemia > targetMax, else 0]
 *   correctionNette  = max(0, correction - iobTotal)   [IOB reduces correction only]
 *   bonusGras        = bolusRepas * FAT_FACTOR[fatLevel]
 *   doseBeforeActivity = bolusRepas + correctionNette + bonusGras
 *   doseSuggeree     = round05(doseBeforeActivity * ACTIVITY_REDUCTION[activity])
 *
 * @param {object} params
 * @param {number} params.totalCarbs          - Total carbohydrates in grams
 * @param {number} params.glycemia            - Current glycemia in g/L
 * @param {number} params.ratio               - Insulin-to-carb ratio (g/U)
 * @param {number} params.isf                 - Insulin sensitivity factor (g/L per unit)
 * @param {number} params.targetMax           - Upper glycemia target in g/L
 * @param {number} params.iobTotal            - Insulin on board in units
 * @param {string} params.fatLevel            - Key of FAT_FACTOR
 * @param {string} params.activity            - Key of ACTIVITY_REDUCTION
 * @returns {{
 *   bolusRepas: number,
 *   correction: number,
 *   correctionNette: number,
 *   bonusGras: number,
 *   doseBeforeActivity: number,
 *   doseSuggeree: number,
 * }}
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

  const bonusGras = bolusRepas * FAT_FACTOR[fatLevel];

  const doseBeforeActivity = bolusRepas + correctionNette + bonusGras;

  const doseSuggeree = round05(doseBeforeActivity * ACTIVITY_REDUCTION[activity]);

  return {
    bolusRepas,
    correction,
    correctionNette,
    bonusGras,
    doseBeforeActivity,
    doseSuggeree,
  };
}

// ─── Safety Rules ─────────────────────────────────────────────────────────────

/** Trends considered as falling (sur-correction risk). */
const FALLING_TRENDS = new Set(['↓', '↘']);

/**
 * Apply safety rules to a computed dose and return an adjusted dose with
 * structured risk/warning lists.
 *
 * Rules evaluated in order:
 *  1. Anti-hypo       : glycemia < 0.70 → blocked, dose = 0 (early return)
 *  2. Hypo-proche     : 0.70 ≤ glycemia < 0.90 → total dose × 50% (risk)
 *  3. Surdosage       : adjustedDose > maxDose → blocked (risk)
 *  4. Sur-correction  : falling trend AND correction > 0 → subtract round05(correction×0.5) (warning)
 *  5. Anti-stacking   : iobTotal > 2 AND correction > 0 (warning)
 *  6. Alerte-timing   : lastInjectionMinutesAgo < 120 (warning)
 *  7. Post-keto       : postKeto flag (warning)
 *
 * @param {object} ctx
 * @param {number}      ctx.glycemia
 * @param {number}      ctx.doseSuggeree
 * @param {number}      ctx.correction          - Raw correction component (before IOB)
 * @param {number}      ctx.iobTotal
 * @param {string|null} ctx.trend               - '↑','↗','→','↘','↓','?' or null
 * @param {string}      ctx.activity
 * @param {boolean}     ctx.postKeto
 * @param {number}      ctx.maxDose             - Maximum allowed single dose (units)
 * @param {number|null} ctx.lastInjectionMinutesAgo
 * @returns {{
 *   blocked: boolean,
 *   adjustedDose: number,
 *   risks: Array<{type: string, message: string}>,
 *   warnings: Array<{type: string, message: string}>,
 * }}
 */
export function applySafetyRules({
  glycemia, doseSuggeree, correction, iobTotal, trend,
  activity, postKeto, maxDose, lastInjectionMinutesAgo,
}) {
  const risks = [];
  const warnings = [];

  // Rule 1 — Anti-hypo: glycemia < 0.70 g/L — immediate block, no further checks
  if (glycemia < 0.70) {
    risks.push({
      type: 'anti-hypo',
      message: 'Glycémie < 0.70 g/L — Ne pas injecter. Resucrage 15 g de glucides rapides immédiat.',
    });
    return { blocked: true, adjustedDose: 0, risks, warnings };
  }

  let adjustedDose = doseSuggeree;

  // Rule 2 — Hypo-proche: 0.70 ≤ glycemia < 0.90 g/L — reduce total dose 50%
  if (glycemia < 0.90) {
    adjustedDose = round05(adjustedDose * 0.5);
    risks.push({
      type: 'hypo-proche',
      message: 'Glycémie entre 0.70 et 0.90 g/L — Dose réduite de 50 %. Surveiller de près.',
    });
  }

  // Rule 3 — Surdosage: adjusted dose exceeds maximum allowed
  if (adjustedDose > maxDose) {
    risks.push({
      type: 'surdosage',
      message: `Dose calculée (${adjustedDose} U) dépasse le maximum autorisé (${maxDose} U) — Injection bloquée.`,
    });
    return { blocked: true, adjustedDose, risks, warnings };
  }

  // Rule 4 — Sur-correction: falling trend with active correction
  const trendIsKnown = trend != null && trend !== '?';
  if (trendIsKnown && FALLING_TRENDS.has(trend) && correction > 0) {
    const reduction = round05(correction * 0.5);
    adjustedDose = Math.max(0, adjustedDose - reduction);
    warnings.push({
      type: 'sur-correction',
      message: "Tendance baissière détectée — correction réduite de 50 % pour éviter l'hypoglycémie.",
    });
  }

  // Rule 5 — Anti-stacking: high IOB with active correction
  if (iobTotal > 2 && correction > 0) {
    warnings.push({
      type: 'anti-stacking',
      message: `Insuline active élevée (${iobTotal} U) avec correction active — risque d'empilement.`,
    });
  }

  // Rule 6 — Timing warning: too soon after last injection
  if (lastInjectionMinutesAgo != null && lastInjectionMinutesAgo < 120) {
    warnings.push({
      type: 'alerte-timing',
      message: `Dernière injection il y a ${lastInjectionMinutesAgo} min (< 2 h) — vérifier l'IOB.`,
    });
  }

  // Rule 7 — Post-keto warning
  if (postKeto) {
    warnings.push({
      type: 'post-keto',
      message: "Période post-cétose — sensibilité à l'insuline potentiellement altérée. Surveiller.",
    });
  }

  return { blocked: false, adjustedDose, risks, warnings };
}

// ─── Split Bolus ──────────────────────────────────────────────────────────────

/**
 * Determine the split scheme for a bolus dose based on fat content and
 * digestion speed.
 *
 * Split schemas:
 *  - Fat "moyen"  : 60% immediate + 40% delayed at +45 min
 *  - Fat "élevé"  : 50% immediate + 50% delayed at +60 min
 *  - slowDigestion alone (fat not moyen/élevé) : 70% immediate + 30% at +60 min
 *  - slowDigestion + fat moyen/élevé : fat scheme takes priority
 *  - Otherwise    : unique (no split)
 *
 * Rounding: immediate fraction rounded to 0.5 u, delayed = total - immediate.
 *
 * @param {number}  dose          - Adjusted dose in units (already rounded to 0.5)
 * @param {string}  fatLevel      - One of: 'aucun','faible','moyen','élevé'
 * @param {boolean} slowDigestion - Whether patient has slow digestion
 * @returns {{
 *   type: 'unique'|'fractionne',
 *   immediate: number,
 *   delayed: number,
 *   delayMinutes: number,
 * }}
 */
export function determineSplit(dose, fatLevel, slowDigestion) {
  // Zero dose — no injection, no split
  if (dose <= 0) {
    return { type: 'unique', immediate: 0, delayed: 0, delayMinutes: 0 };
  }

  // Fat scheme takes priority over slowDigestion alone
  if (fatLevel === 'moyen') {
    const immediate = round05(dose * 0.6);
    const delayed = dose - immediate;
    return { type: 'fractionne', immediate, delayed, delayMinutes: 45 };
  }

  if (fatLevel === 'élevé') {
    const immediate = round05(dose * 0.5);
    const delayed = dose - immediate;
    return { type: 'fractionne', immediate, delayed, delayMinutes: 60 };
  }

  // slowDigestion alone (fat is aucun or faible)
  if (slowDigestion) {
    const immediate = round05(dose * 0.7);
    const delayed = dose - immediate;
    return { type: 'fractionne', immediate, delayed, delayMinutes: 60 };
  }

  // Default: unique injection
  return { type: 'unique', immediate: dose, delayed: 0, delayMinutes: 0 };
}

// ─── Post-Prandial Feedback ──────────────────────────────────────────────────

/**
 * Evaluate post-prandial glycemia result.
 * @param {number} glycPre  - Pre-meal glycemia in g/L
 * @param {number|null} glycPost - Post-meal glycemia in g/L
 * @param {number} targetMin - Lower target bound in g/L
 * @param {number} targetPostMax - Upper post-prandial target in g/L
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

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Classify glycemia level relative to targets and clinical thresholds.
 *
 * @param {number} glycemia
 * @param {number} targetMin
 * @param {number} targetMax
 * @returns {string} One of the clinical status keys
 */
function classifyGlycemia(glycemia, targetMin, targetMax) {
  if (glycemia < 0.54)          return 'hypo-severe';
  if (glycemia < 0.70)          return 'hypo';
  if (glycemia < 0.90)          return 'hypo-proche';
  if (glycemia < targetMin)     return 'sous-cible';
  if (glycemia <= targetMax)    return 'cible';
  if (glycemia <= 1.80)         return 'elevee';
  if (glycemia <= 2.50)         return 'haute';
  return 'hyper-severe';
}

/**
 * Determine the recommended check time (in minutes) based on context.
 *
 * @param {string}  glycemiaStatus
 * @param {boolean} hasTimingWarning
 * @returns {number}
 */
function computeCheckTime(glycemiaStatus, hasTimingWarning) {
  if (glycemiaStatus === 'hypo-severe' || glycemiaStatus === 'hypo') return 15;
  if (glycemiaStatus === 'hypo-proche') return 30;
  if (hasTimingWarning)                 return 60;
  return 120;
}

/**
 * Main clinical orchestrator.
 *
 * Calls calculateDose → applySafetyRules → determineSplit and assembles a
 * structured recommendation object.
 *
 * @param {object}      inputs
 * @param {number}      inputs.glycemia
 * @param {string}      inputs.trend
 * @param {number}      inputs.totalCarbs
 * @param {string}      inputs.fatLevel
 * @param {string}      inputs.activity
 * @param {number}      inputs.ratio
 * @param {number}      inputs.isf
 * @param {number}      inputs.targetMin
 * @param {number}      inputs.targetMax
 * @param {number}      inputs.iobTotal
 * @param {number|null} inputs.lastInjectionMinutesAgo
 * @param {boolean}     inputs.slowDigestion
 * @param {boolean}     inputs.postKeto
 * @param {number}      inputs.maxDose
 * @returns {{
 *   analysis:       { glycemiaStatus: string, iob: number, trend: string, totalCarbs: number, fatLevel: string },
 *   recommendation: { dose: number, timing: string, split: object, blocked: boolean, reasoning: string[] },
 *   vigilance:      { risks: Array, warnings: Array },
 *   nextStep:       { checkTime: number, instruction: string },
 * }}
 */
export function analyzeAndRecommend(inputs) {
  const {
    glycemia, trend, totalCarbs, fatLevel, activity,
    ratio, isf, targetMin, targetMax, iobTotal,
    lastInjectionMinutesAgo, slowDigestion, postKeto, maxDose,
  } = inputs;

  // ── Step 1: classify glycemia ──────────────────────────────────────────────
  const glycemiaStatus = classifyGlycemia(glycemia, targetMin, targetMax);

  // ── Step 2: calculate dose ─────────────────────────────────────────────────
  const doseResult = calculateDose({
    totalCarbs, glycemia, ratio, isf, targetMax, iobTotal, fatLevel, activity,
  });

  // ── Step 3: apply safety rules ─────────────────────────────────────────────
  const safetyResult = applySafetyRules({
    glycemia,
    doseSuggeree: doseResult.doseSuggeree,
    correction: doseResult.correction,
    iobTotal,
    trend,
    activity,
    postKeto,
    maxDose,
    lastInjectionMinutesAgo,
  });

  const { blocked, adjustedDose, risks, warnings } = safetyResult;

  // ── Step 4: determine split ────────────────────────────────────────────────
  const split = determineSplit(adjustedDose, fatLevel, slowDigestion);

  // ── Step 5: build reasoning ────────────────────────────────────────────────
  const reasoning = [];

  if (doseResult.bolusRepas > 0) {
    reasoning.push(`Bolus repas: ${doseResult.bolusRepas.toFixed(2)} U (${totalCarbs} g ÷ ratio ${ratio})`);
  }
  if (doseResult.correctionNette > 0) {
    reasoning.push(`Correction nette: ${doseResult.correctionNette.toFixed(2)} U (IOB ${iobTotal} U déduit)`);
  }
  if (doseResult.bonusGras > 0) {
    reasoning.push(`Bonus gras (${fatLevel}): +${doseResult.bonusGras.toFixed(2)} U`);
  }
  if (activity !== 'aucune' && activity !== 'legere') {
    reasoning.push(`Réduction activité physique (${activity}): ×${ACTIVITY_REDUCTION[activity]}`);
  }
  if (blocked) {
    reasoning.push('Injection bloquée par règle de sécurité.');
  }

  // ── Step 6: timing instruction ─────────────────────────────────────────────
  let timing = 'Injecter 10-15 min avant le repas.';
  if (blocked) {
    timing = 'Ne pas injecter.';
  } else if (glycemiaStatus === 'hypo-proche') {
    timing = 'Injecter au début du repas (glycémie basse).';
  } else if (glycemiaStatus === 'elevee' || glycemiaStatus === 'haute' || glycemiaStatus === 'hyper-severe') {
    timing = 'Injecter 20-30 min avant le repas (glycémie élevée).';
  }

  // ── Step 7: next-step instruction ─────────────────────────────────────────
  const hasTimingWarning = warnings.some(w => w.type === 'alerte-timing');
  const checkTime = computeCheckTime(glycemiaStatus, hasTimingWarning);

  let instruction;
  if (glycemiaStatus === 'hypo-severe' || glycemiaStatus === 'hypo') {
    instruction = 'Resucrage immédiat 15 g de glucides rapides. Contrôler dans 15 min.';
  } else if (glycemiaStatus === 'hypo-proche') {
    instruction = 'Surveiller étroitement. Contrôler dans 30 min.';
  } else if (blocked) {
    instruction = 'Contacter l\'équipe médicale si nécessaire.';
  } else {
    instruction = `Contrôler la glycémie dans ${checkTime} min.`;
  }

  return {
    analysis: {
      glycemiaStatus,
      iob: iobTotal,
      trend,
      totalCarbs,
      fatLevel,
    },
    recommendation: {
      dose: adjustedDose,
      timing,
      split,
      blocked,
      reasoning,
    },
    vigilance: {
      risks,
      warnings,
    },
    nextStep: {
      checkTime,
      instruction,
    },
  };
}
