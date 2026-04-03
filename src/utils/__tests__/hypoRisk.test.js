import { describe, it, expect } from 'vitest';
import { calcHypoRiskScore, classifyRisk } from '../hypoRisk.js';

describe('hypoRisk', () => {
  it('should return low risk for normal values', () => {
    const score = calcHypoRiskScore({
      glycemia: 1.5, iobTotal: 0.5, trend: 'stable',
      hypoIn24h: false, activity: 'none', currentHour: 14,
    });
    expect(score).toBeLessThanOrEqual(2);
    expect(classifyRisk(score)).toBe('low');
  });

  it('should return critical for dangerous combination', () => {
    const score = calcHypoRiskScore({
      glycemia: 0.85, iobTotal: 3.5, trend: 'falling_fast',
      hypoIn24h: true, activity: 'intense', currentHour: 2,
    });
    expect(score).toBeGreaterThanOrEqual(9);
    expect(classifyRisk(score)).toBe('critical');
  });

  it('should add points for night hours', () => {
    const dayScore = calcHypoRiskScore({
      glycemia: 1.2, iobTotal: 1.5, trend: 'falling',
      hypoIn24h: false, activity: 'none', currentHour: 14,
    });
    const nightScore = calcHypoRiskScore({
      glycemia: 1.2, iobTotal: 1.5, trend: 'falling',
      hypoIn24h: false, activity: 'none', currentHour: 2,
    });
    expect(nightScore).toBeGreaterThan(dayScore);
  });

  it('should add points for physical activity', () => {
    const base = { glycemia: 1.4, iobTotal: 1, trend: 'stable', hypoIn24h: false, currentHour: 14 };
    const noActivity = calcHypoRiskScore({ ...base, activity: 'none' });
    const moderate = calcHypoRiskScore({ ...base, activity: 'moderee' });
    const intense = calcHypoRiskScore({ ...base, activity: 'intense' });
    expect(moderate).toBeGreaterThan(noActivity);
    expect(intense).toBeGreaterThan(moderate);
  });

  it('should classify risk levels correctly', () => {
    expect(classifyRisk(0)).toBe('low');
    expect(classifyRisk(2)).toBe('low');
    expect(classifyRisk(3)).toBe('moderate');
    expect(classifyRisk(5)).toBe('moderate');
    expect(classifyRisk(6)).toBe('high');
    expect(classifyRisk(8)).toBe('high');
    expect(classifyRisk(9)).toBe('critical');
    expect(classifyRisk(12)).toBe('critical');
  });
});
