import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '../../types';
import { toLocalISO } from '../../time';
import { detectPatterns, selectWindowEntries } from '../patterns';
import type { DetectedPattern, PatternCode } from '../patterns';

// ─── Fixtures ───────────────────────────────────────────────────────────────
// Journal synthétique d'octobre 2026, heure locale. `now` = 11 oct. 23:00 → fenêtre
// de 14 jours depuis le 27 sept. 23:00. Un jour ≤ 0 est normalisé par Date (0 = 30 sept.).

const NOW = new Date(2026, 9, 11, 23, 0);
const at = (day: number, hour: number, minute = 0): Date => new Date(2026, 9, day, hour, minute);

let seq = 0;
function entry(date: Date, overrides: Partial<JournalEntry> = {}): JournalEntry {
  seq += 1;
  return { id: `e${seq}`, date: toLocalISO(date), ...overrides };
}

/** Lecture ponctuelle (entrée « mesure »). */
const reading = (date: Date, value: number): JournalEntry => entry(date, { mealType: 'mesure', glycPre: value });

/** Repas avec dose suggérée = dose réelle = 4 U par défaut. */
const meal = (date: Date, overrides: Partial<JournalEntry> = {}): JournalEntry =>
  entry(date, { mealType: 'déjeuner', glycPre: 1.2, totalGlucides: 40, doseSuggeree: 4, doseReelle: 4, ...overrides });

/** Correction isolée. */
const correction = (date: Date, dose = 1): JournalEntry =>
  entry(date, { mealType: 'injection', injectionType: 'correction', doseReelle: dose });

/** 5 lectures neutres (1.20 g/L à 15h, jours 1 à 5) : franchissent le garde-fou sans déclencher de schéma. */
const fillers = (): JournalEntry[] => [1, 2, 3, 4, 5].map((d) => reading(at(d, 15), 1.2));

const run = (entries: JournalEntry[], opts: Parameters<typeof detectPatterns>[1] = {}): DetectedPattern[] =>
  detectPatterns(entries, { now: NOW, ...opts });

const codes = (patterns: DetectedPattern[]): PatternCode[] => patterns.map((p) => p.code);

function find(patterns: DetectedPattern[], code: PatternCode): DetectedPattern {
  const found = patterns.find((p) => p.code === code);
  if (!found) throw new Error(`schéma ${code} absent (${codes(patterns).join(', ') || 'aucun'})`);
  return found;
}

// ─── Garde-fous et fenêtre ──────────────────────────────────────────────────

describe('detectPatterns — garde-fous', () => {
  it('renvoie [] pour un journal vide ou de moins de 5 entrées', () => {
    expect(run([])).toEqual([]);
    // 4 hypos matinales flagrantes mais seulement 4 entrées
    const few = [2, 3, 4, 5].map((d) => reading(at(d, 7), 0.55));
    expect(run(few)).toEqual([]);
  });

  it('ignore les entrées hors fenêtre, sans date ou à date invalide', () => {
    const old = [1, 2, 3, 4, 5].map((d) => reading(new Date(2026, 7, d, 7), 0.55)); // août
    expect(run(old)).toEqual([]);
    const broken: JournalEntry[] = [
      { id: 'x1', date: '' },
      { id: 'x2', date: 'pas-une-date' },
      ...fillers(),
    ];
    expect(run(broken)).toEqual([]);
  });

  it('selectWindowEntries trie par date croissante et borne la fenêtre', () => {
    const a = reading(at(5, 8), 1.2);
    const b = reading(at(2, 8), 1.2);
    const future = reading(at(12, 8), 1.2);
    const old = reading(at(-20, 8), 1.2);
    const selected = selectWindowEntries([a, future, old, b], NOW, 14);
    expect(selected.map((e) => e.id)).toEqual([b.id, a.id]);
  });

  it('accepte un journal non trié (résultat identique)', () => {
    const entries = [...fillers(), ...[2, 4].map((d) => reading(at(d, 7), 0.6))];
    const reversed = [...entries].reverse();
    expect(run(reversed)).toEqual(run(entries));
  });

  it('porte windowDays sur chaque schéma', () => {
    const entries = [...fillers(), ...[2, 4].map((d) => reading(at(d, 7), 0.6))];
    const p = find(run(entries, { days: 10 }), 'PATTERN_MORNING_HYPO');
    expect(p.windowDays).toBe(10);
  });
});

