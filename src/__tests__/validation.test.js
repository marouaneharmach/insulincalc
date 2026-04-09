import { describe, it, expect } from 'vitest';
import { validateGlycemia, validateWeight, validateRatio, validateIsf, validateDose, validateAge, validateHeight, LIMITS } from '../utils/validation';

describe('[V4.3] Validation — Glycémie', () => {
  it('accepte glycémie valide dans la plage', () => {
    expect(validateGlycemia('1.20').valid).toBe(true);
    expect(validateGlycemia('0.30').valid).toBe(true);
    expect(validateGlycemia('6.00').valid).toBe(true);
    expect(validateGlycemia('0.7').valid).toBe(true);
  });

  it('rejette glycémie trop basse', () => {
    const r = validateGlycemia('0.2');
    expect(r.valid).toBe(false);
    expect(r.error).toBe('glycTropBasse');
  });

  it('rejette glycémie trop haute', () => {
    const r = validateGlycemia('6.5');
    expect(r.valid).toBe(false);
    expect(r.error).toBe('glycTropHaute');
  });

  it('retourne pas d\'erreur pour champ vide', () => {
    const r = validateGlycemia('');
    expect(r.valid).toBe(false);
    expect(r.error).toBeNull();
  });

  it('gère les entrées non numériques', () => {
    expect(validateGlycemia('abc').valid).toBe(false);
    expect(validateGlycemia('abc').error).toBeNull();
  });

  it('accepte les bornes exactes', () => {
    expect(validateGlycemia(String(LIMITS.glycemia.min)).valid).toBe(true);
    expect(validateGlycemia(String(LIMITS.glycemia.max)).valid).toBe(true);
  });
});

describe('[V4.3] Validation — Poids', () => {
  it('accepte poids normal', () => {
    expect(validateWeight('68').valid).toBe(true);
    expect(validateWeight('15').valid).toBe(true);
    expect(validateWeight('300').valid).toBe(true);
  });

  it('rejette poids hors bornes', () => {
    expect(validateWeight('10').error).toBe('poidsHorsBornes');
    expect(validateWeight('350').error).toBe('poidsHorsBornes');
  });

  it('gère champ vide', () => {
    expect(validateWeight('').valid).toBe(false);
    expect(validateWeight('').error).toBeNull();
  });
});

describe('[V4.3] Validation — Ratio ICR', () => {
  it('accepte ratio valide', () => {
    expect(validateRatio(10).valid).toBe(true);
    expect(validateRatio(1).valid).toBe(true);
    expect(validateRatio(50).valid).toBe(true);
  });

  it('rejette ratio hors bornes', () => {
    expect(validateRatio(0).error).toBe('ratioHorsBornes');
    expect(validateRatio(60).error).toBe('ratioHorsBornes');
  });
});

describe('[V4.3] Validation — ISF', () => {
  it('accepte ISF valide', () => {
    expect(validateIsf(50).valid).toBe(true);
    expect(validateIsf(5).valid).toBe(true);
    expect(validateIsf(200).valid).toBe(true);
  });

  it('rejette ISF hors bornes', () => {
    expect(validateIsf(3).error).toBe('isfHorsBornes');
    expect(validateIsf(250).error).toBe('isfHorsBornes');
  });
});

describe('[V4.3] Validation — Dose', () => {
  it('accepte dose normale', () => {
    expect(validateDose('5', 20).valid).toBe(true);
  });

  it('rejette dose négative', () => {
    expect(validateDose('-1', 20).error).toBe('doseNegative');
  });

  it('rejette dose absurde (> 100U)', () => {
    expect(validateDose('150', 20).error).toBe('doseAbsurde');
  });

  it('retourne warning si dose dépasse seuil mais < 100', () => {
    const r = validateDose('25', 20);
    expect(r.valid).toBe(true);
    expect(r.warning).toBe('Dose > seuil (20U)');
  });

  it('accepte dose au seuil exact', () => {
    const r = validateDose('20', 20);
    expect(r.valid).toBe(true);
    expect(r.warning).toBeNull();
  });
});

describe('[V4.3] Validation — Âge et Taille', () => {
  it('accepte âge valide', () => {
    expect(validateAge('30').valid).toBe(true);
    expect(validateAge('1').valid).toBe(true);
    expect(validateAge('120').valid).toBe(true);
  });

  it('rejette âge hors bornes', () => {
    expect(validateAge('0').error).toBe('ageHorsBornes');
    expect(validateAge('130').error).toBe('ageHorsBornes');
  });

  it('accepte taille valide', () => {
    expect(validateHeight('170').valid).toBe(true);
    expect(validateHeight('50').valid).toBe(true);
  });

  it('rejette taille hors bornes', () => {
    expect(validateHeight('30').error).toBe('tailleHorsBornes');
    expect(validateHeight('260').error).toBe('tailleHorsBornes');
  });
});

describe('[V4.3] LIMITS — Constantes de sécurité', () => {
  it('a des limites glycémie cohérentes', () => {
    expect(LIMITS.glycemia.min).toBe(0.3);
    expect(LIMITS.glycemia.max).toBe(6.0);
  });

  it('a des limites dose cohérentes', () => {
    expect(LIMITS.dose.min).toBe(0);
    expect(LIMITS.dose.max).toBe(100);
  });

  it('a des limites ratio cohérentes', () => {
    expect(LIMITS.ratio.min).toBeLessThan(LIMITS.ratio.max);
  });
});
