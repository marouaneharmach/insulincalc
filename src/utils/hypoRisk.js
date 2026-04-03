/**
 * Hypo Risk Score — 6-factor scoring algorithm
 * Evaluates hypoglycemia risk based on current glycemia, insulin on board,
 * trend, recent hypo events, physical activity, and time of day.
 */

import { isNightMode } from './clinicalEngine.js';

export function calcHypoRiskScore({ glycemia, iobTotal, trend, hypoIn24h, activity, currentHour }) {
  let score = 0;

  // Factor 1: Current glycemia
  if (glycemia < 1.00) score += 3;
  else if (glycemia < 1.20) score += 2;
  else if (glycemia < 1.50) score += 1;

  // Factor 2: IOB residual
  if (iobTotal > 3) score += 3;
  else if (iobTotal > 2) score += 2;
  else if (iobTotal > 1) score += 1;

  // Factor 3: Trend (velocity classification)
  if (trend === 'falling_fast') score += 3;
  else if (trend === 'falling') score += 2;
  else if (trend === 'stable') score += 0;

  // Factor 4: Recent hypo (24h)
  if (hypoIn24h) score += 2;

  // Factor 5: Physical activity
  if (activity === 'intense') score += 2;
  else if (activity === 'moderee') score += 1;

  // Factor 6: Night hours (uses same definition as clinical engine: 21h-05h)
  if (isNightMode(currentHour)) score += 1;

  return score;
}

export function classifyRisk(score) {
  if (score <= 2) return 'low';
  if (score <= 5) return 'moderate';
  if (score <= 8) return 'high';
  return 'critical';
}

export const RISK_DISPLAY = {
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  label: 'Faible', icon: '✅' },
  moderate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'Modéré', icon: '⚠️' },
  high:     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  label: 'Élevé', icon: '🔴' },
  critical: { color: '#991b1b', bg: 'rgba(153,27,27,0.15)', border: 'rgba(153,27,27,0.5)',  label: 'Critique', icon: '🚨' },
};
