/**
 * Import des exports CSV de capteurs de glucose en continu (CGM).
 *
 * Formats reconnus :
 *  - LibreView (FreeStyle Libre) : 1 à 2 lignes de préambule, puis un en-tête
 *    « Device, Serial Number, Device Timestamp, Record Type, Historic Glucose mg/dL, Scan Glucose mg/dL, … ».
 *    Record Type 0 = historique (toutes les 15 min), 1 = scan, 6 = bandelette (manuel).
 *    Les autres types (insuline, repas, notes) sont ignorés sans être comptés.
 *  - Dexcom Clarity : en-tête « Index, Timestamp (YYYY-MM-DDThh:mm:ss), Event Type, …, Glucose Value (mg/dL) ».
 *    Seules les lignes EGV (capteur → 'cgm') et Calibration (bandelette → 'manual') sont retenues ;
 *    « Low » / « High » sont bornés à 39 mg/dL (0,39 g/L) et 401 mg/dL (4,01 g/L), hors plage d'affichage
 *    du capteur (40–400 mg/dL), quelle que soit l'unité du fichier.
 *  - Générique : n'importe quel CSV ayant une colonne date/heure et une colonne glucose.
 *
 * Conventions du module :
 *  - module pur (ni React ni DOM) ; les erreurs sont des codes traduits par l'UI ;
 *  - glycémies internes en g/L (120 mg/dL = 1,20 g/L ; 1 mmol/L = 0,18 g/L), arrondies à 2 décimales ;
 *  - horodatages interprétés en heure locale (sauf fuseau explicite dans une date ISO) ;
 *  - `skipped` compte les lignes de glucose illisibles (date ou valeur invalide, valeur hors plage)
 *    ainsi que les doublons exacts (même minute, même valeur, même type) présents dans le fichier.
 */

import type { JournalEntry } from '../types';
import { mgdlToGl, roundTo, toNumber } from '../units';
import { toDate, toLocalISO } from '../time';
import { newId } from '../ids';

// ─── Types publics ──────────────────────────────────────────────────────────

export type CgmFormat = 'libreview' | 'dexcom' | 'generic' | 'unknown';
export type CgmUnit = 'mg/dL' | 'mmol/L' | 'g/L' | 'unknown';
export type CgmReadingKind = 'historic' | 'scan' | 'cgm' | 'manual';
export type CgmDateOrder = 'DMY' | 'MDY' | 'auto';
export type CgmImportError = 'EMPTY' | 'NO_HEADER' | 'NO_GLUCOSE_COLUMN' | 'NO_TIME_COLUMN' | 'NO_READINGS';

export interface CgmReading {
  at: Date;
  valueGl: number;
  kind: CgmReadingKind;
}

export interface CgmImportResult {
  format: CgmFormat;
  readings: CgmReading[];
  skipped: number;
  errors: CgmImportError[];
  unit: CgmUnit;
}

export interface CgmParseOptions {
  /** Ordre jour/mois des dates ambiguës « A-B-YYYY » ; 'auto' (défaut) détecte d'après les valeurs. */
  dateOrder?: CgmDateOrder;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

/** 1 mmol/L ≈ 18 mg/dL = 0,18 g/L. */
const MMOL_TO_GL = 0.18;
/** Dexcom affiche « Low » sous 40 mg/dL : valeur retenue 39 mg/dL. */
export const DEXCOM_LOW_GL = 0.39;
/** Dexcom affiche « High » au-dessus de 400 mg/dL : valeur retenue 401 mg/dL. */
export const DEXCOM_HIGH_GL = 4.01;
/** Plage de plausibilité d'une glycémie importée, en g/L (bornes exclues / incluses). */
const MIN_GL = 0;
const MAX_GL = 10;
/** Nombre de lignes inspectées pour trouver l'en-tête et le délimiteur. */
const HEADER_SCAN_ROWS = 10;
const SNIFF_LINES = 20;
const DELIMITERS = [';', '\t', ','] as const;

// ─── Lecture CSV tolérante ──────────────────────────────────────────────────

/** Découpe le texte en lignes/cellules (guillemets, "" échappé, CRLF, champs multi-lignes). */
function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim()));
}

