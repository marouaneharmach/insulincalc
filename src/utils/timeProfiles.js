// src/utils/timeProfiles.js

export const PERIODS = [
  { key: 'matin',  label: 'Matin',  icon: '\u{1F305}', range: [6, 11] },
  { key: 'midi',   label: 'Midi',   icon: '\u2600\uFE0F', range: [11, 15] },
  { key: 'gouter', label: 'Go\u00FBter', icon: '\u{1F36A}', range: [15, 18] },
  { key: 'soir',   label: 'Soir',   icon: '\u{1F306}', range: [18, 22] },
  { key: 'nuit',   label: 'Nuit',   icon: '\u{1F319}', range: [22, 6] },  // wraps midnight
];

export const DEFAULT_PROFILES = null; // null = use single ratio/ISF (not per-period)

export function createDefaultProfiles(ratio, isf) {
  const profiles = {};
  for (const p of PERIODS) {
    profiles[p.key] = { ratio, isf };
  }
  return profiles;
}

export function getActiveProfile(profiles, currentHour) {
  if (!profiles) return null; // null = use single values

  for (const p of PERIODS) {
    const [start, end] = p.range;
    if (start < end) {
      // Normal range (e.g., 6-11)
      if (currentHour >= start && currentHour < end) {
        return { period: p.key, ...p, ratio: profiles[p.key].ratio, isf: profiles[p.key].isf };
      }
    } else {
      // Wrapping range (e.g., 22-6 = 22-24 + 0-6)
      if (currentHour >= start || currentHour < end) {
        return { period: p.key, ...p, ratio: profiles[p.key].ratio, isf: profiles[p.key].isf };
      }
    }
  }

  // Fallback (shouldn't happen)
  return { period: 'midi', ratio: profiles.midi.ratio, isf: profiles.midi.isf };
}

export function getCurrentPeriodKey(hour) {
  for (const p of PERIODS) {
    const [start, end] = p.range;
    if (start < end) {
      if (hour >= start && hour < end) return p.key;
    } else {
      if (hour >= start || hour < end) return p.key;
    }
  }
  return 'midi';
}
