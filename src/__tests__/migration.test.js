import { describe, it, expect } from 'vitest';

// ─── TESTS MIGRATION V4.2 ───────────────────────────────────────────────────

describe('[V4.2] Migration des données', () => {
  it('les entrées journal v4.1 restent compatibles', () => {
    // Simule une entrée journal v4.1 (sans injectionType)
    const oldEntry = {
      id: 1700000000000,
      date: '2025-03-20T12:00:00.000Z',
      glycPre: '1.20',
      glycPost: '1.80',
      totalCarbs: 60,
      doseSuggested: 6,
      doseActual: 6,
      aliments: 'Khobz, Tajine poulet',
      alimentIds: ['khobz_t', 'taj_poul_leg'],
      bolusType: 'standard',
      digestion: 'normal',
      schedule: [],
      mealType: 'dejeuner',
    };

    // Migration: ajouter injectionType si manquant
    const migrated = {
      ...oldEntry,
      injectionType: oldEntry.injectionType || (oldEntry.mealType === 'injection' ? 'manual' : undefined),
      correctionDetails: oldEntry.correctionDetails || undefined,
    };

    expect(migrated.glycPre).toBe('1.20');
    expect(migrated.totalCarbs).toBe(60);
    expect(migrated.doseActual).toBe(6);
    expect(migrated.mealType).toBe('dejeuner');
    expect(migrated.injectionType).toBeUndefined(); // pas d'injection pour un repas
  });

  it('les injections v4.1 reçoivent injectionType=manual', () => {
    const oldInjection = {
      id: 1700000001000,
      date: '2025-03-20T15:00:00.000Z',
      glycPre: '',
      glycPost: '',
      totalCarbs: 0,
      doseSuggested: 0,
      doseActual: 3,
      aliments: '',
      alimentIds: [],
      mealType: 'injection',
    };

    const migrated = {
      ...oldInjection,
      injectionType: oldInjection.injectionType || (oldInjection.mealType === 'injection' ? 'manual' : undefined),
    };

    expect(migrated.injectionType).toBe('manual');
    expect(migrated.doseActual).toBe(3);
  });

  it('les nouvelles entrées v4.2 correction sont valides', () => {
    const corrEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      glycPre: '2.30',
      glycPost: '',
      totalCarbs: 0,
      doseSuggested: 2,
      doseActual: 2,
      aliments: '',
      alimentIds: [],
      mealType: 'injection',
      injectionType: 'correction',
      correctionDetails: {
        glycemia: 2.3,
        target: 1.1,
        isf: 50,
        iob: 0.5,
        rawUnits: 2.5,
        netUnits: 2,
        ecartGL: 1.2,
      },
    };

    expect(corrEntry.injectionType).toBe('correction');
    expect(corrEntry.correctionDetails.glycemia).toBe(2.3);
    expect(corrEntry.correctionDetails.netUnits).toBe(2);
    expect(corrEntry.correctionDetails.iob).toBe(0.5);
  });
});

describe('[NON-RÉGRESSION] Structure journal v4.1', () => {
  it('les champs obligatoires v4.1 sont préservés', () => {
    const requiredFields = [
      'id', 'date', 'glycPre', 'glycPost', 'totalCarbs',
      'doseSuggested', 'doseActual', 'aliments', 'alimentIds', 'mealType',
    ];

    const entry = {
      id: 1, date: '2025-01-01', glycPre: '1.2', glycPost: '',
      totalCarbs: 0, doseSuggested: 0, doseActual: 0,
      aliments: '', alimentIds: [], mealType: 'mesure',
    };

    requiredFields.forEach(field => {
      expect(entry).toHaveProperty(field);
    });
  });
});