/** Choisit le délimiteur produisant le nombre de colonnes le plus stable sur les premières lignes. */
function sniffDelimiter(text: string): string {
  const sample = text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim() !== '')
    .slice(0, SNIFF_LINES)
    .join('\n');
  let best: string = ',';
  let bestScore = 0;
  for (const delimiter of DELIMITERS) {
    const freq = new Map<number, number>();
    for (const row of parseRows(sample, delimiter)) {
      if (row.length > 1) freq.set(row.length, (freq.get(row.length) ?? 0) + 1);
    }
    const score = Math.max(0, ...freq.values());
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

// ─── Horodatages ────────────────────────────────────────────────────────────

const ISO_RE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
const DAY_MONTH_RE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]\.?M\.?)?)?$/i;
const AMBIGUOUS_RE = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/;

const pad2 = (v: string | number): string => String(v).padStart(2, '0');

function buildLocal(y: number, mo: number, d: number, h: number, mi: number, s: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi, s, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** Date locale depuis un horodatage ISO, « DD-MM-YYYY HH:MM » ou « MM-DD-YYYY HH:MM [AM/PM] » ; null si illisible. */
export function parseCgmTimestamp(raw: string, order: 'DMY' | 'MDY' = 'DMY'): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = ISO_RE.exec(s);
  if (iso) {
    const [, y = '', mo = '', d = '', h = '0', mi = '0', sec = '0', zone] = iso;
    if (zone) {
      const z = zone.toUpperCase() === 'Z' ? 'Z' : zone.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
      const t = new Date(`${y}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${mi}:${pad2(sec)}${z}`);
      return Number.isNaN(t.getTime()) ? null : t;
    }
    return buildLocal(Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(sec));
  }
  const dm = DAY_MONTH_RE.exec(s);
  if (dm) {
    const [, a = '', b = '', yRaw = '', h = '0', mi = '0', sec = '0', ampm] = dm;
    const year = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    const day = order === 'DMY' ? Number(a) : Number(b);
    const month = order === 'DMY' ? Number(b) : Number(a);
    let hour = Number(h);
    if (ampm) {
      const pm = ampm.toUpperCase().startsWith('P');
      if (hour === 12) hour = pm ? 12 : 0;
      else if (pm) hour += 12;
    }
    return buildLocal(year, month, day, hour, Number(mi), Number(sec));
  }
  return null;
}

/**
 * Heuristique jour/mois sur des dates « A-B-YYYY » : un premier champ > 12 ⇒ DMY,
 * sinon un second champ > 12 ⇒ MDY, sinon DMY (export européen par défaut).
 */
export function detectDateOrder(samples: string[]): 'DMY' | 'MDY' {
  let secondOver12 = false;
  for (const sample of samples) {
    const m = AMBIGUOUS_RE.exec(sample.trim());
    if (!m) continue;
    if (Number(m[1]) > 12) return 'DMY';
    if (Number(m[2]) > 12) secondOver12 = true;
  }
  return secondOver12 ? 'MDY' : 'DMY';
}

// ─── Unités ─────────────────────────────────────────────────────────────────

const UNIT_MG = /mg\s*\/\s*dl/i;
const UNIT_MMOL = /mmol/i;
const UNIT_GL = /(^|[^m])g\s*\/\s*l/i;

function unitFromLabel(label: string): CgmUnit {
  if (UNIT_MG.test(label)) return 'mg/dL';
  if (UNIT_MMOL.test(label)) return 'mmol/L';
  if (UNIT_GL.test(label)) return 'g/L';
  return 'unknown';
}

/** Sans unité dans l'en-tête : une valeur ≥ 30 ne peut être qu'en mg/dL, sinon mmol/L. */
function inferUnit(values: number[]): CgmUnit {
  if (values.length === 0) return 'unknown';
  return Math.max(...values) >= 30 ? 'mg/dL' : 'mmol/L';
}

function toGl(value: number, unit: CgmUnit): number | null {
  switch (unit) {
    case 'mg/dL':
      return mgdlToGl(value);
    case 'mmol/L':
      return roundTo(value * MMOL_TO_GL, 2);
    case 'g/L':
      return roundTo(value, 2);
    default:
      return null;
  }
}

// ─── Détection de l'en-tête et extraction par format ────────────────────────

/** Valeur brute d'une ligne de glucose ; `fixedGl` court-circuite la conversion (Low/High Dexcom). */
interface RawCell {
  kind: CgmReadingKind;
  raw: string;
  fixedGl?: number;
}

