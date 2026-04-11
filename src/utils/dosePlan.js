import { round05 } from './clinicalEngine';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getSuggestedDose(entry) {
  return toNumber(entry?.doseSuggeree ?? entry?.doseSuggested ?? entry?.doseCalculated ?? 0);
}

export function getActualDose(entry) {
  const actual = toNumber(entry?.doseActual ?? entry?.doseReelle ?? entry?.doseInjected ?? 0);
  return actual > 0 ? actual : getSuggestedDose(entry);
}

export function getSplitPlanTotal(entry) {
  if (entry?.bolusType === 'etendu' && Array.isArray(entry?.splitPhases) && entry.splitPhases.length > 0) {
    return round05(entry.splitPhases.reduce((sum, phase) => sum + toNumber(phase.units), 0));
  }

  if ((entry?.bolusType === 'fractionne' || entry?.bolusType === 'dual') && (entry?.splitImmediate != null || entry?.splitDelayed != null)) {
    return round05(toNumber(entry?.splitImmediate) + toNumber(entry?.splitDelayed));
  }

  return getActualDose(entry);
}

export function scaleDosePlan(plan, referenceDose, targetDose) {
  const nextDose = round05(Math.max(0, toNumber(targetDose)));
  const bolusType = plan?.bolusType ?? 'unique';
  const splitDelayMinutes = toNumber(plan?.splitDelayMinutes ?? plan?.delayMinutes ?? 0);
  const fallbackReference = getSplitPlanTotal(plan);
  const baseDose = round05(referenceDose > 0 ? referenceDose : fallbackReference);

  if (bolusType === 'etendu' && Array.isArray(plan?.splitPhases) && plan.splitPhases.length > 0) {
    const sourcePhases = plan.splitPhases;
    const scaledPhases = sourcePhases.map((phase, index) => {
      if (index === sourcePhases.length - 1) {
        const used = sourcePhases
          .slice(0, index)
          .reduce((sum, current) => sum + round05(toNumber(current.units) * (baseDose > 0 ? nextDose / baseDose : 0)), 0);
        return { ...phase, units: round05(Math.max(0, nextDose - used)) };
      }

      const scaledUnits = baseDose > 0 ? round05(toNumber(phase.units) * nextDose / baseDose) : 0;
      return { ...phase, units: scaledUnits };
    });

    return {
      bolusType,
      splitImmediate: scaledPhases[0]?.units ?? nextDose,
      splitDelayed: round05(scaledPhases.slice(1).reduce((sum, phase) => sum + toNumber(phase.units), 0)),
      splitDelayMinutes,
      splitPhases: scaledPhases,
    };
  }

  if ((bolusType === 'fractionne' || bolusType === 'dual') && (plan?.splitImmediate != null || plan?.splitDelayed != null)) {
    const splitImmediate = toNumber(plan?.splitImmediate);
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
