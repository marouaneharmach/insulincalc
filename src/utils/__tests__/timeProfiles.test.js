// src/utils/__tests__/timeProfiles.test.js
import { describe, it, expect } from 'vitest';
import { getActiveProfile, createDefaultProfiles, getCurrentPeriodKey } from '../timeProfiles.js';

describe('timeProfiles', () => {
  const profiles = {
    matin:  { ratio: 8,  isf: 40 },
    midi:   { ratio: 10, isf: 50 },
    gouter: { ratio: 12, isf: 55 },
    soir:   { ratio: 10, isf: 50 },
    nuit:   { ratio: 10, isf: 50 },
  };

  it('should return morning profile at 8h', () => {
    const p = getActiveProfile(profiles, 8);
    expect(p.period).toBe('matin');
    expect(p.ratio).toBe(8);
    expect(p.isf).toBe(40);
  });

  it('should return night profile at 23h', () => {
    const p = getActiveProfile(profiles, 23);
    expect(p.period).toBe('nuit');
  });

  it('should return night profile at 3h (wraps midnight)', () => {
    const p = getActiveProfile(profiles, 3);
    expect(p.period).toBe('nuit');
  });

  it('should return null when no profiles', () => {
    expect(getActiveProfile(null, 8)).toBeNull();
  });

  it('should create default profiles from single values', () => {
    const p = createDefaultProfiles(10, 50);
    expect(p.matin.ratio).toBe(10);
    expect(p.soir.isf).toBe(50);
    expect(Object.keys(p)).toHaveLength(5);
  });

  it('should get current period key', () => {
    expect(getCurrentPeriodKey(8)).toBe('matin');
    expect(getCurrentPeriodKey(13)).toBe('midi');
    expect(getCurrentPeriodKey(16)).toBe('gouter');
    expect(getCurrentPeriodKey(20)).toBe('soir');
    expect(getCurrentPeriodKey(23)).toBe('nuit');
    expect(getCurrentPeriodKey(2)).toBe('nuit');
  });
});