interface Layout {
  format: Exclude<CgmFormat, 'unknown'>;
  headerIndex: number;
  unitHint: CgmUnit;
  timestampOf(row: string[]): string;
  /** 'ignore' : ligne légitime mais sans glucose (insuline, alerte, métadonnées). */
  extract(row: string[]): RawCell | 'ignore';
}

const findCol = (row: string[], re: RegExp, exclude = -1): number => row.findIndex((c, i) => i !== exclude && re.test(c));
const cell = (row: string[], i: number): string => (i >= 0 ? (row[i] ?? '') : '');

const LIBRE_TIME = /device timestamp|horodatage de l.appareil/i;
const LIBRE_TYPE = /record type|type d.enregistrement/i;
const LIBRE_HISTORIC = /historic|historique/i;
const LIBRE_SCAN = /scan/i;
const LIBRE_STRIP = /strip|bandelette/i;

function libreLayout(row: string[], headerIndex: number): Layout | null {
  const time = findCol(row, LIBRE_TIME);
  if (time < 0) return null;
  const historic = findCol(row, LIBRE_HISTORIC);
  const scan = findCol(row, LIBRE_SCAN);
  const strip = findCol(row, LIBRE_STRIP);
  if (historic < 0 && scan < 0) return null;
  const type = findCol(row, LIBRE_TYPE);
  const unitHint = unitFromLabel([cell(row, historic), cell(row, scan), cell(row, strip)].join(' '));
  const columns: Array<[number, CgmReadingKind]> = [
    [historic, 'historic'],
    [scan, 'scan'],
    [strip, 'manual'],
  ];
  const byType: Record<number, CgmReadingKind> = { 0: 'historic', 1: 'scan', 6: 'manual' };
  return {
    format: 'libreview',
    headerIndex,
    unitHint,
    timestampOf: (r) => cell(r, time),
    extract: (r) => {
      const typeRaw = cell(r, type);
      const recordType = typeRaw === '' ? null : Number(typeRaw);
      if (recordType != null && Number.isFinite(recordType)) {
        const kind = byType[recordType];
        if (!kind) return 'ignore';
        const col = columns.find(([, k]) => k === kind)?.[0] ?? -1;
        return { kind, raw: cell(r, col) };
      }
      // Type absent ou illisible : première colonne de glucose renseignée.
      for (const [col, kind] of columns) if (col >= 0 && cell(r, col) !== '') return { kind, raw: cell(r, col) };
      return { kind: 'historic', raw: '' };
    },
  };
}

const DEXCOM_TIME = /^(timestamp|horodatage)/i;
const DEXCOM_TYPE = /^(event type|type d.[ée]v[ée]nement)/i;
const DEXCOM_VALUE = /^(glucose value|valeur (de )?gl[uy]c)/i;
const DEXCOM_EGV = /^EGV$/i;
const DEXCOM_CALIBRATION = /^(calibration|[ée]talonnage)$/i;

function dexcomLayout(row: string[], headerIndex: number): Layout | null {
  const time = findCol(row, DEXCOM_TIME);
  const type = findCol(row, DEXCOM_TYPE);
  const value = findCol(row, DEXCOM_VALUE);
  if (time < 0 || type < 0 || value < 0) return null;
  return {
    format: 'dexcom',
    headerIndex,
    unitHint: unitFromLabel(cell(row, value)),
    timestampOf: (r) => cell(r, time),
    extract: (r) => {
      const eventType = cell(r, type);
      const raw = cell(r, value);
      if (DEXCOM_EGV.test(eventType)) {
        const u = raw.toUpperCase();
        if (u === 'LOW') return { kind: 'cgm', raw, fixedGl: DEXCOM_LOW_GL };
        if (u === 'HIGH') return { kind: 'cgm', raw, fixedGl: DEXCOM_HIGH_GL };
        return { kind: 'cgm', raw };
      }
      if (DEXCOM_CALIBRATION.test(eventType)) return { kind: 'manual', raw };
      return 'ignore';
    },
  };
}

const GENERIC_TIME = /time|date|horodatage/i;
const GENERIC_DATETIME = /timestamp|date.?time|horodatage/i;
const GENERIC_HOUR_ONLY = /^(time|heure|hour)$/i;
const GENERIC_VALUE = /gluc|glyc|value|valeur/i;
const GENERIC_GLUCOSE = /gluc|glyc/i;
const GENERIC_NOT_VALUE = /rate|change|unit|unité|trend|tendance|vitesse/i;

