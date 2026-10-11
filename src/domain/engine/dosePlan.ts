import type { BolusType, JournalEntry, SplitPhase } from '../types';
import { round05, num } from '../units';
import { getActualDose, getSuggestedDose } from '../journal';

export { getActualDose, getSuggestedDose };

export interface DosePlan {
  bolusType: BolusType;
  splitImmediate: number;
  splitDelayed: number;
  splitDelayMinutes: number;
  splitPhases: SplitPhase[] | null;
}

export function getSplitPlanTotal(entry: JournalEntry | DosePlan | null | undefined): number {
  const e = entry as Partial<JournalEntry & DosePlan> | null | undefined;
  if (!e) return 0;
  if (e.bolusType === 'etendu' && Array.isArray(e.splitPhases) && e.splitPhases.length > 0) {
    return round05(e.splitPhases.reduce((sum, phase) => sum + num(phase.units), 0));
  }
  if ((e.bolusType === 'fractionne' || e.bolusType === 'dual') && (e.splitImmediate != null || e.splitDelayed != null)) {
    return round05(num(e.splitImmediate) + num(e.splitDelayed));
  }
  return getActualDose(e as JournalEntry);
}

/** Redistribue un plan (unique / fractionné / étendu) sur une nouvelle dose totale. */
export function scaleDosePlan(plan: Partial<DosePlan> & { delayMinutes?: number } | null | undefined, referenceDose: number, targetDose: number): DosePlan {
  const nextDose = round05(Math.max(0, num(targetDose)));
  const bolusType: BolusType = plan?.bolusType ?? 'unique';
  const splitDelayMinutes = num(plan?.splitDelayMinutes ?? plan?.delayMinutes ?? 0);
  const fallbackReference = getSplitPlanTotal(plan as DosePlan);
  const baseDose = round05(referenceDose > 0 ? referenceDose : fallbackReference);

  if (bolusType === 'etendu' && Array.isArray(plan?.splitPhases) && plan.splitPhases.length > 0) {
    const sourcePhases = plan.splitPhases;
    const scaledPhases = sourcePhases.map((phase, index) => {
      if (index === sourcePhases.length - 1) {
        const used = sourcePhases
          .slice(0, index)
          .reduce((sum, current) => sum + round05(num(current.units) * (baseDose > 0 ? nextDose / baseDose : 0)), 0);
        return { ...phase, units: round05(Math.max(0, nextDose - used)) };
      }
      const scaledUnits = baseDose > 0 ? round05(num(phase.units) * nextDose / baseDose) : 0;
      return { ...phase, units: scaledUnits };
    });
    return {
      bolusType,
      splitImmediate: scaledPhases[0]?.units ?? nextDose,
      splitDelayed: round05(scaledPhases.slice(1).reduce((sum, phase) => sum + num(phase.units), 0)),
      splitDelayMinutes,
      splitPhases: scaledPhases,
    };
  }

  if ((bolusType === 'fractionne' || bolusType === 'dual') && (plan?.splitImmediate != null || plan?.splitDelayed != null)) {
    const splitImmediate = num(plan?.splitImmediate);
    const scaledImmediate = baseDose > 0 ? round05(splitImmediate * nextDose / baseDose) : nextDose;
    return {
      bolusType: 'fractionne',
      splitImmediate: scaledImmediate,
      splitDelayed: round05(Math.max(0, nextDose - scaledImmediate)),
      splitDelayMinutes,
      splitPhases: null,
    };
  }

  return {
    bolusType: nextDose > 0 ? bolusType : 'unique',
    splitImmediate: nextDose,
    splitDelayed: 0,
    splitDelayMinutes: 0,
    splitPhases: null,
  };
}
