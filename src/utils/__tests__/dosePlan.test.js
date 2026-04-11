import { describe, expect, it } from 'vitest';
import { getActualDose, getSplitPlanTotal, getSuggestedDose, scaleDosePlan } from '../dosePlan';

describe('dosePlan helpers', () => {
  it('returns canonical suggested and actual doses', () => {
    const entry = { doseSuggeree: 15.5, doseReelle: 10 };
    expect(getSuggestedDose(entry)).toBe(15.5);
    expect(getActualDose(entry)).toBe(10);
  });

  it('falls back to suggested dose when no actual dose is stored yet', () => {
    const entry = { doseSuggeree: 6.5 };
    expect(getActualDose(entry)).toBe(6.5);
  });

  it('rescales a fractionne plan when the real dose changes', () => {
    const scaled = scaleDosePlan({
      bolusType: 'fractionne',
      splitImmediate: 9.5,
      splitDelayed: 6,
      splitDelayMinutes: 45,
    }, 15.5, 10);

    expect(scaled.splitImmediate).toBe(6);
    expect(scaled.splitDelayed).toBe(4);
    expect(getSplitPlanTotal(scaled)).toBe(10);
  });

  it('rescales a 3-phase extended plan to the actual dose', () => {
    const scaled = scaleDosePlan({
      bolusType: 'etendu',
      splitImmediate: 8,
      splitDelayed: 7.5,
      splitDelayMinutes: 60,
      splitPhases: [
        { label: 'Glucides rapides', delayMinutes: 0, units: 8, done: true },
        { label: 'Absorption graisses', delayMinutes: 60, units: 4.5, done: false },
        { label: 'Queue de digestion lente', delayMinutes: 180, units: 3, done: false },
      ],
    }, 15.5, 10);

    expect(scaled.splitPhases.map((phase) => phase.units)).toEqual([5, 3, 2]);
    expect(scaled.splitImmediate).toBe(5);
    expect(scaled.splitDelayed).toBe(5);
    expect(getSplitPlanTotal(scaled)).toBe(10);
  });
});
