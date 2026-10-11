import { roundTo } from './units';

export function calcIMC(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm || heightCm < 50) return null;
  const h = heightCm / 100;
  return roundTo(weightKg / (h * h), 1);
}

/** Surface corporelle (DuBois). */
export function calcBSA(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm) return null;
  return roundTo(0.007184 * Math.pow(weightKg, 0.425) * Math.pow(heightCm, 0.725), 2);
}

/** Métabolisme de base (Mifflin-St Jeor). */
export function calcBMR(weightKg: number, heightCm: number, age: number, sex: 'M' | 'F' | string): number | null {
  if (!weightKg || !heightCm || !age) return null;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'F' ? -161 : 5));
}

export type ImcCategory = 'underweight' | 'normal' | 'overweight' | 'obese1' | 'obese2' | 'obese3';

export function imcCategory(imc: number | null | undefined): ImcCategory | null {
  if (!imc) return null;
  if (imc < 18.5) return 'underweight';
  if (imc < 25) return 'normal';
  if (imc < 30) return 'overweight';
  if (imc < 35) return 'obese1';
  if (imc < 40) return 'obese2';
  return 'obese3';
}

/** Estimation de la dose totale quotidienne (U) : 0.5 U/kg adulte par défaut. */
export function estimateTDD(weightKg: number | null | undefined, perKg = 0.5): number | null {
  if (!weightKg || weightKg < 10) return null;
  return Math.round(weightKg * perKg);
}
