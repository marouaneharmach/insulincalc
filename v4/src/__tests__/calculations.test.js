import { describe, it, expect } from 'vitest';
import {
  round05,
  calcIMC,
  calcBSA,
  calcBMR,
  imcCategory,
  calcWeightSuggestions,
  calcIOB,
  calcPostMealCorrection,
  getOverallFat,
  getDominantGI,
  buildSchedule,
  estimateHbA1c,
  detectPatterns,
} from '../utils/calculations';

// ─── TESTS UNITAIRES ─────────────────────────────────────────────────────────

describe('round05', () => {
  it('arrondit à 0.5 près', () => {
    expect(round05(3.2)).toBe(3);
    expect(round05(3.3)).toBe(3.5);
    expect(round05(3.7)).toBe(3.5);
    expect(round05(3.8)).toBe(4);
    expect(round05(0)).toBe(0);
    expect(round05(1.25)).toBe(1.5);
  });
});

describe('calcIMC', () => {
  it('calcule IMC correctement', () => {
    expect(calcIMC(70, 175)).toBeCloseTo(22.9, 1);
    expect(calcIMC(90, 180)).toBeCloseTo(27.8, 1);
  });

  it('retourne null pour valeurs invalides', () => {
    expect(calcIMC(0, 175)).toBeNull();
    expect(calcIMC(70, 0)).toBeNull();
    expect(calcIMC(70, 30)).toBeNull();
  });
});

describe('calcBSA', () => {
  it('calcule la surface corporelle (DuBois)', () => {
    const bsa = calcBSA(70, 175);
    expect(bsa).toBeGreaterThan(1.5);
    expect(bsa).toBeLessThan(2.5);
  });

  it('retourne null pour valeurs nulles', () => {
    expect(calcBSA(0, 175)).toBeNull();
    expect(calcBSA(70, 0)).toBeNull();
  });
});

describe('calcBMR', () => {
  it('calcule le métabolisme de base homme', () => {
    const bmr = calcBMR(70, 175, 30, 'M');
    expect(bmr).toBeGreaterThan(1500);
    expect(bmr).toBeLessThan(1800);
  });

  it('calcule le métabolisme de base femme', () => {
    const bmrF = calcBMR(60, 165, 30, 'F');
    expect(bmrF).toBeGreaterThan(1200);
    expect(bmrF).toBeLessThan(1500);
  });
});

describe('imcCategory', () => {
  it('classifie correctement les IMC', () => {
    expect(imcCategory(17)).toBe('Insuffisance pondérale');
    expect(imcCategory(22)).toBe('Poids normal');
    expect(imcCategory(27)).toBe('Surpoids');
    expect(imcCategory(32)).toBe('Obésité modérée');
    expect(imcCategory(37)).toBe('Obésité sévère');
    expect(imcCategory(42)).toBe('Obésité morbide');
  });
});

describe('calcWeightSuggestions', () => {
  it('génère des suggestions pour un adulte homme', () => {
    const s = calcWeightSuggestions(70, 30, 'M');
    expect(s).not.toBeNull();
    expect(s.tdd).toBeGreaterThan(20);
    expect(s.tdd).toBeLessThan(60);
    expect(s.icr).toBeGreaterThan(5);
    expect(s.isfMg).toBeGreaterThan(20);
    expect(s.ageGroup).toBe('adulte');
  });

  it('génère des suggestions pour enfant', () => {
    const s = calcWeightSuggestions(35, 8, 'M');
    expect(s.ageGroup).toBe('enfant');
    expect(s.tdd).toBeGreaterThan(15);
  });

  it('ajuste pour femme (~12% moins)', () => {
    const m = calcWeightSuggestions(70, 30, 'M');
    const f = calcWeightSuggestions(70, 30, 'F');
    expect(f.tdd).toBeLessThan(m.tdd);
  });

  it('retourne null hors bornes', () => {
    expect(calcWeightSuggestions(10, 30, 'M')).toBeNull();
    expect(calcWeightSuggestions(250, 30, 'M')).toBeNull();
  });
});

describe('calcIOB', () => {
  it('retourne dose complète au temps 0', () => {
    expect(calcIOB(10, 0, 180)).toBe(10);
  });

  it('retourne 0 après durée complète', () => {
    expect(calcIOB(10, 180, 180)).toBe(0);
    expect(calcIOB(10, 200, 180)).toBe(0);
  });

  it('décroît au fil du temps', () => {
    const iob60 = calcIOB(10, 60, 180);
    const iob120 = calcIOB(10, 120, 180);
    expect(iob60).toBeGreaterThan(iob120);
    expect(iob60).toBeGreaterThan(0);
    expect(iob120).toBeGreaterThan(0);
  });
});

