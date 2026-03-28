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
