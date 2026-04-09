/**
 * Get the active time profile based on current hour.
 * Extracted from TimeProfiles.jsx to avoid fast-refresh warnings
 * (mixing component and non-component exports in the same file).
 */
export function getActiveProfile(timeProfiles, globalRatio, globalIsf) {
  if (!timeProfiles || timeProfiles.every(p => !p.ratio && !p.isf)) {
    return { ratio: globalRatio, isf: globalIsf, slot: null };
  }
  const h = new Date().getHours();
  let slotId;
  if (h >= 6 && h < 11) slotId = 'matin';
  else if (h >= 11 && h < 16) slotId = 'midi';
  else if (h >= 16 && h < 22) slotId = 'soir';
  else slotId = 'nuit';

  const profile = timeProfiles.find(p => p.id === slotId);
  return {
    ratio: profile?.ratio || globalRatio,
    isf: profile?.isf || globalIsf,
    slot: slotId,
    label: profile?.label || '',
  };
}