describe('calcPostMealCorrection', () => {
  it('pas de correction si glycémie en cible', () => {
    const r = calcPostMealCorrection(1.0, 1.1, 50, 0);
    expect(r.units).toBe(0);
    expect(r.status).toBe('ok_low');
  });

  it('correction si glycémie élevée', () => {
    const r = calcPostMealCorrection(2.0, 1.1, 50, 0);
    expect(r.units).toBeGreaterThan(0);
    expect(r.status).toBe('correction');
  });

  it('soustrait IOB de la correction', () => {
    const r1 = calcPostMealCorrection(2.0, 1.1, 50, 0);
    const r2 = calcPostMealCorrection(2.0, 1.1, 50, 1);
    expect(r2.units).toBeLessThan(r1.units);
  });

  it('urgence si glycémie > 3.0 et IOB couvre tout', () => {
    const r = calcPostMealCorrection(3.5, 1.1, 50, 10);
    expect(r.status).toBe('urgent_override');
    expect(r.units).toBeGreaterThan(0);
  });
});

describe('getOverallFat', () => {
  it('retourne faible pour sélection vide', () => {
    expect(getOverallFat([])).toBe('faible');
  });

  it('détecte niveau gras correct', () => {
    const sel = [
      { food: { fat: 'élevé' }, mult: 1 },
      { food: { fat: 'élevé' }, mult: 1 },
    ];
    expect(getOverallFat(sel)).toBe('élevé');
  });

  it('moyenne correcte entre faible et élevé', () => {
    const sel = [
      { food: { fat: 'faible' }, mult: 1 },
      { food: { fat: 'élevé' }, mult: 1 },
    ];
    expect(getOverallFat(sel)).toBe('moyen');
  });
});

describe('getDominantGI', () => {
  it('retourne moyen par défaut', () => {
    expect(getDominantGI([])).toBe('moyen');
  });

  it('détecte IG dominant élevé', () => {
    const sel = [
      { food: { gi: 'élevé', carbs: 50 }, mult: 1 },
      { food: { gi: 'faible', carbs: 10 }, mult: 1 },
    ];
    expect(getDominantGI(sel)).toBe('élevé');
  });
});

describe('buildSchedule', () => {
  it('génère un planning standard', () => {
    const steps = buildSchedule(50, 5, 1, 0, 1.2, 1.1, 'normal', 'standard', 'moyen');
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps[0].units).toBeGreaterThan(0);
    expect(steps[steps.length - 1].units).toBeNull(); // contrôle fin
  });

  it('génère un planning dual avec 2 injections', () => {
    const steps = buildSchedule(50, 5, 1, 1, 1.2, 1.1, 'normal', 'dual', 'moyen');
    const injections = steps.filter(s => s.units != null);
    expect(injections.length).toBe(2);
  });

  it('pas de pré-délai si glycémie basse', () => {
    const steps = buildSchedule(50, 5, 0, 0, 0.6, 1.1, 'normal', 'standard', 'moyen');
    expect(Math.abs(steps[0].timeMin)).toBe(0);
  });
});

// ─── TESTS D'INTÉGRATION ─────────────────────────────────────────────────────

describe('[INTÉGRATION] Pipeline de calcul complet', () => {
  it('calcule dose complète: repas + correction + gras', () => {
    const totalCarbs = 60;
    const ratio = 10;
    const gVal = 2.0;
    const targetGMid = 1.1;
    const isf = 50;

    const bolusRepas = totalCarbs / ratio; // 6
    const ecart = gVal - targetGMid; // 0.9
    const correction = (ecart * 100) / isf; // 1.8
    const fatBonus = (totalCarbs / ratio) * 0.14; // 0.84

    const total = round05(bolusRepas + correction + fatBonus);
    expect(total).toBeGreaterThan(8);
    expect(total).toBeLessThan(10);
  });
});

// ─── TESTS DE NON-RÉGRESSION ─────────────────────────────────────────────────

describe('[NON-RÉGRESSION] Calculs v4.1 préservés', () => {
  it('round05(4.23) = 4 (existant v4)', () => {
    expect(round05(4.23)).toBe(4);
  });

  it('round05(4.26) = 4.5 (existant v4)', () => {
    expect(round05(4.26)).toBe(4.5);
  });

  it('IMC 70kg/175cm = ~22.9 (existant v4)', () => {
    expect(calcIMC(70, 175)).toBeCloseTo(22.9, 1);
  });

  it('IOB décroît correctement (existant v4)', () => {
    const iob = calcIOB(10, 90, 180);
    expect(iob).toBeCloseTo(3.5, 0.5);
  });

  it('getOverallFat fonctionne avec anciennes données', () => {
    const sel = [{ food: { fat: 'moyen' }, mult: 2 }];
    expect(getOverallFat(sel)).toBe('moyen');
  });
});
