/**
 * Prédiction glycémique simplifiée (estimation, non garantie).
 * Combine : dérive de tendance amortie, absorption des glucides, action de la dose
 * et décroissance de l'insuline déjà active.
 */
import type { FatLevel } from '../types';
import { roundTo } from '../units';
import { calcIOB } from '../insulin/iob';
import { CONSENSUS } from '../analytics/metrics';

export type PredictionZone = 'hypo' | 'bas' | 'cible' | 'haut' | 'hyper';

export interface PredictionInputs {
  glycemia: number;
  velocity: number | null;
  totalCarbs: number;
  dose: number;
  ratio: number;
  isfMgdl: number;
  iobTotal: number;
  fatLevel?: FatLevel | string;
  profile?: { diaMin: number; peakMin: number } | null;
  /** Avance de l'injection sur le repas (min), 15 par défaut. */
  injectionLeadMinutes?: number;
}

export interface PredictionPoint { minutes: number; value: number; low: number; high: number; zone: PredictionZone }

export interface GlucosePrediction {
  at1h: PredictionPoint;
  at2h: PredictionPoint;
  at3h: PredictionPoint;
  /** Compatibilité : valeur à +2 h. */
  predicted: number;
  delta: number;
  zone: PredictionZone;
  alerts: Array<'PREDICT_HYPO_1H' | 'PREDICT_HYPO_2H' | 'PREDICT_HYPER_2H'>;
}

export function classifyPrediction(gl: number): PredictionZone {
  if (gl < CONSENSUS.level1Low) return 'hypo';
  if (gl < 0.90) return 'bas';
  if (gl <= CONSENSUS.level1High) return 'cible';
  if (gl <= CONSENSUS.level2High) return 'haut';
  return 'hyper';
}

/**
 * Fraction des glucides absorbée à t minutes : courbe en S (démarrage lent, montée,
 * plateau) ; ≈ 70 % à 2 h pour un repas standard, plus lente pour les repas gras.
 */
function carbAbsorbed(minutes: number, fatLevel: FatLevel | string | undefined): number {
  const tau = fatLevel === 'élevé' ? 170 : fatLevel === 'moyen' ? 140 : 110;
  return 1 - Math.exp(-((minutes / tau) ** 2));
}

function point(inputs: PredictionInputs, minutes: number): PredictionPoint {
  const isfGl = Math.max(1, inputs.isfMgdl) / 100;
  const dia = inputs.profile?.diaMin ?? 270;
  const peak = inputs.profile?.peakMin ?? 75;
  const carbEffect = (Math.max(0, inputs.totalCarbs) / Math.max(1, inputs.ratio)) * isfGl * carbAbsorbed(minutes, inputs.fatLevel);
  // La dose est injectée ~15 min avant le repas : elle a une avance sur les glucides.
  const lead = inputs.injectionLeadMinutes ?? 15;
  const doseUsed = Math.max(0, inputs.dose) - calcIOB(Math.max(0, inputs.dose), minutes + lead, dia, peak);
  // L'IOB existante décroît selon la même courbe, approximée depuis son état moyen
  const existingUsed = Math.max(0, inputs.iobTotal) - calcIOB(Math.max(0, inputs.iobTotal), minutes, dia, Math.min(peak, 40));
  const drift = (inputs.velocity ?? 0) * Math.min(minutes, 60) / 60 * 0.6;
  const value = inputs.glycemia + carbEffect - (doseUsed + existingUsed) * isfGl + drift;
  const uncertainty = 0.2 + 0.03 * Math.max(0, inputs.dose) + 0.0015 * Math.max(0, inputs.totalCarbs) + (minutes / 60) * 0.05;
  const v = roundTo(Math.max(0.3, value), 2);
  return { minutes, value: v, low: roundTo(Math.max(0.3, value - uncertainty), 2), high: roundTo(value + uncertainty, 2), zone: classifyPrediction(v) };
}

export function predictGlucose(inputs: PredictionInputs): GlucosePrediction {
  const at1h = point(inputs, 60);
  const at2h = point(inputs, 120);
  const at3h = point(inputs, 180);
  const alerts: GlucosePrediction['alerts'] = [];
  if (at1h.low < CONSENSUS.level1Low && at1h.value < 0.90) alerts.push('PREDICT_HYPO_1H');
  if (at2h.value < CONSENSUS.level1Low) alerts.push('PREDICT_HYPO_2H');
  if (at2h.value > CONSENSUS.level2High) alerts.push('PREDICT_HYPER_2H');
  return { at1h, at2h, at3h, predicted: at2h.value, delta: roundTo(at2h.value - inputs.glycemia, 2), zone: at2h.zone, alerts };
}
