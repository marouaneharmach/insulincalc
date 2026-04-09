// V4.4 — Medical input validation with mg/dL auto-conversion and context-aware warnings

export const LIMITS = {
  glycemia: { min: 0.3, max: 6.0 },
  weight: { min: 15, max: 300 },
  height: { min: 50, max: 250 },
  age: { min: 1, max: 120 },
  ratio: { min: 1, max: 50 },
  isf: { min: 5, max: 200 },
  targetG: { min: 0.5, max: 2.5 },
  maxDose: { min: 1, max: 100 },
  dose: { min: 0, max: 100 },
};

/**
 * Normalize glycemia input: accepts mg/dL (≥30) or g/L (<30)
 * Examples: 102 → 1.02 g/L, 135 → 1.35 g/L, 1.35 → 1.35 g/L
 */
export function normalizeGlycemia(input) {
  const raw = String(input).trim();
  if (!raw) return null;
  const v = parseFloat(raw);
  if (isNaN(v) || v <= 0) return null;
  // If ≥ 30, treat as mg/dL and convert to g/L
  if (v >= 30) {
    const gL = +(v / 100).toFixed(2);
    return { gL, original: v, unit: 'mg', display: `${v} mg → ${gL} g/L` };
  }
  return { gL: v, original: v, unit: 'gL', display: null };
}

/**
 * Get glycemia status with color + label for a value in g/L
 */
export function getGlycemiaStatus(gL) {
  if (gL < 0.5) return { label: '🚨 Hypo sévère', color: '#EF4444', severity: 'critical' };
  if (gL < 0.7) return { label: '⚠️ Hypoglycémie', color: '#F97316', severity: 'warning' };
  if (gL < 0.8) return { label: '↘ Limite basse', color: '#F59E0B', severity: 'caution' };
  if (gL <= 1.3) return { label: '✅ Zone cible', color: '#10B981', severity: 'ok' };
  if (gL <= 1.8) return { label: '↗ Élevée', color: '#F59E0B', severity: 'caution' };
  if (gL <= 2.5) return { label: '⚠️ Hyperglycémie', color: '#F97316', severity: 'warning' };
  if (gL <= 3.0) return { label: '🚨 Hyper sévère', color: '#EF4444', severity: 'critical' };
  return { label: '🏥 Urgence médicale', color: '#DC2626', severity: 'emergency' };
}

// --- Individual validators (backward compat) ---

export function validateGlycemia(value) {
  const norm = normalizeGlycemia(value);
  if (!norm) return { valid: false, error: null };
  const v = norm.gL;
  if (v < LIMITS.glycemia.min) return { valid: false, error: 'glycTropBasse', value: v, normalized: norm };
  if (v > LIMITS.glycemia.max) return { valid: false, error: 'glycTropHaute', value: v, normalized: norm };
  return { valid: true, value: v, normalized: norm };
}

export function validateWeight(value) {
  const v = parseFloat(value);
  if (isNaN(v) || value === '') return { valid: false, error: null };
  if (v < LIMITS.weight.min || v > LIMITS.weight.max) return { valid: false, error: 'poidsHorsBornes', value: v };
  return { valid: true, value: v };
}

export function validateRatio(value) {
  const v = Number(value);
  if (v < LIMITS.ratio.min || v > LIMITS.ratio.max) return { valid: false, error: 'ratioHorsBornes' };
  return { valid: true, value: v };
}

export function validateIsf(value) {
  const v = Number(value);
  if (v < LIMITS.isf.min || v > LIMITS.isf.max) return { valid: false, error: 'isfHorsBornes' };
  return { valid: true, value: v };
}

export function validateDose(value, maxDose, context = {}) {
  const v = parseFloat(value);
  if (isNaN(v)) return { valid: false, error: null };
  if (v < 0) return { valid: false, error: 'doseNegative' };
  if (v > LIMITS.dose.max) return { valid: false, error: 'doseAbsurde' };
  const warnings = [];
  if (maxDose && v > maxDose) warnings.push(`Dose > seuil (${maxDose}U)`);
  if (context.weight && v > parseFloat(context.weight) * 0.3) {
    warnings.push(`Dose élevée pour ${context.weight}kg`);
  }
  return { valid: true, value: v, warning: warnings[0] || null, warnings };
}

export function validateAge(value) {
  const v = parseInt(value);
  if (isNaN(v) || value === '') return { valid: false, error: null };
  if (v < LIMITS.age.min || v > LIMITS.age.max) return { valid: false, error: 'ageHorsBornes' };
  return { valid: true, value: v };
}

export function validateHeight(value) {
  const v = parseFloat(value);
  if (isNaN(v) || value === '') return { valid: false, error: null };
  if (v < LIMITS.height.min || v > LIMITS.height.max) return { valid: false, error: 'tailleHorsBornes' };
  return { valid: true, value: v };
}

/**
 * Validate total daily dose against patient weight
 */
export function validateTDD(totalDayDose, weight) {
  if (!weight || !totalDayDose) return { valid: true };
  const w = parseFloat(weight);
  const d = parseFloat(totalDayDose);
  if (isNaN(w) || isNaN(d)) return { valid: true };
  if (d > w * 1.5) return { valid: true, warning: `Dose quotidienne élevée (${d.toFixed(0)}U pour ${w}kg)` };
  return { valid: true };
}

/**
 * Validate carb total for a meal
 */
export function validateCarbs(total) {
  const v = parseFloat(total);
  if (isNaN(v) || v < 0) return { valid: false };
  if (v > 300) return { valid: true, warning: 'Apport > 300g — vérifiez les quantités' };
  if (v > 200) return { valid: true, warning: 'Apport glucidique très élevé (>200g)' };
  return { valid: true };
}