function genericValueCol(row: string[], timeCol: number, hourCol: number): number {
  const ok = (i: number): boolean => i !== timeCol && i !== hourCol;
  const tiers: Array<(c: string) => boolean> = [
    (c) => GENERIC_GLUCOSE.test(c) && !GENERIC_NOT_VALUE.test(c),
    (c) => GENERIC_GLUCOSE.test(c),
    (c) => GENERIC_VALUE.test(c),
  ];
  for (const test of tiers) {
    const i = row.findIndex((c, idx) => ok(idx) && test(c));
    if (i >= 0) return i;
  }
  return -1;
}

function genericLayout(row: string[], headerIndex: number): Layout | CgmImportError | null {
  if (row.length < 2) {
    return row.some((c) => GENERIC_VALUE.test(c)) ? 'NO_TIME_COLUMN' : null;
  }
  let time = findCol(row, GENERIC_DATETIME);
  if (time < 0) time = findCol(row, GENERIC_TIME);
  const value = time < 0 ? -1 : genericValueCol(row, time, -1);
  if (time < 0) return row.some((c) => GENERIC_VALUE.test(c)) ? 'NO_TIME_COLUMN' : null;
  if (value < 0) return 'NO_GLUCOSE_COLUMN';
  // Colonne « heure » séparée d'une colonne « date » (combinées à la lecture).
  const hour = GENERIC_HOUR_ONLY.test(cell(row, time)) ? -1 : row.findIndex((c, i) => i !== time && i !== value && GENERIC_HOUR_ONLY.test(c));
  const valueLabel = cell(row, value);
  let unitHint = unitFromLabel(valueLabel);
  if (unitHint === 'unknown') unitHint = unitFromLabel(row.join(' '));
  return {
    format: 'generic',
    headerIndex,
    unitHint,
    timestampOf: (r) => {
      const d = cell(r, time);
      if (hour >= 0 && !/\d:\d/.test(d)) return `${d} ${cell(r, hour)}`.trim();
      return d;
    },
    extract: (r) => ({ kind: 'cgm', raw: cell(r, value) }),
  };
}

/** Cherche l'en-tête dans les premières lignes : LibreView, puis Dexcom, puis générique. */
function findLayout(rows: string[][]): Layout | CgmImportError {
  const candidates = rows.slice(0, HEADER_SCAN_ROWS);
  for (let i = 0; i < candidates.length; i += 1) {
    const layout = libreLayout(candidates[i] ?? [], i);
    if (layout) return layout;
  }
  for (let i = 0; i < candidates.length; i += 1) {
    const layout = dexcomLayout(candidates[i] ?? [], i);
    if (layout) return layout;
  }
  let error: CgmImportError = 'NO_HEADER';
  for (let i = 0; i < candidates.length; i += 1) {
    const layout = genericLayout(candidates[i] ?? [], i);
    if (layout == null) continue;
    if (typeof layout === 'string') {
      if (error === 'NO_HEADER') error = layout;
      continue;
    }
    return layout;
  }
  return error;
}

// ─── API publique ───────────────────────────────────────────────────────────

const byTime = (a: CgmReading, b: CgmReading): number => a.at.getTime() - b.at.getTime();
const minuteKey = (d: Date): number => Math.floor(d.getTime() / 60000);

