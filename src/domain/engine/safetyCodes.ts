/**
 * Codes d'alerte du moteur clinique. Le moteur n'émet jamais de texte :
 * l'interface traduit `code` + `params` via i18n (clés identiques aux codes).
 * `type` conserve l'ancien identifiant (compatibilité journal et tests).
 */
export type Severity = 'risk' | 'warning' | 'info';

export type SafetyCode =
  | 'SAFETY_ANTI_HYPO'
  | 'SAFETY_HYPO_PROCHE'
  | 'SAFETY_SUR_CORRECTION'
  | 'SAFETY_VELOCITY_FALLING_FAST'
  | 'SAFETY_VELOCITY_RISING_FAST'
  | 'SAFETY_ANTI_STACKING'
  | 'SAFETY_IOB_RATIO'
  | 'SAFETY_TIMING'
  | 'SAFETY_CORRECTION_CAPPED'
  | 'SAFETY_CUMUL_HIGH'
  | 'SAFETY_NIGHT_BLOCK'
  | 'SAFETY_NIGHT_REDUCE'
  | 'SAFETY_NIGHT_LOW'
  | 'SAFETY_POST_KETO'
  | 'SAFETY_ILLNESS'
  | 'SAFETY_DOSE_ELEVEE'
  | 'SAFETY_MAX_DOSE'
  | 'SAFETY_HYPO_RISK_HIGH'
  | 'SAFETY_HYPO_RISK_CRITICAL'
  | 'SAFETY_FASTING_BREAK'
  | 'SAFETY_FASTING_SUHOOR_REDUCE'
  | 'SAFETY_FASTING_CORRECTION_REDUCE';

export const SAFETY_LEGACY_TYPE: Record<SafetyCode, string> = {
  SAFETY_ANTI_HYPO: 'anti-hypo',
  SAFETY_HYPO_PROCHE: 'hypo-proche',
  SAFETY_SUR_CORRECTION: 'sur-correction',
  SAFETY_VELOCITY_FALLING_FAST: 'velocity-falling-fast',
  SAFETY_VELOCITY_RISING_FAST: 'velocity-rising-fast',
  SAFETY_ANTI_STACKING: 'anti-stacking',
  SAFETY_IOB_RATIO: 'iob-ratio',
  SAFETY_TIMING: 'alerte-timing',
  SAFETY_CORRECTION_CAPPED: 'correction-cappee',
  SAFETY_CUMUL_HIGH: 'cumul-corrections',
  SAFETY_NIGHT_BLOCK: 'nuit-blocage',
  SAFETY_NIGHT_REDUCE: 'nuit-reduction',
  SAFETY_NIGHT_LOW: 'nuit-basse',
  SAFETY_POST_KETO: 'post-keto',
  SAFETY_ILLNESS: 'maladie',
  SAFETY_DOSE_ELEVEE: 'dose-elevee',
  SAFETY_MAX_DOSE: 'dose-max',
  SAFETY_HYPO_RISK_HIGH: 'risque-hypo-eleve',
  SAFETY_HYPO_RISK_CRITICAL: 'risque-hypo-critique',
  SAFETY_FASTING_BREAK: 'jeune-rompre',
  SAFETY_FASTING_SUHOOR_REDUCE: 'jeune-suhoor',
  SAFETY_FASTING_CORRECTION_REDUCE: 'jeune-correction',
};

export interface SafetyAlert {
  type: string;
  code: SafetyCode;
  severity: Severity;
  params: Record<string, string | number>;
}

export function makeAlert(code: SafetyCode, severity: Severity, params: Record<string, string | number> = {}): SafetyAlert {
  return { type: SAFETY_LEGACY_TYPE[code], code, severity, params };
}
