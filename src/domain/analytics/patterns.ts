/**
 * Détection de schémas glycémiques et posologiques récurrents (fenêtre glissante).
 *
 * Portage typé de l'ancien `patternDetector.js` (aube, hypos matinales, rebond de Somogyi,
 * sur-correction, créneau problématique, empilement) et des 4 schémas de `detectPatterns`
 * (hypos récurrentes par période, à jeun élevée, post-repas élevée, sous-dosage).
 *
 * Conventions :
 * - glycémies en g/L : hypo < 0.70, rebond / post-repas élevé > 2.00, à jeun élevé > 1.50 ;
 * - heure LOCALE via time.ts (jamais toISOString pour les clés de journée) ;
 * - le module ne renvoie que des CODES + paramètres : l'UI se charge des libellés ;
 * - les entrées peuvent porter des champs v4 → toujours passer par les accesseurs de journal.ts ;
 * - le journal n'est pas supposé trié : la fenêtre est triée ici par date croissante.
 */
import type { GlucoseReading, JournalEntry } from '../types';
import type { DayPeriod } from '../time';
import { addDays, hourOf, localDateKey, minutesBetween, periodOfDay } from '../time';
import {
  entryDate,
  entryKind,
  getActualDose,
  getGlucosePost,
  getGlucosePre,
  getSuggestedDose,
  isBolusInjection,
  readingsFromJournal,
} from '../journal';
import { roundTo, toNumber } from '../units';
import { CONSENSUS } from './metrics';

export type PatternCode =
  | 'PATTERN_DAWN'
  | 'PATTERN_MORNING_HYPO'
  | 'PATTERN_SOMOGYI'
  | 'PATTERN_OVER_CORRECTION'
  | 'PATTERN_PROBLEM_SLOT'
  | 'PATTERN_RECURRING_STACKING'
  | 'PATTERN_RECURRENT_HYPO_SLOT'
  | 'PATTERN_HIGH_FASTING'
  | 'PATTERN_HIGH_POSTMEAL'
  | 'PATTERN_UNDERDOSING';

export type PatternSeverity = 'warning' | 'info';

export interface DetectedPattern {
  code: PatternCode;
  severity: PatternSeverity;
  /** Nombre d'occurrences (jours, lectures ou entrées selon le schéma ; précisé dans `params`). */
  count: number;
  /** Dénominateur lorsque le schéma repose sur un pourcentage. */
  total?: number;
  /** Paramètres destinés à l'interpolation des libellés par l'UI. */
  params: Record<string, string | number>;
  /** Largeur de la fenêtre analysée, en jours. */
  windowDays: number;
}

export interface PatternOptions {
  now?: Date;
  /** Fenêtre glissante en jours (défaut 14). */
  days?: number;
  /** Bornes cibles personnelles ; si absentes, le TIR par créneau utilise le consensus 0.70–1.80. */
  targetMin?: number;
  targetMax?: number;
}

export const DEFAULT_WINDOW_DAYS = 14;

/** Seuils cliniques du module (repris de l'implémentation historique lorsqu'ils existaient). */
export const PATTERN_THRESHOLDS = {
  /** Moins de 5 entrées dans la fenêtre → aucune analyse. */
  minEntries: 5,
  hypo: 0.70,
  rebound: 2.00,
  dawnDelta: 0.30,
  dawnMinDays: 3,
  morningHypoMinDays: 2,
  somogyiMaxMinutes: 240,
  overCorrectionFactor: 1.20,
  overCorrectionMinN: 4,
  overCorrectionMinPct: 50,
  slotHours: 4,
  slotMinReadings: 5,
  slotTirMinPct: 50,
  stackingMaxMinutes: 120,
  stackingPerWeek: 2,
  hypoSlotMinCount: 3,
  fastingHigh: 1.50,
  fastingMinN: 5,
  fastingMinPct: 60,
  postMealHigh: 2.00,
  postMealMinN: 3,
  postMealMinPct: 60,
  underdosingFactor: 0.80,
  underdosingMinN: 5,
  underdosingMinCount: 3,
} as const;

