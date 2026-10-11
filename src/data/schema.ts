/**
 * Schémas de données (zod) : journal, réglages, sauvegarde.
 * Les entrées sont normalisées (nombres, identifiants chaîne) à la lecture.
 */
import { z } from 'zod';
import type { JournalEntry } from '../domain/types';
import { toNumber } from '../domain/units';

export const SCHEMA_VERSION = 7;

const optionalNumber = z.preprocess((v) => (v === '' || v === undefined ? null : v), z.union([z.number(), z.string(), z.null()]))
  .transform((v) => (v == null ? null : toNumber(v)));

const idSchema = z.union([z.string(), z.number()]).transform((v) => String(v));

const validDate = z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), { message: 'INVALID_DATE' });

export const JournalEntrySchema = z
  .object({
    id: idSchema,
    date: validDate,
    heure: z.string().nullish(),
    mealType: z.string().nullish(),
    mealSlot: z.string().nullish(),
    injectionType: z.string().nullish(),
    source: z.enum(['manual', 'cgm', 'import']).nullish(),
    glycPre: optionalNumber.nullish(),
    glycPost: optionalNumber.nullish(),
    glycPostAt: z.string().nullish(),
    tendance: z.string().nullish(),
    velocity: optionalNumber.nullish(),
    totalGlucides: optionalNumber.nullish(),
    totalLipides: optionalNumber.nullish(),
    niveauGras: z.string().nullish(),
    aliments: z.union([z.array(z.any()), z.string(), z.null()]).nullish(),
    iobAuMoment: optionalNumber.nullish(),
    doseSuggeree: optionalNumber.nullish(),
    doseReelle: optionalNumber.nullish(),
    doseActual: optionalNumber.nullish(),
    bolusType: z.string().nullish(),
    splitImmediate: optionalNumber.nullish(),
    splitDelayed: optionalNumber.nullish(),
    splitDelayMinutes: optionalNumber.nullish(),
    splitPhases: z.array(z.any()).nullish(),
    splitDone2: z.boolean().nullish(),
    activitePhysique: z.string().nullish(),
    alertes: z.array(z.any()).nullish(),
    notes: z.string().nullish(),
    photoThumbnail: z.string().nullish(),
    hypoRiskScore: optionalNumber.nullish(),
    nightMode: z.boolean().nullish(),
    fasting: z.boolean().nullish(),
    illness: z.boolean().nullish(),
    insulinProfileId: z.string().nullish(),
    hypoTreatment: z.any().nullish(),
    schemaVersion: z.number().nullish(),
    // v4
    preMealGlycemia: optionalNumber.nullish(),
    postMealGlycemia: optionalNumber.nullish(),
    totalCarbs: optionalNumber.nullish(),
    doseCalculated: optionalNumber.nullish(),
    doseInjected: optionalNumber.nullish(),
    doseSuggested: optionalNumber.nullish(),
  })
  .passthrough();

export type ParsedJournalEntry = z.infer<typeof JournalEntrySchema>;

export function parseJournalEntry(raw: unknown): JournalEntry | null {
  const r = JournalEntrySchema.safeParse(raw);
  return r.success ? (r.data as unknown as JournalEntry) : null;
}

/** Valide un tableau : renvoie les entrées valides et le nombre rejetées. */
export function parseJournal(raw: unknown): { entries: JournalEntry[]; rejected: number } {
  if (!Array.isArray(raw)) return { entries: [], rejected: 0 };
  const entries: JournalEntry[] = [];
  let rejected = 0;
  for (const item of raw) {
    const e = parseJournalEntry(item);
    if (e) entries.push(e);
    else rejected += 1;
  }
  return { entries, rejected };
}

// ─── Réglages ────────────────────────────────────────────────────────────────

export const SettingsSchema = z.object({
  onboarded: z.boolean().default(false),
  patientName: z.string().default(''),
  age: z.union([z.number(), z.string()]).default(''),
  sex: z.enum(['M', 'F']).default('M'),
  height: z.union([z.number(), z.string()]).default(''),
  weight: z.union([z.number(), z.string()]).default(''),
  ratio: z.number().min(1).max(50).default(15),
  isf: z.number().min(5).max(200).default(60),
  targetGMin: z.number().min(0.5).max(2.5).default(1.0),
  targetGMax: z.number().min(0.5).max(2.5).default(1.2),
  insulinBasal: z.string().default('Tresiba'),
  insulinRapid: z.string().default('NovoRapid'),
  insulinProfileId: z.string().nullable().default(null),
  basalDose: z.number().min(0).max(200).default(12),
  basalReminderTime: z.string().nullable().default(null),
  postKeto: z.boolean().default(false),
  slowDigestion: z.boolean().default(false),
  dia: z.number().min(2).max(8).default(4.5),
  maxDoseU: z.number().min(0).max(100).nullable().default(null),
  nightModeEnabled: z.boolean().default(true),
  nightStart: z.number().min(0).max(23).default(21),
  nightEnd: z.number().min(0).max(23).default(6),
  nightCorrectionMin: z.number().min(1.2).max(2.5).default(1.8),
  fastingEnabled: z.boolean().default(false),
  fastingSuhoorReductionPct: z.number().min(0).max(60).default(25),
  fastingBasalReductionPct: z.number().min(0).max(50).default(20),
  notifEnabled: z.boolean().default(false),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  locale: z.enum(['fr', 'ar']).default('fr'),
  timeProfiles: z.array(z.any()).default([]),
  customFoods: z.array(z.any()).default([]),
  groqApiKey: z.string().default(''),
  glycemia: z.union([z.number(), z.string()]).default(''),
});

export type Settings = z.infer<typeof SettingsSchema>;
export const SETTINGS_DEFAULTS: Settings = SettingsSchema.parse({});
export const SETTINGS_KEYS = Object.keys(SETTINGS_DEFAULTS) as Array<keyof Settings>;

/** Clés localStorage historiques (préfixe insulincalc_v4_) → clé réglage. */
export const LEGACY_SETTINGS_KEY_MAP: Record<string, keyof Settings> = {
  custom_foods: 'customFoods',
};

// ─── Sauvegarde ──────────────────────────────────────────────────────────────

export const BackupSchema = z.object({
  app: z.string().optional(),
  version: z.string(),
  schemaVersion: z.number().optional(),
  exportDate: z.string(),
  profile: z.record(z.string(), z.unknown()).default({}),
  journal: z.array(z.unknown()).default([]),
  reminders: z.array(z.unknown()).optional(),
});

export type Backup = z.infer<typeof BackupSchema>;

export function parseBackup(raw: unknown): { ok: true; backup: Backup } | { ok: false; error: string } {
  const r = BackupSchema.safeParse(raw);
  if (!r.success) return { ok: false, error: 'BACKUP_INVALID_FORMAT' };
  return { ok: true, backup: r.data };
}
