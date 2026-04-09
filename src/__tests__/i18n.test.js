import { describe, it, expect } from 'vitest';
import fr from '../i18n/fr';
import ar from '../i18n/ar';

// ─── TESTS I18N ──────────────────────────────────────────────────────────────

describe('Traductions FR/AR synchronisées', () => {
  const frKeys = Object.keys(fr);
  const arKeys = Object.keys(ar);

  it('FR et AR ont le même nombre de clés', () => {
    const missing = frKeys.filter(k => !arKeys.includes(k));
    const extra = arKeys.filter(k => !frKeys.includes(k));
    if (missing.length > 0) console.warn('Clés FR manquantes en AR:', missing);
    if (extra.length > 0) console.warn('Clés AR en trop:', extra);
    expect(missing.length).toBe(0);
    expect(extra.length).toBe(0);
  });

  it('aucune valeur FR vide', () => {
    frKeys.forEach(key => {
      expect(fr[key], `FR key "${key}" est vide`).not.toBe('');
    });
  });

  it('aucune valeur AR vide', () => {
    arKeys.forEach(key => {
      expect(ar[key], `AR key "${key}" est vide`).not.toBe('');
    });
  });
});

// ─── V4.2 : Nouvelles clés ───────────────────────────────────────────────────

describe('[V4.2] Nouvelles clés de traduction', () => {
  const newKeys = [
    'nouveauRepasBtn',
    'correctionLabel',
    'basalLabel',
    'manualLabel',
    'injecterCorrection',
    'correctionConfirmee',
    'resumeInsulineJour',
    'enCours',
    'restant',
    'etapes',
    'ketoCategory',
    'saladeMarocaineCategory',
  ];

  newKeys.forEach(key => {
    it(`clé "${key}" existe en FR`, () => {
      expect(fr[key]).toBeDefined();
      expect(fr[key]).not.toBe('');
    });

    it(`clé "${key}" existe en AR`, () => {
      expect(ar[key]).toBeDefined();
      expect(ar[key]).not.toBe('');
    });
  });
});

// ─── NON-RÉGRESSION : Clés v4.1 ─────────────────────────────────────────────

describe('[NON-RÉGRESSION] Clés v4.1 préservées', () => {
  const criticalKeys = [
    'appName',
    'glycemie',
    'doseTotale',
    'disclaimerBanner',
    'tabHome',
    'tabTimeline',
    'ajouterGlycemie',
    'ajouterInsuline',
    'nouveauRepas',
    'insulineActive',
  ];

  criticalKeys.forEach(key => {
    it(`clé critique "${key}" préservée en FR`, () => {
      expect(fr[key]).toBeDefined();
    });

    it(`clé critique "${key}" préservée en AR`, () => {
      expect(ar[key]).toBeDefined();
    });
  });
});