// ─── 1. Phénomène de l'aube ─────────────────────────────────────────────────

describe('PATTERN_DAWN', () => {
  it('détecte une montée nocturne > 0.30 g/L sur ≥ 3 jours', () => {
    const entries: JournalEntry[] = [];
    for (let d = 1; d <= 4; d += 1) {
      entries.push(reading(at(d, 21, 30), 1.2)); // dernière lecture du soir
      entries.push(reading(at(d + 1, 7), 1.7)); // première du matin, +0.50
    }
    const p = find(run(entries), 'PATTERN_DAWN');
    expect(p.severity).toBe('warning');
    expect(p.count).toBe(4);
    expect(p.params).toEqual({ days: 4 });
  });

  it('considère une lecture entre 00h et 02h comme la fin de la nuit précédente', () => {
    const entries: JournalEntry[] = [];
    for (let d = 2; d <= 4; d += 1) {
      entries.push(reading(at(d, 1, 15), 1.1));
      entries.push(reading(at(d, 7, 30), 1.6));
    }
    expect(codes(run(entries))).toContain('PATTERN_DAWN');
  });

  it('fonctionne avec des repas (post du dîner à +2 h, pré du petit-déjeuner)', () => {
    const entries: JournalEntry[] = [];
    for (let d = 1; d <= 5; d += 1) {
      entries.push(meal(at(d, 20), { mealType: 'dîner', glycPre: 1.1, glycPost: 1.3 }));
      entries.push(meal(at(d + 1, 7, 30), { mealType: 'petit-déjeuner', glycPre: 1.8 }));
    }
    expect(find(run(entries), 'PATTERN_DAWN').count).toBe(5);
  });

  it('ne se déclenche pas si la montée est ≤ 0.30 ou sur moins de 3 jours', () => {
    const small: JournalEntry[] = [];
    for (let d = 1; d <= 4; d += 1) {
      small.push(reading(at(d, 21, 30), 1.2));
      small.push(reading(at(d + 1, 7), 1.45)); // +0.25
    }
    expect(codes(run(small))).not.toContain('PATTERN_DAWN');

    const twoDays: JournalEntry[] = [...fillers()];
    for (let d = 1; d <= 2; d += 1) {
      twoDays.push(reading(at(d, 21, 30), 1.2));
      twoDays.push(reading(at(d + 1, 7), 1.7));
    }
    expect(codes(run(twoDays))).not.toContain('PATTERN_DAWN');
  });
});

// ─── 2. Hypos matinales ─────────────────────────────────────────────────────

describe('PATTERN_MORNING_HYPO', () => {
  it('détecte une lecture < 0.70 entre 04h et 10h sur ≥ 2 jours distincts', () => {
    const entries = [...fillers(), reading(at(2, 7), 0.6), reading(at(4, 4, 30), 0.65)];
    const p = find(run(entries), 'PATTERN_MORNING_HYPO');
    expect(p.severity).toBe('warning');
    expect(p.count).toBe(2);
    expect(p.params).toEqual({ days: 2, readings: 2 });
  });

  it('exige des jours distincts et l’intervalle 04h–10h', () => {
    const sameDay = [...fillers(), reading(at(2, 7), 0.6), reading(at(2, 9), 0.6)];
    expect(codes(run(sameDay))).not.toContain('PATTERN_MORNING_HYPO');
    const tooLate = [...fillers(), reading(at(2, 11), 0.6), reading(at(4, 10), 0.6)];
    expect(codes(run(tooLate))).not.toContain('PATTERN_MORNING_HYPO');
  });
});

// ─── 3. Rebond de Somogyi ───────────────────────────────────────────────────

