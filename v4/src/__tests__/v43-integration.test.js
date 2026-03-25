import { describe, it, expect } from 'vitest';
import { round05, calcPostMealCorrection, calcIOB, buildSchedule, getOverallFat, getDominantGI, calcWeightSuggestions } from '../utils/calculations';
import { validateGlycemia, validateDose } from '../utils/validation';
import fr from '../i18n/fr';
import ar from '../i18n/ar';

describe('[V4.3] Intégration — Pipeline calcul avec validation', () => {
  it('valide puis calcule correctement un repas standard', () => {
    const glyc = validateGlycemia('1.50');
    expect(glyc.valid).toBe(true);
    const correction = calcPostMealCorrection(glyc.value, 1.05, 50, 0);
    expect(correction.units).toBeGreaterThan(0);
    expect(correction.status).toBe('correction');
  });

  it('bloque un calcul avec glycémie invalide', () => {
    const glyc = validateGlycemia('0.1');
    expect(glyc.valid).toBe(false);
    // Le pipeline ne devrait pas continuer
  });

  it('pipeline complet: repas + correction + gras', () => {
    const totalCarbs = 60;
    const ratio = 10;
    const bolusRepas = totalCarbs / ratio; // 6
    const gVal = 1.8;
    const targetG = 1.05;
    const isf = 50;
    const correction = (gVal - targetG) * 100 / isf; // 1.5
    const fatBonus = bolusRepas * 0.14; // moyen = 0.84
    const total = round05(bolusRepas + correction + fatBonus);
    expect(total).toBe(8.5);
  });

  it('dose + validation seuil sécurité', () => {
    const dose = validateDose('25', 20);
    expect(dose.valid).toBe(true);
    expect(dose.warning).toBe('doseDepasseSeuil');
  });
});

describe('[V4.3] IOB — Scénarios avancés', () => {
  it('IOB à t=0 = dose complète', () => {
    expect(calcIOB(10, 0, 180)).toBe(10);
  });

  it('IOB à t=fin = 0', () => {
    expect(calcIOB(10, 180, 180)).toBe(0);
  });

  it('IOB à mi-parcours diminue progressivement', () => {
    const iob90 = calcIOB(10, 90, 180);
    const iob45 = calcIOB(10, 45, 180);
    expect(iob45).toBeGreaterThan(iob90);
    expect(iob90).toBeGreaterThan(0);
  });

  it('IOB négatif si temps > durée', () => {
    expect(calcIOB(10, 200, 180)).toBe(0);
  });
});

describe('[V4.3] buildSchedule — Scénarios spécifiques', () => {
  it('schedule standard a 3 étapes min (injection + 2 contrôles)', () => {
    const sched = buildSchedule(60, 6, 1, 0, 1.2, 1.05, 'normal', 'standard', 'moyen');
    expect(sched.length).toBeGreaterThanOrEqual(3);
    expect(sched.filter(s => s.units > 0).length).toBe(1);
  });

  it('schedule dual a 4 étapes min (2 injections + 2+ contrôles)', () => {
    const sched = buildSchedule(80, 8, 1, 1.5, 1.5, 1.05, 'lent', 'dual', 'moyen');
    expect(sched.filter(s => s.units > 0).length).toBe(2);
    expect(sched.length).toBeGreaterThanOrEqual(4);
  });

  it('glycémie basse → délai pré-injection réduit ou nul', () => {
    const sched = buildSchedule(40, 4, 0, 0, 0.6, 1.05, 'normal', 'standard', 'moyen');
    const injection = sched.find(s => s.units > 0);
    // preDelay is 0 when gVal < 0.8 or < 1.0, so timeMin should be 0 (no wait before meal)
    expect(Math.abs(injection.timeMin)).toBeLessThanOrEqual(0);
  });

  it('glycémie haute → délai augmenté', () => {
    const sched = buildSchedule(40, 4, 2, 0, 2.8, 1.05, 'normal', 'standard', 'moyen');
    const injection = sched.find(s => s.units > 0);
    expect(injection.timeMin).toBeLessThan(0); // negative = before meal
    expect(Math.abs(injection.timeMin)).toBeGreaterThanOrEqual(20);
  });
});

describe('[V4.3] calcWeightSuggestions — Tous les groupes d\'âge', () => {
  it('enfant (8 ans)', () => {
    const s = calcWeightSuggestions(30, 8, 'M');
    expect(s.ageGroup).toBe('enfant');
    expect(s.tdd).toBeGreaterThan(0);
    expect(s.icr).toBeGreaterThan(0);
  });

  it('ado (15 ans)', () => {
    const s = calcWeightSuggestions(55, 15, 'M');
    expect(s.ageGroup).toBe('ado');
  });

  it('adulte (35 ans, femme)', () => {
    const s = calcWeightSuggestions(65, 35, 'F');
    expect(s.ageGroup).toBe('adulte');
    // Femme → TDD * 0.88
    const sM = calcWeightSuggestions(65, 35, 'M');
    expect(s.tdd).toBeLessThan(sM.tdd);
  });

  it('senior (70 ans)', () => {
    const s = calcWeightSuggestions(75, 70, 'M');
    expect(s.ageGroup).toBe('senior');
  });
});

describe('[V4.3] i18n — Nouvelles clés V4.3', () => {
  const v43Keys = [
    'glycTropBasse', 'glycTropHaute', 'poidsHorsBornes', 'ratioHorsBornes',
    'isfHorsBornes', 'doseNegative', 'doseAbsurde', 'doseDepasseSeuil',
    'sauvegardeRestauration', 'exporter', 'importer',
    'tendances', 'hypos', 'tendance', 'tempsDansCible',
    'profilsHoraires', 'profilsHorairesDesc', 'matin', 'midi', 'soir', 'nuit',
    'doseEleveeDetectee', 'confirmerEnregistrer', 'annulerVerifier',
    'erreurInattendue', 'reessayer', 'redemarrer',
  ];

  v43Keys.forEach(key => {
    it(`FR contient la clé "${key}"`, () => {
      expect(fr[key]).toBeDefined();
      expect(fr[key].length).toBeGreaterThan(0);
    });

    it(`AR contient la clé "${key}"`, () => {
      expect(ar[key]).toBeDefined();
      expect(ar[key].length).toBeGreaterThan(0);
    });
  });
});
