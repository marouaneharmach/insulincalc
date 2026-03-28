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