describe('PATTERN_SOMOGYI', () => {
  it('détecte une hypo suivie d’une lecture > 2.00 dans les 4 h (info, dès 1 occurrence)', () => {
    const entries = [...fillers(), reading(at(3, 14), 0.55), reading(at(3, 16), 2.3)];
    const p = find(run(entries), 'PATTERN_SOMOGYI');
    expect(p.severity).toBe('info');
    expect(p.count).toBe(1);
  });

  it('ne compte qu’une fois un rebond précédé de plusieurs lectures basses', () => {
    const entries = [
      ...fillers(),
      meal(at(3, 14), { glycPre: 0.5, glycPost: 0.55 }), // post à 16h
      reading(at(3, 17), 2.3),
    ];
    expect(find(run(entries), 'PATTERN_SOMOGYI').count).toBe(1);
  });

  it('ignore une hyper survenant plus de 4 h après l’hypo', () => {
    const entries = [...fillers(), reading(at(3, 14), 0.55), reading(at(3, 19), 2.3)];
    expect(codes(run(entries))).not.toContain('PATTERN_SOMOGYI');
  });
});

// ─── 4. Sur-correction ──────────────────────────────────────────────────────

describe('PATTERN_OVER_CORRECTION', () => {
  it('détecte dose réelle > suggérée × 1.20 dans plus de 50 % des cas (n ≥ 4)', () => {
    const entries = [...fillers(), ...[2, 3, 4, 5].map((d) => meal(at(d, 12), { doseSuggeree: 4, doseReelle: 6 }))];
    const p = find(run(entries), 'PATTERN_OVER_CORRECTION');
    expect(p.severity).toBe('warning');
    expect(p.count).toBe(4);
    expect(p.total).toBe(4);
    expect(p.params).toEqual({ pct: 100 });
  });

  it('lit les champs v4 (doseCalculated / doseInjected / preMealGlycemia)', () => {
    const entries = [2, 3, 4, 5, 6].map((d) =>
      entry(at(d, 12), { mealType: 'déjeuner', preMealGlycemia: 1.2, totalCarbs: 40, doseCalculated: 4, doseInjected: 6 }),
    );
    expect(codes(run(entries))).toContain('PATTERN_OVER_CORRECTION');
  });

  it('exclut du dénominateur les entrées sans dose réelle saisie', () => {
    const entries = [
      ...[2, 3, 4, 5].map((d) => meal(at(d, 12), { doseSuggeree: 4, doseReelle: 6 })),
      ...[6, 7, 8, 9].map((d) => meal(at(d, 12), { doseSuggeree: 4, doseReelle: undefined })),
    ];
    expect(find(run(entries), 'PATTERN_OVER_CORRECTION').total).toBe(4);
  });

  it('ne se déclenche pas sous 4 paires de doses ni à exactement 50 %', () => {
    const few = [...fillers(), ...[2, 3, 4].map((d) => meal(at(d, 12), { doseSuggeree: 4, doseReelle: 6 }))];
    expect(codes(run(few))).not.toContain('PATTERN_OVER_CORRECTION');
    const half = [
      ...[2, 3].map((d) => meal(at(d, 12), { doseSuggeree: 4, doseReelle: 6 })),
      ...[4, 5, 6].map((d) => meal(at(d, 12), { doseSuggeree: 4, doseReelle: 4 })),
      meal(at(7, 12), { doseSuggeree: 4, doseReelle: 6 }),
    ];
    expect(codes(run(half))).not.toContain('PATTERN_OVER_CORRECTION');
  });
});

// ─── 5. Créneau problématique ───────────────────────────────────────────────