const DAY_MS = 86_400_000;
const PERIODS: readonly DayPeriod[] = ['matin', 'midi', 'soir', 'nuit'];
const SEVERITY_RANK: Record<PatternSeverity, number> = { warning: 0, info: 1 };

interface Ctx {
  /** Entrées de la fenêtre, triées par date croissante. */
  entries: JournalEntry[];
  /** Lectures glycémiques (pré, post, ponctuelles, CGM) de la fenêtre, triées. */
  readings: GlucoseReading[];
  windowDays: number;
  rangeMin: number;
  rangeMax: number;
}

// ─── Sélection de la fenêtre ────────────────────────────────────────────────

/**
 * Entrées datées comprises dans les `days` derniers jours (jusqu'à `now` + 1 min),
 * triées par date croissante. Les entrées sans date ou à date invalide sont ignorées.
 */
export function selectWindowEntries(entries: JournalEntry[], now: Date, days: number): JournalEntry[] {
  const cutoff = now.getTime() - days * DAY_MS;
  const horizon = now.getTime() + 60_000;
  return entries
    .map((e) => ({ e, t: e.date ? entryDate(e).getTime() : Number.NaN }))
    .filter(({ t }) => !Number.isNaN(t) && t >= cutoff && t <= horizon)
    .sort((a, b) => a.t - b.t)
    .map(({ e }) => e);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Dose réellement saisie (> 0), sans le repli sur la dose suggérée de `getActualDose`. */
function hasExplicitActualDose(e: JournalEntry): boolean {
  return (toNumber(e.doseActual ?? e.doseReelle ?? e.doseInjected) ?? 0) > 0;
}

/** 'Petit-Déjeuner' → 'petit-dejeuner' : clé stable, sans accents, pour grouper les repas. */
function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function mealKey(e: JournalEntry): string | null {
  if (e.mealSlot) return e.mealSlot;
  const key = e.mealType ? normalizeLabel(e.mealType) : '';
  return key || null;
}

const isBreakfastLabel = (e: JournalEntry): boolean => mealKey(e) === 'petit-dejeuner';

const inHours = (d: Date, from: number, to: number): boolean => {
  const h = hourOf(d);
  return h >= from && h < to;
};

const pct = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Étendue réelle des données (jours), au minimum 1. */
function dataSpanDays(entries: JournalEntry[]): number {
  const first = entries[0];
  const last = entries[entries.length - 1];
  if (!first || !last) return 1;
  return Math.max(1, (entryDate(last).getTime() - entryDate(first).getTime()) / DAY_MS);
}

/** Entrées disposant d'une dose suggérée ET d'une dose réellement saisie (> 0). */
function dosePairs(entries: JournalEntry[]): Array<{ suggested: number; actual: number }> {
  return entries
    .filter((e) => getSuggestedDose(e) > 0 && hasExplicitActualDose(e))
    .map((e) => ({ suggested: getSuggestedDose(e), actual: getActualDose(e) }));
}

function pattern(
  ctx: Ctx,
  code: PatternCode,
  severity: PatternSeverity,
  count: number,
  params: Record<string, string | number>,
  total?: number,
): DetectedPattern {
  return { code, severity, count, ...(total != null ? { total } : {}), params, windowDays: ctx.windowDays };
}

function readingsByDay(readings: GlucoseReading[]): Map<string, GlucoseReading[]> {
  const byDay = new Map<string, GlucoseReading[]>();
  for (const r of readings) {
    const key = localDateKey(r.at);
    const list = byDay.get(key);
    if (list) list.push(r);
    else byDay.set(key, [r]);
  }
  return byDay;
}

// ─── 1. Phénomène de l'aube ─────────────────────────────────────────────────
// Première lecture du matin (05h–10h) > dernière lecture de la veille au soir
// (20h–02h) + 0.30 g/L, sur ≥ 3 jours de la fenêtre.
function detectDawn(ctx: Ctx): DetectedPattern[] {
  const byDay = readingsByDay(ctx.readings);
  let count = 0;
  for (const [day, list] of byDay) {
    const morning = list.find((r) => inHours(r.at, 5, 10));
    if (!morning) continue;
    const previousEvening = [
      ...(byDay.get(addDays(day, -1)) ?? []).filter((r) => hourOf(r.at) >= 20),
      ...list.filter((r) => hourOf(r.at) < 2),
    ];
    const evening = previousEvening.at(-1);
    if (!evening) continue;
    if (morning.value > evening.value + PATTERN_THRESHOLDS.dawnDelta) count += 1;
  }
  if (count < PATTERN_THRESHOLDS.dawnMinDays) return [];
  return [pattern(ctx, 'PATTERN_DAWN', 'warning', count, { days: count })];
}

// ─── 2. Hypos matinales récurrentes ─────────────────────────────────────────
// Lecture < 0.70 entre 04h et 10h sur ≥ 2 jours distincts.
function detectMorningHypo(ctx: Ctx): DetectedPattern[] {
  const days = new Set<string>();
  let readings = 0;
  for (const r of ctx.readings) {
    if (r.value < PATTERN_THRESHOLDS.hypo && inHours(r.at, 4, 10)) {
      days.add(localDateKey(r.at));
      readings += 1;
    }
  }
  if (days.size < PATTERN_THRESHOLDS.morningHypoMinDays) return [];
  return [pattern(ctx, 'PATTERN_MORNING_HYPO', 'warning', days.size, { days: days.size, readings })];
}

// ─── 3. Rebond post-hypoglycémie (Somogyi) ──────────────────────────────────
// Lecture < 0.70 suivie, dans les 4 h, d'une lecture > 2.00. Un même rebond n'est
// compté qu'une fois même si plusieurs lectures basses le précèdent.
function detectSomogyi(ctx: Ctx): DetectedPattern[] {
  const readings = ctx.readings;
  let count = 0;
  let i = 0;
  while (i < readings.length) {
    const low = readings[i];
    if (!low || low.value >= PATTERN_THRESHOLDS.hypo) {
      i += 1;
      continue;
    }
    let reboundIndex = -1;
    for (let j = i + 1; j < readings.length; j += 1) {
      const next = readings[j];
      if (!next) break;
      if (minutesBetween(low.at, next.at) > PATTERN_THRESHOLDS.somogyiMaxMinutes) break;
      if (next.value > PATTERN_THRESHOLDS.rebound) {
        reboundIndex = j;
        break;
      }
    }
    if (reboundIndex >= 0) {
      count += 1;
      i = reboundIndex + 1;
    } else {
      i += 1;
    }
  }
  if (count < 1) return [];
  return [pattern(ctx, 'PATTERN_SOMOGYI', 'info', count, { count })];
}

// ─── 4. Sur-correction systématique ─────────────────────────────────────────
// Dose réelle > dose suggérée × 1.20 dans plus de 50 % des entrées à deux doses (n ≥ 4).
function detectOverCorrection(ctx: Ctx): DetectedPattern[] {
  const pairs = dosePairs(ctx.entries);
  if (pairs.length < PATTERN_THRESHOLDS.overCorrectionMinN) return [];
  const over = pairs.filter((p) => p.actual > p.suggested * PATTERN_THRESHOLDS.overCorrectionFactor).length;
  const share = (over / pairs.length) * 100;
  if (share <= PATTERN_THRESHOLDS.overCorrectionMinPct) return [];
  return [pattern(ctx, 'PATTERN_OVER_CORRECTION', 'warning', over, { pct: Math.round(share) }, pairs.length)];
}

// ─── 5. Créneau horaire problématique ───────────────────────────────────────
// Par tranche de 4 h ayant ≥ 5 lectures : TIR < 50 % (bornes cibles ou consensus).
function detectProblemSlots(ctx: Ctx): DetectedPattern[] {
  const slotCount = 24 / PATTERN_THRESHOLDS.slotHours;
  const slots = Array.from({ length: slotCount }, () => ({ total: 0, inRange: 0 }));
  for (const r of ctx.readings) {
    const slot = slots[Math.floor(hourOf(r.at) / PATTERN_THRESHOLDS.slotHours)];
    if (!slot) continue;
    slot.total += 1;
    if (r.value >= ctx.rangeMin && r.value <= ctx.rangeMax) slot.inRange += 1;
  }
  const out: DetectedPattern[] = [];
  slots.forEach((slot, idx) => {
    if (slot.total < PATTERN_THRESHOLDS.slotMinReadings) return;
    const tir = (slot.inRange / slot.total) * 100;
    if (tir >= PATTERN_THRESHOLDS.slotTirMinPct) return;
    const slotStart = idx * PATTERN_THRESHOLDS.slotHours;
    out.push(
      pattern(
        ctx,
        'PATTERN_PROBLEM_SLOT',
        'info',
        slot.total - slot.inRange,
        { slotStart, slotEnd: slotStart + PATTERN_THRESHOLDS.slotHours, tir: Math.round(tir) },
        slot.total,
      ),
    );
  });
  return out;
}

// ─── 6. Empilement récurrent ────────────────────────────────────────────────
// Deux bolus à moins de 120 min dont le second comporte une correction, ≥ 2 fois par
// semaine (seuil proportionnel à l'étendue réelle des données, minimum 2).
function detectRecurringStacking(ctx: Ctx): DetectedPattern[] {
  const boluses = ctx.entries.filter(isBolusInjection);
  let count = 0;
  for (let i = 1; i < boluses.length; i += 1) {
    const prev = boluses[i - 1];
    const cur = boluses[i];
    if (!prev || !cur) continue;
    const gap = minutesBetween(entryDate(prev), entryDate(cur));
    if (gap <= 0 || gap >= PATTERN_THRESHOLDS.stackingMaxMinutes) continue;
    const hasCorrection = cur.injectionType === 'correction' || entryKind(cur) === 'injection';
    if (hasCorrection) count += 1;
  }
  const spanDays = dataSpanDays(ctx.entries);
  const weeks = Math.max(1, spanDays / 7);
  const threshold = Math.max(2, Math.round(PATTERN_THRESHOLDS.stackingPerWeek * weeks));
  if (count < threshold) return [];
  return [
    pattern(ctx, 'PATTERN_RECURRING_STACKING', 'warning', count, {
      count,
      threshold,
      spanDays: roundTo(spanDays, 1),
    }),
  ];
}

// ─── 7. Hypos récurrentes sur une même période ──────────────────────────────
// ≥ 3 entrées avec une lecture < 0.70 dans la même période (matin / midi / soir / nuit).
function detectRecurrentHypoSlot(ctx: Ctx): DetectedPattern[] {
  const byPeriod = new Map<DayPeriod, Set<string | number>>();
  for (const r of ctx.readings) {
    if (r.value >= PATTERN_THRESHOLDS.hypo) continue;
    const period = periodOfDay(hourOf(r.at));
    const ids = byPeriod.get(period) ?? new Set<string | number>();
    ids.add(r.entryId);
    byPeriod.set(period, ids);
  }
  const out: DetectedPattern[] = [];
  for (const period of PERIODS) {
    const count = byPeriod.get(period)?.size ?? 0;
    if (count < PATTERN_THRESHOLDS.hypoSlotMinCount) continue;
    out.push(pattern(ctx, 'PATTERN_RECURRENT_HYPO_SLOT', 'warning', count, { period, count }));
  }
  return out;
}

// ─── 8. Glycémie à jeun élevée ──────────────────────────────────────────────
// ≥ 5 entrées « petit-déjeuner » (libellé, ou premier repas du jour entre 05h et 10h)
// dont ≥ 60 % ont une glycémie pré > 1.50.
function detectHighFasting(ctx: Ctx): DetectedPattern[] {
  const firstMealByDay = new Map<string, JournalEntry>();
  for (const e of ctx.entries) {
    if (entryKind(e) !== 'meal') continue;
    const key = localDateKey(entryDate(e));
    if (!firstMealByDay.has(key)) firstMealByDay.set(key, e);
  }
  const breakfasts = new Set<JournalEntry>();
  for (const e of ctx.entries) {
    if (getGlucosePre(e) != null && isBreakfastLabel(e)) breakfasts.add(e);
  }
  for (const e of firstMealByDay.values()) {
    if (getGlucosePre(e) != null && inHours(entryDate(e), 5, 10)) breakfasts.add(e);
  }
  const total = breakfasts.size;
  if (total < PATTERN_THRESHOLDS.fastingMinN) return [];
  let high = 0;
  for (const e of breakfasts) {
    if ((getGlucosePre(e) ?? 0) > PATTERN_THRESHOLDS.fastingHigh) high += 1;
  }
  const share = pct(high, total);
  if (share < PATTERN_THRESHOLDS.fastingMinPct) return [];
  return [pattern(ctx, 'PATTERN_HIGH_FASTING', 'info', high, { pct: share }, total)];
}

// ─── 9. Post-repas élevée par type de repas ─────────────────────────────────
// Par type de repas ayant ≥ 3 lectures post : ≥ 60 % des post > 2.00.
function detectHighPostMeal(ctx: Ctx): DetectedPattern[] {
  const groups = new Map<string, { n: number; high: number }>();
  for (const e of ctx.entries) {
    if (entryKind(e) !== 'meal') continue;
    const post = getGlucosePost(e);
    if (post == null) continue;
    const key = mealKey(e);
    if (!key) continue;
    const g = groups.get(key) ?? { n: 0, high: 0 };
    g.n += 1;
    if (post > PATTERN_THRESHOLDS.postMealHigh) g.high += 1;
    groups.set(key, g);
  }
  const out: DetectedPattern[] = [];
  for (const [mealType, g] of groups) {
    if (g.n < PATTERN_THRESHOLDS.postMealMinN) continue;
    const share = pct(g.high, g.n);
    if (share < PATTERN_THRESHOLDS.postMealMinPct) continue;
    out.push(pattern(ctx, 'PATTERN_HIGH_POSTMEAL', 'info', g.high, { mealType, pct: share }, g.n));
  }
  return out;
}

// ─── 10. Sous-dosage ────────────────────────────────────────────────────────
// ≥ 5 entrées à deux doses dont ≥ 3 avec dose réelle < dose suggérée × 0.80.
function detectUnderdosing(ctx: Ctx): DetectedPattern[] {
  const pairs = dosePairs(ctx.entries);
  if (pairs.length < PATTERN_THRESHOLDS.underdosingMinN) return [];
  const under = pairs.filter((p) => p.actual < p.suggested * PATTERN_THRESHOLDS.underdosingFactor).length;
  if (under < PATTERN_THRESHOLDS.underdosingMinCount) return [];
  return [pattern(ctx, 'PATTERN_UNDERDOSING', 'info', under, { count: under, total: pairs.length }, pairs.length)];
}

// ─── Point d'entrée ─────────────────────────────────────────────────────────

/**
 * Détecte les schémas récurrents du journal sur la fenêtre glissante.
 * Renvoie les avertissements d'abord, puis les informations ; `[]` si moins de 5 entrées.
 */
export function detectPatterns(entries: JournalEntry[], opts: PatternOptions = {}): DetectedPattern[] {
  const now = opts.now ?? new Date();
  const windowDays = opts.days ?? DEFAULT_WINDOW_DAYS;
  const sorted = selectWindowEntries(entries ?? [], now, windowDays);
  if (sorted.length < PATTERN_THRESHOLDS.minEntries) return [];

  const ctx: Ctx = {
    entries: sorted,
    readings: readingsFromJournal(sorted, { now }),
    windowDays,
    rangeMin: opts.targetMin ?? CONSENSUS.tirMin,
    rangeMax: opts.targetMax ?? CONSENSUS.tirMax,
  };

  const found: DetectedPattern[] = [
    ...detectDawn(ctx),
    ...detectMorningHypo(ctx),
    ...detectSomogyi(ctx),
    ...detectOverCorrection(ctx),
    ...detectProblemSlots(ctx),
    ...detectRecurringStacking(ctx),
    ...detectRecurrentHypoSlot(ctx),
    ...detectHighFasting(ctx),
    ...detectHighPostMeal(ctx),
    ...detectUnderdosing(ctx),
  ];
  // Tri stable : avertissements d'abord, ordre de détection conservé ensuite.
  return found.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
