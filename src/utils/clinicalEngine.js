import { round05 } from './calculations.js';

// ─── NIGHT MODE ─────────────────────────────────────────────────────────────

/**
 * Returns true if the hour (0-23) falls in night window: 21h-05h inclusive.
 * Night mode = 21, 22, 23, 0, 1, 2, 3, 4, 5 → true
 * Day mode = 6..20 → false
 */
export function isNightMode(hour) {
  return hour >= 21 || hour <= 5;
}

// ─── CLINICAL SAFETY ENGINE ─────────────────────────────────────────────────

/**
 * Apply clinical safety rules to a suggested insulin dose.
 * Rules are applied in priority order; earlier rules can block later ones.
 *
 * @param {Object} input
 * @param {number} input.glycemia         - Current glycemia in g/L
 * @param {number} input.suggestedDose    - Raw calculated total dose (UI)
 * @param {number} input.iobTotal         - Insulin on board (UI)
 * @param {number} input.currentHour      - Current hour (0-23)
 * @param {number} input.lastInjectionMinAgo - Minutes since last injection
 * @param {number} input.cumulCorrections24h - Sum of correction doses in last 24h
 * @param {number} input.tddEstimated     - Estimated total daily dose
 * @param {number} input.correction       - Raw correction dose (UI)
 * @param {number} input.maxDose          - Maximum allowed single dose
 * @returns {Object} Safety-checked result
 */
export function applySafetyRules(input) {
  const {
    glycemia,
    suggestedDose,
    iobTotal,
    currentHour,
    lastInjectionMinAgo,
    cumulCorrections24h,
    tddEstimated,
    correction,
    maxDose,
  } = input;

  const warnings = [];
  let adjustedDose = round05(suggestedDose);
  let adjustedCorrection = round05(correction);
  let blocked = false;
  let correctionBlocked = false;
  const nightMode = isNightMode(currentHour);

  // ── ANTI-HYPO BLOCK: glycemia < 0.70 → block completely ──
  if (glycemia < 0.70) {
    blocked = true;
    adjustedDose = 0;
    adjustedCorrection = 0;
    warnings.push({
      type: 'hypo_block',
      severity: 'critical',
      message: `Glycémie très basse (${glycemia} g/L) — NE PAS INJECTER. Resucrage immédiat nécessaire.`,
    });
    return { blocked, correctionBlocked, adjustedDose, adjustedCorrection, nightMode, warnings };
  }

  // ── HYPO-PROCHE: 0.70 ≤ glycemia < 0.90 → reduce 50%, zero correction ──
  if (glycemia >= 0.70 && glycemia < 0.90) {
    adjustedDose = round05(suggestedDose * 0.5);
    adjustedCorrection = 0;
    warnings.push({
      type: 'hypo_proche',
      severity: 'warning',
      message: `Glycémie basse (${glycemia} g/L) — dose réduite de 50%, correction annulée.`,
    });
  }

  // ── RULE 1: IOB Dynamic ──
  // If IOB represents > 50% of suggested dose, reduce correction proportionally
  if (suggestedDose > 0 && iobTotal / suggestedDose > 0.5 && correction > 0) {
    const iobRatio = iobTotal / suggestedDose;
    const reductionFactor = Math.max(0, 1 - iobRatio);
    adjustedCorrection = round05(adjustedCorrection * reductionFactor);
    warnings.push({
      type: 'iob_dynamic',
      severity: 'warning',
      message: `Insuline active élevée (${round05(iobTotal)} UI, ${Math.round(iobRatio * 100)}% de la dose) — correction réduite.`,
    });
  }

  // ── RULE 2: Night mode ──
  if (nightMode) {
    // 2c: Night low alert
    if (glycemia < 1.50) {
      warnings.push({
        type: 'night_low',
        severity: 'critical',
        message: `Glycémie nocturne basse (${glycemia} g/L) — collation recommandée avant le coucher.`,
      });
    }

    // 2a: Block correction at night when glycemia < 2.20
    if (glycemia < 2.20 && correction > 0) {
      correctionBlocked = true;
      adjustedCorrection = 0;
      warnings.push({
        type: 'night_block',
        severity: 'warning',
        message: `Mode nuit : correction bloquée (glycémie ${glycemia} g/L < 2.20). Risque d'hypoglycémie nocturne.`,
      });
    }

    // 2b: Reduce correction by 50% at night when glycemia >= 2.50
    if (glycemia >= 2.50 && correction > 0 && !correctionBlocked) {
      adjustedCorrection = round05(adjustedCorrection * 0.5);
      warnings.push({
        type: 'night_reduce',
        severity: 'info',
        message: `Mode nuit : correction réduite de 50% par sécurité.`,
      });
    }
  }

  // ── RULE 3: Recent injection cap ──
  if (lastInjectionMinAgo < 180 && adjustedCorrection > 1.0) {
    adjustedCorrection = round05(Math.min(adjustedCorrection, 1.0));
    warnings.push({
      type: 'timing_cap',
      severity: 'warning',
      message: `Injection récente (il y a ${lastInjectionMinAgo} min) — correction plafonnée à 1 UI.`,
    });
  }

  // ── RULE 4: Daily cumul warning ──
  if (tddEstimated > 0 && cumulCorrections24h > tddEstimated * 0.15) {
    warnings.push({
      type: 'cumul_high',
      severity: 'warning',
      message: `Cumul de corrections élevé (${round05(cumulCorrections24h)} UI sur 24h, >${Math.round(tddEstimated * 0.15)} UI). Vérifiez vos paramètres de base.`,
    });
  }

  // ── OVERDOSE CHECK ──
  if (suggestedDose > maxDose) {
    warnings.push({
      type: 'overdose',
      severity: 'critical',
      message: `Dose calculée (${round05(suggestedDose)} UI) dépasse la dose maximale (${maxDose} UI). Vérifiez les paramètres.`,
    });
  }

  // Recalculate adjusted dose: suggestedDose minus original correction plus adjusted correction
  // Only if not already reduced by hypo-proche rule
  if (glycemia >= 0.90) {
    adjustedDose = round05(suggestedDose - correction + adjustedCorrection);
  }

  return {
    blocked,
    correctionBlocked,
    adjustedDose,
    adjustedCorrection,
    nightMode,
    warnings,
  };
}