describe('PATTERN_PROBLEM_SLOT', () => {
  it('signale un créneau de 4 h (≥ 5 lectures) dont le TIR < 50 %', () => {
    const entries = [1, 2, 3, 4, 5].map((d) => reading(at(d, 18), 2.5));
    const p = find(run(entries), 'PATTERN_PROBLEM_SLOT');
    expect(p.severity).toBe('info');
    expect(p.count).toBe(5);
    expect(p.total).toBe(5);
    expect(p.params).toEqual({ slotStart: 16, slotEnd: 20, tir: 0 });
  });

  it('émet un schéma par créneau défaillant', () => {
    const entries = [
      ...[1, 2, 3, 4, 5].map((d) => reading(at(d, 18), 2.5)),
      ...[1, 2, 3, 4, 5].map((d) => reading(at(d, 2), 0.6)),
    ];
    const slots = run(entries).filter((p) => p.code === 'PATTERN_PROBLEM_SLOT');
    expect(slots.map((p) => p.params.slotStart).sort((a, b) => Number(a) - Number(b))).toEqual([0, 16]);
  });

  it('utilise le consensus 0.70–1.80 par défaut et les cibles fournies sinon', () => {
    const entries = [1, 2, 3, 4, 5].map((d) => reading(at(d, 18), 0.85));
    expect(codes(run(entries))).not.toContain('PATTERN_PROBLEM_SLOT');
    const withTargets = run(entries, { targetMin: 1.0, targetMax: 1.8 });
    expect(find(withTargets, 'PATTERN_PROBLEM_SLOT').params.tir).toBe(0);
  });

  it('ne signale ni un créneau bien contrôlé ni un créneau de moins de 5 lectures', () => {
    const good = [1, 2, 3, 4, 5].map((d) => reading(at(d, 18), 1.3));
    expect(codes(run(good))).not.toContain('PATTERN_PROBLEM_SLOT');
    const sparse = [...fillers(), ...[1, 2, 3, 4].map((d) => reading(at(d, 18), 2.5))];
    expect(codes(run(sparse))).not.toContain('PATTERN_PROBLEM_SLOT');
  });
});

// ─── 6. Empilement récurrent ────────────────────────────────────────────────

describe('PATTERN_RECURRING_STACKING', () => {
  it('détecte ≥ 2 corrections à moins de 120 min d’un bolus (données ≤ 7 jours)', () => {
    const entries = [...fillers(), meal(at(3, 12)), correction(at(3, 13)), meal(at(5, 19)), correction(at(5, 20, 30))];
    const p = find(run(entries), 'PATTERN_RECURRING_STACKING');
    expect(p.severity).toBe('warning');
    expect(p.count).toBe(2);
    expect(p.params.threshold).toBe(2);
  });

  it('proportionne le seuil à l’étendue des données (2 par semaine)', () => {
    // Données du 28 sept. au 11 oct. (13 jours → 1.86 semaine) → seuil round(3.7) = 4
    const span = [reading(at(-2, 8), 1.2), reading(at(11, 8), 1.2)];
    const three = [...span, ...[2, 4, 6].flatMap((d) => [meal(at(d, 12)), correction(at(d, 13))])];
    expect(codes(run(three))).not.toContain('PATTERN_RECURRING_STACKING');
    const four = [...three, meal(at(8, 12)), correction(at(8, 13))];
    const p = find(run(four), 'PATTERN_RECURRING_STACKING');
    expect(p.count).toBe(4);
    expect(p.params.threshold).toBe(4);
  });

  it('ignore les corrections espacées de ≥ 2 h et les repas rapprochés sans correction', () => {
    const spaced = [...fillers(), meal(at(3, 12)), correction(at(3, 15)), meal(at(5, 12)), correction(at(5, 14))];
    expect(codes(run(spaced))).not.toContain('PATTERN_RECURRING_STACKING');
    const snacks = [...fillers(), meal(at(3, 12)), meal(at(3, 13), { mealType: 'collation' }), meal(at(5, 12)), meal(at(5, 13), { mealType: 'collation' })];
    expect(codes(run(snacks))).not.toContain('PATTERN_RECURRING_STACKING');
  });
});

// ─── 7. Hypos récurrentes par période ───────────────────────────────────────

describe('PATTERN_RECURRENT_HYPO_SLOT', () => {
  it('détecte ≥ 3 hypos dans la même période de la journée', () => {
    const entries = [...fillers(), reading(at(2, 17), 0.6), reading(at(3, 18), 0.65), reading(at(4, 19), 0.5)];
    const p = find(run(entries), 'PATTERN_RECURRENT_HYPO_SLOT');
    expect(p.severity).toBe('warning');
    expect(p.count).toBe(3);
    expect(p.params).toEqual({ period: 'soir', count: 3 });
  });

  it('compte une entrée une seule fois même avec pré et post en hypo', () => {
    const entries = [...fillers(), meal(at(2, 17), { glycPre: 0.6, glycPost: 0.65 }), meal(at(3, 17), { glycPre: 0.6, glycPost: 0.65 })];
    expect(codes(run(entries))).not.toContain('PATTERN_RECURRENT_HYPO_SLOT');
  });

  it('ne se déclenche pas quand les hypos sont réparties sur plusieurs périodes', () => {
    const entries = [...fillers(), reading(at(2, 8), 0.6), reading(at(3, 13), 0.6), reading(at(4, 19), 0.6)];
    expect(codes(run(entries))).not.toContain('PATTERN_RECURRENT_HYPO_SLOT');
  });
});

