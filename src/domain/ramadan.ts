/**
 * Jeûne du Ramadan — d'après les IDF-DAR Practical Guidelines 2021.
 * Aide à la décision uniquement : les ajustements doivent être validés avec le médecin.
 */
import { round05 } from './units';

export type RamadanRiskCategory = 'moderate' | 'high' | 'very-high';

export interface RamadanRiskInputs {
  type1: boolean;
  hba1cPct?: number | null;
  /** Hypoglycémie sévère ou non ressentie dans les 3 derniers mois. */
  severeHypo3m?: boolean;
  hypoUnawareness?: boolean;
  recurrentHypo?: boolean;
  pregnancy?: boolean;
  kidneyDisease?: boolean;
  acuteIllness?: boolean;
  age?: number | null;
  /** Durée du jeûne (h) ; > 15 h aggrave le risque. */
  fastingHours?: number | null;
}

export interface RamadanRiskResult {
  score: number;
  category: RamadanRiskCategory;
  /** Codes d'explication traduits par l'interface. */
  reasons: string[];
  /** Codes de conseil. */
  advice: string[];
}

/**
 * Score simplifié inspiré de l'outil IDF-DAR 2021 : le DT1 est au moins « élevé » ;
 * une hypoglycémie sévère récente, une non-perception, une grossesse ou une maladie
 * aiguë placent en « très élevé ».
 */
export function assessRamadanRisk(i: RamadanRiskInputs): RamadanRiskResult {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, code: string) => { score += points; reasons.push(code); };

  if (i.type1) add(3.5, 'RAMADAN_REASON_T1');
  if (i.hba1cPct != null) {
    if (i.hba1cPct >= 9) add(2, 'RAMADAN_REASON_HBA1C_HIGH');
    else if (i.hba1cPct >= 7.5) add(1, 'RAMADAN_REASON_HBA1C_MODERATE');
  }
  if (i.severeHypo3m) add(5.5, 'RAMADAN_REASON_SEVERE_HYPO');
  if (i.hypoUnawareness) add(6.5, 'RAMADAN_REASON_UNAWARENESS');
  if (i.recurrentHypo) add(3.5, 'RAMADAN_REASON_RECURRENT_HYPO');
  if (i.pregnancy) add(6.5, 'RAMADAN_REASON_PREGNANCY');
  if (i.kidneyDisease) add(4, 'RAMADAN_REASON_KIDNEY');
  if (i.acuteIllness) add(6.5, 'RAMADAN_REASON_ILLNESS');
  if (i.age != null && i.age >= 70) add(1, 'RAMADAN_REASON_AGE');
  if (i.fastingHours != null && i.fastingHours > 15) add(1, 'RAMADAN_REASON_LONG_FAST');

  const category: RamadanRiskCategory = score > 6 ? 'very-high' : score >= 3.5 ? 'high' : 'moderate';
  const advice = ['RAMADAN_ADVICE_MEDICAL_REVIEW', 'RAMADAN_ADVICE_MONITOR', 'RAMADAN_ADVICE_BREAK_THRESHOLDS'];
  if (category === 'very-high') advice.unshift('RAMADAN_ADVICE_NOT_RECOMMENDED');
  return { score, category, reasons, advice };
}

export interface FastingPlan {
  basalReductionPct: number;
  basalSuggestedU: number | null;
  suhoorBolusFactor: number;
  iftarBolusFactor: number;
  correctionFactorWhileFasting: number;
  breakFastBelowGl: number;
  breakFastAboveGl: number;
  /** Codes de recommandations à afficher. */
  guidance: string[];
}

/**
 * Schéma basal-bolus (IDF-DAR 2021) : basale réduite de 15 à 30 % (prise à l'iftar) ;
 * bolus iftar inchangé ; bolus suhoor réduit de 25 à 50 % ; dose du midi omise ;
 * rompre le jeûne si glycémie < 0.70 g/L ou > 3.00 g/L, ou symptômes.
 */
export function buildFastingPlan(basalDoseU: number | null | undefined, opts: { basalReductionPct?: number; suhoorReductionPct?: number } = {}): FastingPlan {
  const basalReductionPct = Math.min(30, Math.max(15, opts.basalReductionPct ?? 20));
  const suhoorReductionPct = Math.min(50, Math.max(25, opts.suhoorReductionPct ?? 25));
  return {
    basalReductionPct,
    basalSuggestedU: basalDoseU && basalDoseU > 0 ? round05(basalDoseU * (1 - basalReductionPct / 100)) : null,
    suhoorBolusFactor: 1 - suhoorReductionPct / 100,
    iftarBolusFactor: 1,
    correctionFactorWhileFasting: 0.5,
    breakFastBelowGl: 0.70,
    breakFastAboveGl: 3.00,
    guidance: [
      'RAMADAN_GUIDE_BASAL_AT_IFTAR',
      'RAMADAN_GUIDE_SUHOOR_LATE',
      'RAMADAN_GUIDE_SKIP_LUNCH_DOSE',
      'RAMADAN_GUIDE_CHECK_TIMES',
      'RAMADAN_GUIDE_HYDRATION',
    ],
  };
}

/** Faut-il rompre le jeûne ? Codes : null si non. */
export function shouldBreakFast(glycemiaGl: number, hoursSinceStart?: number | null): 'SAFETY_FASTING_BREAK' | 'RAMADAN_BREAK_EARLY_LOW' | null {
  if (glycemiaGl < 0.70 || glycemiaGl > 3.00) return 'SAFETY_FASTING_BREAK';
  if (glycemiaGl < 0.90 && hoursSinceStart != null && hoursSinceStart <= 4) return 'RAMADAN_BREAK_EARLY_LOW';
  return null;
}