/** Analyse un export CSV de CGM et renvoie les lectures en g/L, triées par temps croissant. */
export function parseCgmCsv(text: string, opts: CgmParseOptions = {}): CgmImportResult {
  const cleaned = (text ?? '').replace(/^\uFEFF/, '');
  const empty = (format: CgmFormat, error: CgmImportError, unit: CgmUnit = 'unknown'): CgmImportResult => ({
    format,
    readings: [],
    skipped: 0,
    errors: [error],
    unit,
  });
  if (cleaned.trim() === '') return empty('unknown', 'EMPTY');

  const rows = parseRows(cleaned, sniffDelimiter(cleaned)).filter((r) => r.some((c) => c !== ''));
  const layout = findLayout(rows);
  if (typeof layout === 'string') return empty('unknown', layout);

  const dataRows = rows.slice(layout.headerIndex + 1);
  const order =
    opts.dateOrder === 'DMY' || opts.dateOrder === 'MDY' ? opts.dateOrder : detectDateOrder(dataRows.map((r) => layout.timestampOf(r)));

  interface Pending {
    at: Date;
    kind: CgmReadingKind;
    raw: number | null;
    fixedGl: number | null;
  }
  const pending: Pending[] = [];
  let skipped = 0;
  for (const row of dataRows) {
    const extracted = layout.extract(row);
    if (extracted === 'ignore') continue;
    const at = parseCgmTimestamp(layout.timestampOf(row), order);
    const fixedGl = extracted.fixedGl ?? null;
    const raw = fixedGl == null ? toNumber(extracted.raw) : null;
    if (!at || (fixedGl == null && (raw == null || raw <= 0))) {
      skipped += 1;
      continue;
    }
    pending.push({ at, kind: extracted.kind, raw, fixedGl });
  }

  const rawValues = pending.flatMap((p) => (p.raw != null ? [p.raw] : []));
  const unit = layout.unitHint !== 'unknown' ? layout.unitHint : inferUnit(rawValues);

  const converted: CgmReading[] = [];
  for (const p of pending) {
    const valueGl = p.fixedGl ?? (p.raw != null ? toGl(p.raw, unit) : null);
    if (valueGl == null || !(valueGl > MIN_GL) || valueGl > MAX_GL) {
      skipped += 1;
      continue;
    }
    converted.push({ at: p.at, valueGl, kind: p.kind });
  }
  converted.sort(byTime);

  // Doublons exacts dans le fichier (même minute, même valeur, même type).
  const seen = new Set<string>();
  const readings: CgmReading[] = [];
  for (const r of converted) {
    const key = `${minuteKey(r.at)}|${r.valueGl}|${r.kind}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    readings.push(r);
  }

  const errors: CgmImportError[] = readings.length === 0 ? ['NO_READINGS'] : [];
  return { format: layout.format, readings, skipped, errors, unit };
}

/**
 * Agrège les lectures capteur ('historic' / 'cgm') par tranche de `minutes` (alignée sur minuit local) :
 * une lecture par tranche, valeur moyenne, horodatage = début de tranche.
 * Les lectures 'scan' et 'manual' sont conservées telles quelles.
 */
export function downsample(readings: CgmReading[], minutes: number): CgmReading[] {
  if (!(minutes > 0)) return [...readings].sort(byTime);
  const ms = Math.round(minutes * 60000);
  const buckets = new Map<string, { start: number; kind: CgmReadingKind; sum: number; n: number }>();
  const out: CgmReading[] = [];
  for (const r of readings) {
    if (r.kind === 'scan' || r.kind === 'manual') {
      out.push(r);
      continue;
    }
    const t = r.at.getTime();
    if (Number.isNaN(t)) continue;
    const dayStart = new Date(r.at.getFullYear(), r.at.getMonth(), r.at.getDate()).getTime();
    const idx = Math.floor((t - dayStart) / ms);
    const key = `${dayStart}:${idx}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sum += r.valueGl;
      bucket.n += 1;
    } else buckets.set(key, { start: dayStart + idx * ms, kind: r.kind, sum: r.valueGl, n: 1 });
  }
  for (const b of buckets.values()) out.push({ at: new Date(b.start), valueGl: roundTo(b.sum / b.n, 2), kind: b.kind });
  return out.sort(byTime);
}

/** Convertit des lectures en entrées de journal « mesure » de source 'cgm'. */
export function toJournalEntries(readings: CgmReading[]): JournalEntry[] {
  return readings.map((r) => ({
    id: newId('cgm_'),
    date: toLocalISO(r.at),
    mealType: 'mesure',
    source: 'cgm' as const,
    glycPre: r.valueGl,
    schemaVersion: 7,
  }));
}

function entryKey(e: JournalEntry): string | null {
  if (!e.date) return null;
  const at = toDate(e.date);
  if (Number.isNaN(at.getTime())) return null;
  const v = toNumber(e.glycPre);
  if (v == null) return null;
  return `${minuteKey(at)}|${roundTo(v, 2)}`;
}

/**
 * Écarte les entrées importées dont le couple (minute, valeur) existe déjà parmi les entrées
 * existantes de source 'cgm' ; les doublons internes à `incoming` sont aussi réduits à un seul.
 */
export function dedupeAgainst(existing: JournalEntry[], incoming: JournalEntry[]): JournalEntry[] {
  const seen = new Set<string>();
  for (const e of existing) {
    if (e.source !== 'cgm') continue;
    const key = entryKey(e);
    if (key) seen.add(key);
  }
  const out: JournalEntry[] = [];
  for (const e of incoming) {
    const key = entryKey(e);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(e);
  }
  return out;
}
