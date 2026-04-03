/**
 * Glucose velocity calculator
 * Calculates the rate of change (g/L/h) between two glucose readings
 * and classifies the trend for clinical decision support.
 */

export function calcVelocity(currentG, previousG, intervalMinutes) {
  if (!previousG || !intervalMinutes || intervalMinutes <= 0) return null;
  return (currentG - previousG) / (intervalMinutes / 60);
}

export function classifyVelocity(velocity) {
  if (velocity === null) return 'unknown';
  if (velocity < -0.40) return 'falling_fast';
  if (velocity < -0.15) return 'falling';
  if (velocity <= 0.15) return 'stable';
  if (velocity <= 0.40) return 'rising';
  return 'rising_fast';
}

export const VELOCITY_DISPLAY = {
  falling_fast: { arrow: '↓↓', color: '#ef4444', label: 'Chute rapide' },
  falling:      { arrow: '↓',  color: '#f59e0b', label: 'Baisse modérée' },
  stable:       { arrow: '→',  color: '#22c55e', label: 'Stable' },
  rising:       { arrow: '↑',  color: '#f59e0b', label: 'Hausse modérée' },
  rising_fast:  { arrow: '↑↑', color: '#ef4444', label: 'Montée rapide' },
  unknown:      { arrow: '?',  color: '#64748b', label: 'Inconnu' },
};

export function adjustDoseForVelocity(correction, trend) {
  const factors = {
    falling_fast: 0,
    falling: 0.5,
    stable: 1.0,
    rising: 1.0,
    rising_fast: 1.2,
    unknown: 1.0,
  };
  return Math.round(correction * (factors[trend] ?? 1.0) * 2) / 2;
}