// ─── 8. Glycémie à jeun élevée ──────────────────────────────────────────────

describe('PATTERN_HIGH_FASTING', () => {
  it('détecte ≥ 60 % de petits-déjeuners avec pré > 1.50 (n ≥ 5)', () => {
    const entries = [1.7, 1.9, 1.6, 1.2, 1.3].map((pre, i) => meal(at(i + 1, 7, 30), { mealType: 'petit-déjeuner', glycPre: pre }));
    const p = find(run(entries), 'PATTERN_HIGH_FASTING');
    expect(p.severity).toBe('info');
    expect(p.count).toBe(3);
    expect(p.total).toBe(5);
    expect(p.params).toEqual({ pct: 60 });
  });

  it('reconnaît le premier repas du jour entre 05h et 10h comme petit-déjeuner, sans libellé', () => {
    const entries = [1, 2, 3, 4, 5].map((d) => meal(at(d, 8), { mealType: 'repas', glycPre: 1.7 }));
    expect(find(run(entries), 'PATTERN_HIGH_FASTING').params.pct).toBe(100);
  });

  it('accepte le libellé sans accent et le mealSlot', () => {
    const entries = [
      ...[1, 2, 3].map((d) => meal(at(d, 12), { mealType: 'petit-dejeuner', glycPre: 1.7 })),
      ...[4, 5].map((d) => meal(at(d, 12), { mealType: 'brunch', mealSlot: 'petit-dejeuner', glycPre: 1.7 })),
    ];
    expect(codes(run(entries))).toContain('PATTERN_HIGH_FASTING');
  });

  it('ne se déclenche pas sous 60 % ou avec moins de 5 petits-déjeuners', () => {
    const low = [1.7, 1.9, 1.2, 1.2, 1.3].map((pre, i) => meal(at(i + 1, 7, 30), { mealType: 'petit-déjeuner', glycPre: pre }));
    expect(codes(run(low))).not.toContain('PATTERN_HIGH_FASTING');
    const few = [...fillers(), ...[1, 2, 3, 4].map((d) => meal(at(d, 7, 30), { mealType: 'petit-déjeuner', glycPre: 1.9 }))];
    expect(codes(run(few))).not.toContain('PATTERN_HIGH_FASTING');
  });
});

// ─── 9. Post-repas élevée ───────────────────────────────────────────────────

describe('PATTERN_HIGH_POSTMEAL', () => {
  it('détecte ≥ 60 % de post > 2.00 pour un type de repas (≥ 3 post)', () => {
    const entries = [...fillers().slice(0, 2), ...[2.3, 2.2, 1.4].map((post, i) => meal(at(i + 2, 13), { mealType: 'Déjeuner', glycPost: post }))];
    const p = find(run(entries), 'PATTERN_HIGH_POSTMEAL');
    expect(p.severity).toBe('info');
    expect(p.count).toBe(2);
    expect(p.total).toBe(3);
    expect(p.params).toEqual({ mealType: 'dejeuner', pct: 67 });
  });

  it('groupe par mealSlot en priorité et émet un schéma par type de repas', () => {
    const entries = [
      ...[2, 3, 4].map((d) => meal(at(d, 13), { mealType: 'déjeuner', glycPost: 2.4 })),
      ...[2, 3, 4].map((d) => meal(at(d, 20), { mealType: 'souper', mealSlot: 'diner', glycPost: 2.4 })),
    ];
    const types = run(entries)
      .filter((p) => p.code === 'PATTERN_HIGH_POSTMEAL')
      .map((p) => p.params.mealType)
      .sort();
    expect(types).toEqual(['dejeuner', 'diner']);
  });

  it('ignore les post des entrées non-repas et les types avec moins de 3 post', () => {
    const entries = [...fillers(), ...[2, 3, 4].map((d) => entry(at(d, 13), { mealType: 'mesure', glycPre: 1.2, glycPost: 2.5 }))];
    expect(codes(run(entries))).not.toContain('PATTERN_HIGH_POSTMEAL');
    const few = [...fillers(), ...[2, 3].map((d) => meal(at(d, 13), { glycPost: 2.5 }))];
    expect(codes(run(few))).not.toContain('PATTERN_HIGH_POSTMEAL');
  });
});

