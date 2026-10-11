import { describe, it, expect } from 'vitest';
import { calcIOB } from '../domain/insulin/iob';
import { calculateDose, round05 } from '../domain/engine/clinicalEngine';
import { validateGlycemia, validateDose } from '../domain/validation';
import fr from '../i18n/fr';
import ar from '../i18n/ar';

describe('[V4.3] Intégration — Pipeline calcul avec validation', () => {
  it('valide puis calcule correctement une correction', () => {
    const glyc = validateGlycemia('1.50');
    expect(glyc.valid).toBe(true);
    const r = calculateDose({ totalCarbs: 0, glycemia: glyc.value, ratio: 10, isfMgdl: 50, targetMax: 1.05, iobTotal: 0, fatLevel: 'aucun', activity: 'aucune' });
    expect(r.correction).toBeCloseTo(0.9, 2);
    expect(r.doseSuggeree).toBe(1);
  });

  it('bloque un calcul avec glycémie invalide', () => {
    expect(validateGlycemia('0.1').valid).toBe(false);
  });

  it('pipeline complet: repas + correction + gras', () => {
    const r = calculateDose({ totalCarbs: 60, glycemia: 1.8, ratio: 10, isfMgdl: 50, targetMax: 1.05, iobTotal: 0, fatLevel: 'moyen', activity: 'aucune' });
    // bolus 6 + correction 1.5 + gras 0.84 = 8.34 → 8.5
    expect(r.doseSuggeree).toBe(8.5);
    expect(round05(8.34)).toBe(8.5);
  });

  it('dose + validation seuil sécurité', () => {
    const dose = validateDose('25', 20);
    expect(dose.valid).toBe(true);
    expect(dose.warning).toBe('Dose > seuil (20U)');
  });
});

describe('[V4.3] IOB — Scénarios avancés', () => {
  it('IOB à t=0 = dose complète', () => expect(calcIOB(10, 0, 180)).toBe(10));
  it('IOB à t=fin = 0', () => expect(calcIOB(10, 180, 180)).toBe(0));
  it('IOB diminue progressivement', () => {
    const iob90 = calcIOB(10, 90, 180);
    const iob45 = calcIOB(10, 45, 180);
    expect(iob45).toBeGreaterThan(iob90);
    expect(iob90).toBeGreaterThan(0);
  });
  it('IOB nul si temps > durée', () => expect(calcIOB(10, 200, 180)).toBe(0));
});

describe('[V4.3] i18n — Clés V4.3', () => {
  ['nouveauRepasBtn', 'correctionLabel', 'basalLabel', 'manualLabel', 'resumeInsulineJour'].forEach((key) => {
    it(`clé "${key}" présente en FR et AR`, () => {
      expect(fr[key]).toBeTruthy();
      expect(ar[key]).toBeTruthy();
    });
  });
});
