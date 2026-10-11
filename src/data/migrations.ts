/**
 * Migrations de données idempotentes : v4 → v5 (renommage des champs) → v7 (normalisation).
 */
import type { JournalEntry } from '../domain/types';
import { toNumber } from '../domain/units';
import { timeKey } from '../domain/time';
import { newId } from '../domain/ids';
import { SCHEMA_VERSION } from './schema';

export function needsMigration(appVersion: string | null | undefined): boolean {
  if (!appVersion) return true;
  const major = parseInt(appVersion.split('.')[0] ?? '0', 10);
  return major < 7;
}

const V4_TO_V5: Array<[keyof JournalEntry, keyof JournalEntry]> = [
  ['preMealGlycemia', 'glycPre'],
  ['postMealGlycemia', 'glycPost'],
  ['totalCarbs', 'totalGlucides'],
  ['foods', 'aliments'],
  ['doseCalculated', 'doseSuggeree'],
  ['doseInjected', 'doseReelle'],
];

const NUMERIC_FIELDS: Array<keyof JournalEntry> = [
  'glycPre', 'glycPost', 'totalGlucides', 'totalLipides', 'doseSuggeree', 'doseReelle', 'doseActual',
  'iobAuMoment', 'splitImmediate', 'splitDelayed', 'splitDelayMinutes', 'velocity',
];

/** Migre une entrée vers le schéma courant (idempotent, ne mute pas l'entrée source). */
export function migrateEntry(entry: JournalEntry | null | undefined): JournalEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const out: Record<string, unknown> = { ...entry };

  for (const [oldKey, newKey] of V4_TO_V5) {
    if (oldKey in out && !(newKey in out)) out[newKey] = out[oldKey];
  }

  // Identifiant chaîne et date valide
  out.id = out.id == null || out.id === '' ? newId('mig_') : String(out.id);
  const d = new Date(String(out.date ?? ''));
  if (Number.isNaN(d.getTime())) {
    const fromId = typeof entry.id === 'number' ? new Date(entry.id) : null;
    out.date = fromId && !Number.isNaN(fromId.getTime()) ? fromId.toISOString() : new Date(0).toISOString();
  }

  for (const f of NUMERIC_FIELDS) {
    if (f in out && out[f] !== null && out[f] !== undefined) {
      const n = toNumber(out[f]);
      out[f] = n;
    }
  }
  if (out.doseActual == null && out.doseReelle != null) out.doseActual = out.doseReelle;
  if (out.doseReelle == null && out.doseActual != null) out.doseReelle = out.doseActual;

  if (!out.heure) out.heure = timeKey(String(out.date));
  if (!('tendance' in out)) out.tendance = null;
  if (!('iobAuMoment' in out)) out.iobAuMoment = null;
  if (!('niveauGras' in out)) out.niveauGras = 'aucun';
  if (!('bolusType' in out)) out.bolusType = 'unique';
  if (!('activitePhysique' in out)) out.activitePhysique = 'aucune';
  if (!('alertes' in out) || !Array.isArray(out.alertes)) out.alertes = [];
  if (!('notes' in out) || out.notes == null) out.notes = '';
  if (!out.source) out.source = 'manual';
  if (!out.mealType) {
    const carbs = toNumber(out.totalGlucides) ?? 0;
    const dose = toNumber(out.doseActual) ?? 0;
    out.mealType = carbs > 0 ? 'repas' : dose > 0 ? 'injection' : 'mesure';
  }
  out.schemaVersion = SCHEMA_VERSION;
  return out as unknown as JournalEntry;
}

export function migrateAllEntries(entries: unknown): JournalEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((e) => migrateEntry(e as JournalEntry)).filter((e): e is JournalEntry => e != null);
}