// ─── 10. Sous-dosage ────────────────────────────────────────────────────────

describe('PATTERN_UNDERDOSING', () => {
  it('détecte ≥ 3 doses réelles < suggérée × 0.80 parmi ≥ 5 paires', () => {
    const entries = [
      ...[1, 2, 3].map((d) => meal(at(d, 12), { doseSuggeree: 6, doseReelle: 4 })),
      ...[4, 5].map((d) => meal(at(d, 12), { doseSuggeree: 6, doseReelle: 6 })),
    ];
    const p = find(run(entries), 'PATTERN_UNDERDOSING');
    expect(p.severity).toBe('info');
    expect(p.count).toBe(3);
    expect(p.total).toBe(5);
    expect(p.params).toEqual({ count: 3, total: 5 });
  });

  it('ne se déclenche pas avec 2 sous-dosages ou moins de 5 paires', () => {
    const two = [
      ...[1, 2].map((d) => meal(at(d, 12), { doseSuggeree: 6, doseReelle: 4 })),
      ...[3, 4, 5].map((d) => meal(at(d, 12), { doseSuggeree: 6, doseReelle: 6 })),
    ];
    expect(codes(run(two))).not.toContain('PATTERN_UNDERDOSING');
    const few = [...fillers(), ...[1, 2, 3, 4].map((d) => meal(at(d, 12), { doseSuggeree: 6, doseReelle: 4 }))];
    expect(codes(run(few))).not.toContain('PATTERN_UNDERDOSING');
  });
});

// ─── Tri et combinaison ─────────────────────────────────────────────────────

describe('detectPatterns — tri et combinaison', () => {
  it('renvoie les avertissements avant les informations', () => {
    const entries = [
      // sous-dosage (info) déclaré en premier dans le journal
      ...[1, 2, 3].map((d) => meal(at(d, 12), { doseSuggeree: 6, doseReelle: 4 })),
      ...[4, 5].map((d) => meal(at(d, 12), { doseSuggeree: 6, doseReelle: 6 })),
      // hypos matinales (warning)
      reading(at(2, 7), 0.6),
      reading(at(4, 7), 0.6),
    ];
    const result = run(entries);
    expect(codes(result)).toEqual(['PATTERN_MORNING_HYPO', 'PATTERN_UNDERDOSING']);
    const severities = result.map((p) => p.severity);
    expect(severities).toEqual([...severities].sort((a, b) => (a === b ? 0 : a === 'warning' ? -1 : 1)));
  });

  it('détecte plusieurs schémas sur un même journal', () => {
    const entries = [1, 2, 3, 4, 5].map((d) =>
      meal(at(d, 7, 30), { mealType: 'petit-déjeuner', glycPre: 0.55, doseSuggeree: 3, doseReelle: 5 }),
    );
    const found = codes(run(entries));
    expect(found).toContain('PATTERN_MORNING_HYPO');
    expect(found).toContain('PATTERN_OVER_CORRECTION');
    expect(found).toContain('PATTERN_RECURRENT_HYPO_SLOT');
  });

  it('ne renvoie jamais de texte : uniquement des codes et des paramètres scalaires', () => {
    const entries = [1, 2, 3, 4, 5].map((d) => meal(at(d, 7, 30), { mealType: 'petit-déjeuner', glycPre: 0.55 }));
    for (const p of run(entries)) {
      expect(p.code.startsWith('PATTERN_')).toBe(true);
      for (const v of Object.values(p.params)) expect(['string', 'number']).toContain(typeof v);
    }
  });
});
