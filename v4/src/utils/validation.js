// Medical input validation with i18n-ready error messages
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

export function validateGlycemia(value) {
  const v = parseFloat(value);
  if (isNaN(v) || value === '') return { valid: false, error: null }; // empty = no error yet
  if (v < LIMITS.glycemia.min) return { valid: false, error: 'glycTropBasse', value: v };
  if (v > LIMITS.glycemia.max) return { valid: false, error: 'glycTropHaute', value: v };
  return { valid: true, value: v };
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

export function validateDose(value, maxDose) {
  const v = parseFloat(value);
  if (isNaN(v)) return { valid: false, error: null };
  if (v < 0) return { valid: false, error: 'doseNegative' };
  if (v > LIMITS.dose.max) return { valid: false, error: 'doseAbsurde' };
  if (maxDose && v > maxDose) return { valid: true, warning: 'doseDepasseSeuil', value: v };
  return { valid: true, value: v };
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
