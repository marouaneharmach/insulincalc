import type { Activity } from '../types';
import { isNightHour } from '../time';
import type { VelocityClass } from './velocity';

export type HypoRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface HypoRiskInputs {
  glycemia: number;
  iobTotal: number;
  velocityClass: VelocityClass;
  hypoIn24h: boolean;
  activity: Activity | string;
  hour: number;
  nightStart?: number;
  nightEnd?: number;
}

export interface HypoRiskResult {
  score: number;
  level: HypoRiskLevel;
  factors: Array<{ factor: 'glycemia' | 'iob' | 'trend' | 'recentHypo' | 'activity' | 'night'; points: number }>;
}

/** Score composite à 6 facteurs (spec F4). 0-2 faible, 3-5 modéré, 6-8 élevé, ≥ 9 critique. */
export function calcHypoRisk(input: HypoRiskInputs): HypoRiskResult {
  const factors: HypoRiskResult['factors'] = [];
  const add = (factor: HypoRiskResult['factors'][number]['factor'], points: number) => {
    if (points > 0) factors.push({ factor, points });
  };

  if (input.glycemia < 1.00) add('glycemia', 3);
  else if (input.glycemia < 1.20) add('glycemia', 2);
  else if (input.glycemia < 1.50) add('glycemia', 1);

  if (input.iobTotal > 3) add('iob', 3);
  else if (input.iobTotal > 2) add('iob', 2);
  else if (input.iobTotal > 1) add('iob', 1);

  if (input.velocityClass === 'falling_fast') add('trend', 3);
  else if (input.velocityClass === 'falling') add('trend', 2);

  if (input.hypoIn24h) add('recentHypo', 2);

  if (input.activity === 'intense') add('activity', 2);
  else if (input.activity === 'moderee') add('activity', 1);

  if (isNightHour(input.hour, input.nightStart ?? 22, input.nightEnd ?? 6)) add('night', 1);

  const score = factors.reduce((s, f) => s + f.points, 0);
  return { score, level: classifyHypoRisk(score), factors };
}

export function classifyHypoRisk(score: number): HypoRiskLevel {
  if (score <= 2) return 'low';
  if (score <= 5) return 'moderate';
  if (score <= 8) return 'high';
  return 'critical';
}
