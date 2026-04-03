// ─── ADVANCED PATTERN DETECTION ─────────────────────────────────────────────
// Detects 6 clinical patterns from journal entry history for deeper analysis.

/**
 * Detect advanced clinical patterns from journal entries.
 * Each pattern returns: { type, severity, icon, message, count }
 * @param {Array} entries - Journal entries sorted by date (newest first)
 * @returns {Array} detected patterns
 */
export function detectAdvancedPatterns(entries) {
  const patterns = [];
  if (!entries || entries.length < 5) return patterns;

  // Sort entries chronologically (oldest first) for analysis
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

  detectDawnPhenomenon(sorted, patterns);
  detectMorningHypo(sorted, patterns);
  detectSomogyiRebound(sorted, patterns);
  detectOverCorrection(sorted, patterns);
  detectProblemTimeSlot(sorted, patterns);
  detectRecurringStacking(sorted, patterns);

  return patterns;
}

// ─── PATTERN 1: Dawn Phenomenon ─────────────────────────────────────────────
// Fasting glycemia (morning preMeal) > previous evening glycemia + 0.30 g/L
// Frequency threshold: > 3 occurrences per week (scaled to data window)
function detectDawnPhenomenon(entries, patterns) {
  const morningEntries = entries.filter(
    e => e.mealType === 'petit-déjeuner' && e.preMealGlycemia != null
  );
  const eveningEntries = entries.filter(
    e => e.mealType === 'dîner' && (e.postMealGlycemia != null || e.preMealGlycemia != null)
  );

  if (morningEntries.length < 3 || eveningEntries.length < 3) return;

  let dawnCount = 0;

  morningEntries.forEach(morning => {
    const morningDate = new Date(morning.date);
    // Find previous evening entry (same day or day before)
    const prevEvening = eveningEntries
      .filter(e => {
        const d = new Date(e.date);
        const diffH = (morningDate - d) / 3600000;
        return diffH > 0 && diffH < 18; // evening before this morning
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (prevEvening) {
      const eveningGlyc = prevEvening.postMealGlycemia ?? prevEvening.preMealGlycemia;
      if (morning.preMealGlycemia > eveningGlyc + 0.30) {
        dawnCount++;
      }
    }
  });

  // Scale threshold: 3x/week, proportional to data window
  const dataWindowDays = getDataWindowDays(entries);
  const weeks = Math.max(1, dataWindowDays / 7);
  const threshold = Math.max(2, Math.round(3 * weeks));

  // Use minimum of 3 absolute occurrences
  if (dawnCount >= Math.min(threshold, 3)) {
    patterns.push({
      type: 'dawn_phenomenon',
      severity: 'warning',
      icon: '🌅',
      message: 'Phénomène de l\'aube détecté. Discuter ajustement basale nocturne avec médecin.',
      count: dawnCount,
    });
  }
}

// ─── PATTERN 2: Recurring Morning Hypo ──────────────────────────────────────
// preMealGlycemia < 0.70 for morning entries, freq > 2 per week
function detectMorningHypo(entries, patterns) {
  const morningEntries = entries.filter(
    e => e.mealType === 'petit-déjeuner' && e.preMealGlycemia != null
  );

  const morningHypos = morningEntries.filter(e => e.preMealGlycemia < 0.70);

  const dataWindowDays = getDataWindowDays(entries);
  const weeks = Math.max(1, dataWindowDays / 7);
  const threshold = Math.max(2, Math.round(2 * weeks));

  if (morningHypos.length >= Math.min(threshold, 2)) {
    patterns.push({
      type: 'morning_hypo',
      severity: 'warning',
      icon: '🌙',
      message: 'Hypos matinales récurrentes. Réduire correction du soir / basale nocturne.',
      count: morningHypos.length,
    });
  }
}

// ─── PATTERN 3: Post-hypo Rebound (Somogyi) ────────────────────────────────
// Entry N: glycemia < 0.70, Entry N+1 (within 4h): glycemia > 2.00
function detectSomogyiRebound(entries, patterns) {
  let reboundCount = 0;

  for (let i = 0; i < entries.length - 1; i++) {
    const current = entries[i];
    const currentGlyc = current.postMealGlycemia ?? current.preMealGlycemia;
    if (currentGlyc == null || currentGlyc >= 0.70) continue;

    // Check next entries within 4 hours
    for (let j = i + 1; j < entries.length; j++) {
      const next = entries[j];
      const diffH = (new Date(next.date) - new Date(current.date)) / 3600000;
      if (diffH > 4) break;

      const nextGlyc = next.preMealGlycemia ?? next.postMealGlycemia;
      if (nextGlyc != null && nextGlyc > 2.00) {
        reboundCount++;
        break;
      }
    }
  }

  if (reboundCount >= 2) {
    patterns.push({
      type: 'somogyi_rebound',
      severity: 'warning',
      icon: '🔄',
      message: 'Rebond post-hypoglycémie détecté. Éviter la sur-correction du rebond.',
      count: reboundCount,
    });
  }
}

// ─── PATTERN 4: Systematic Over-correction ─────────────────────────────────
// (doseInjected - doseCalculated) / doseCalculated > 0.20, freq > 50%
function detectOverCorrection(entries, patterns) {
  const withBothDoses = entries.filter(
    e => e.doseCalculated > 0 && e.doseInjected > 0
  );

  if (withBothDoses.length < 3) return;

  const overCorrected = withBothDoses.filter(e => {
    const ratio = (e.doseInjected - e.doseCalculated) / e.doseCalculated;
    return ratio > 0.20;
  });

  const pct = overCorrected.length / withBothDoses.length;
  if (pct > 0.50) {
    patterns.push({
      type: 'over_correction',
      severity: 'warning',
      icon: '💉',
      message: 'Tendance à injecter plus que la dose suggérée. Risque d\'hypo augmenté.',
      count: overCorrected.length,
    });
  }
}

// ─── PATTERN 5: Problem Time Slot ───────────────────────────────────────────
// TIR (1.0-1.8 g/L) by 4h time slots; flag if TIR < 50% with min 3 measurements
function detectProblemTimeSlot(entries, patterns) {
  const slots = {
    '00h-04h': { inRange: 0, total: 0 },
    '04h-08h': { inRange: 0, total: 0 },
    '08h-12h': { inRange: 0, total: 0 },
    '12h-16h': { inRange: 0, total: 0 },
    '16h-20h': { inRange: 0, total: 0 },
    '20h-00h': { inRange: 0, total: 0 },
  };

  const slotKeys = Object.keys(slots);

  entries.forEach(e => {
    const hour = new Date(e.date).getHours();
    const slotIdx = Math.floor(hour / 4);
    const slotKey = slotKeys[slotIdx];

    const values = [];
    if (e.preMealGlycemia != null) values.push(e.preMealGlycemia);
    if (e.postMealGlycemia != null) values.push(e.postMealGlycemia);

    values.forEach(v => {
      slots[slotKey].total++;
      if (v >= 1.0 && v <= 1.8) {
        slots[slotKey].inRange++;
      }
    });
  });

  Object.entries(slots).forEach(([slotLabel, data]) => {
    if (data.total >= 3) {
      const tir = data.inRange / data.total;
      if (tir < 0.50) {
        patterns.push({
          type: 'problem_time_slot',
          severity: 'info',
          icon: '⏰',
          message: `Créneau ${slotLabel} : contrôle insuffisant. Ajuster ratio/basale pour cette période.`,
          count: data.total - data.inRange,
        });
      }
    }
  });
}

// ─── PATTERN 6: Recurring Stacking ──────────────────────────────────────────
// Corrections within < 2h of each other, freq > 2x per week
function detectRecurringStacking(entries, patterns) {
  const correctionEntries = entries.filter(
    e => e.correction && e.correction > 0
  );

  if (correctionEntries.length < 2) return;

  let stackCount = 0;

  for (let i = 0; i < correctionEntries.length - 1; i++) {
    const diffH = (new Date(correctionEntries[i + 1].date) - new Date(correctionEntries[i].date)) / 3600000;
    if (diffH > 0 && diffH < 2) {
      stackCount++;
    }
  }

  const dataWindowDays = getDataWindowDays(entries);
  const weeks = Math.max(1, dataWindowDays / 7);
  const threshold = Math.max(2, Math.round(2 * weeks));

  if (stackCount >= Math.min(threshold, 2)) {
    patterns.push({
      type: 'recurring_stacking',
      severity: 'warning',
      icon: '⚡',
      message: 'Corrections rapprochées fréquentes \u2192 risque d\'empilement. Patience recommandée.',
      count: stackCount,
    });
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function getDataWindowDays(entries) {
  if (entries.length < 2) return 1;
  const first = new Date(entries[0].date);
  const last = new Date(entries[entries.length - 1].date);
  return Math.max(1, (last - first) / 86400000);
}
