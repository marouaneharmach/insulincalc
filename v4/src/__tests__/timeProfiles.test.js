import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getActiveProfile } from '../components/TimeProfiles';

describe('[V4.3] TimeProfiles — getActiveProfile', () => {
  const globalRatio = 10;
  const globalIsf = 50;

  it('retourne le ratio/isf global si pas de profils', () => {
    const result = getActiveProfile(null, globalRatio, globalIsf);
    expect(result.ratio).toBe(10);
    expect(result.isf).toBe(50);
    expect(result.slot).toBeNull();
  });

  it('retourne le ratio/isf global si tous les profils sont vides', () => {
    const profiles = [
      { id: 'matin', ratio: null, isf: null },
      { id: 'midi', ratio: null, isf: null },
      { id: 'soir', ratio: null, isf: null },
      { id: 'nuit', ratio: null, isf: null },
    ];
    const result = getActiveProfile(profiles, globalRatio, globalIsf);
    expect(result.ratio).toBe(10);
    expect(result.isf).toBe(50);
    expect(result.slot).toBeNull();
  });

  it('retourne le profil matin entre 6h et 11h', () => {
    const profiles = [
      { id: 'matin', label: '🌅 Matin', ratio: 8, isf: 40 },
      { id: 'midi', label: '☀️ Midi', ratio: 12, isf: 60 },
      { id: 'soir', label: '🌙 Soir', ratio: 15, isf: 70 },
      { id: 'nuit', label: '🌑 Nuit', ratio: 10, isf: 50 },
    ];

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T08:30:00'));

    const result = getActiveProfile(profiles, globalRatio, globalIsf);
    expect(result.ratio).toBe(8);
    expect(result.isf).toBe(40);
    expect(result.slot).toBe('matin');

    vi.useRealTimers();
  });

  it('retourne le profil midi entre 11h et 16h', () => {
    const profiles = [
      { id: 'matin', label: '🌅 Matin', ratio: 8, isf: 40 },
      { id: 'midi', label: '☀️ Midi', ratio: 12, isf: 60 },
      { id: 'soir', label: '🌙 Soir', ratio: 15, isf: 70 },
      { id: 'nuit', label: '🌑 Nuit', ratio: 10, isf: 50 },
    ];

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T13:00:00'));

    const result = getActiveProfile(profiles, globalRatio, globalIsf);
    expect(result.ratio).toBe(12);
    expect(result.isf).toBe(60);
    expect(result.slot).toBe('midi');

    vi.useRealTimers();
  });

  it('retourne le profil soir entre 16h et 22h', () => {
    const profiles = [
      { id: 'matin', label: '🌅 Matin', ratio: 8, isf: 40 },
      { id: 'midi', label: '☀️ Midi', ratio: 12, isf: 60 },
      { id: 'soir', label: '🌙 Soir', ratio: 15, isf: 70 },
      { id: 'nuit', label: '🌑 Nuit', ratio: 10, isf: 50 },
    ];

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T19:00:00'));

    const result = getActiveProfile(profiles, globalRatio, globalIsf);
    expect(result.ratio).toBe(15);
    expect(result.isf).toBe(70);
    expect(result.slot).toBe('soir');

    vi.useRealTimers();
  });

  it('retourne le profil nuit entre 22h et 6h', () => {
    const profiles = [
      { id: 'matin', label: '🌅 Matin', ratio: 8, isf: 40 },
      { id: 'midi', label: '☀️ Midi', ratio: 12, isf: 60 },
      { id: 'soir', label: '🌙 Soir', ratio: 15, isf: 70 },
      { id: 'nuit', label: '🌑 Nuit', ratio: 10, isf: 50 },
    ];

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T23:30:00'));

    const result = getActiveProfile(profiles, globalRatio, globalIsf);
    expect(result.ratio).toBe(10);
    expect(result.isf).toBe(50);
    expect(result.slot).toBe('nuit');

    vi.useRealTimers();
  });

  it('utilise le ratio global si le profil du slot est null', () => {
    const profiles = [
      { id: 'matin', label: '🌅 Matin', ratio: null, isf: 40 },
      { id: 'midi', label: '☀️ Midi', ratio: 12, isf: 60 },
      { id: 'soir', label: '🌙 Soir', ratio: 15, isf: 70 },
      { id: 'nuit', label: '🌑 Nuit', ratio: 10, isf: 50 },
    ];

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T08:00:00'));

    const result = getActiveProfile(profiles, globalRatio, globalIsf);
    expect(result.ratio).toBe(globalRatio); // fallback to global
    expect(result.isf).toBe(40);

    vi.useRealTimers();
  });
});
