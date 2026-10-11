/**
 * Types du domaine. Le schéma du journal reprend les champs v5 (glycPre, doseReelle...)
 * formalisés et typés ; les champs v4 restent lisibles via les accesseurs de journal.ts.
 */

export type Trend = '↑' | '↗' | '→' | '↘' | '↓' | '?';
export type FatLevel = 'aucun' | 'faible' | 'moyen' | 'élevé';
export type Activity = 'aucune' | 'legere' | 'moderee' | 'intense';
export type BolusType = 'unique' | 'fractionne' | 'etendu' | 'dual';
export type InjectionType = 'correction' | 'basal' | 'manual' | 'bolus';
export type EntrySource = 'manual' | 'cgm' | 'import';
export type MealSlot = 'petit-dejeuner' | 'dejeuner' | 'diner' | 'collation' | 'suhoor' | 'iftar';

export interface SplitPhase {
  pct: number;
  units: number;
  delayMinutes: number;
  label: string;
  checkGlycemia: boolean;
  done?: boolean;
}

export interface FoodRef {
  id: string;
  name: string;
  carbs: number;
  qty: number;
  fat?: FatLevel | string;
  gi?: string;
}

export interface AlertRef {
  type: string;
  code?: string;
  params?: Record<string, string | number>;
  message?: string;
  severity?: 'risk' | 'warning' | 'info';
}

export interface JournalEntry {
  id: string | number;
  date: string;
  heure?: string | null;
  mealType?: string;
  mealSlot?: MealSlot | null;
  injectionType?: InjectionType | null;
  source?: EntrySource;
  glycPre?: number | string | null;
  glycPost?: number | string | null;
  glycPostAt?: string | null;
  tendance?: Trend | string | null;
  velocity?: number | null;
  totalGlucides?: number;
  totalLipides?: number;
  niveauGras?: FatLevel | string;
  aliments?: FoodRef[] | string | null;
  iobAuMoment?: number | null;
  doseSuggeree?: number;
  doseReelle?: number;
  doseActual?: number;
  bolusType?: BolusType;
  splitImmediate?: number | null;
  splitDelayed?: number | null;
  splitDelayMinutes?: number;
  splitPhases?: SplitPhase[] | null;
  splitDone2?: boolean;
  activitePhysique?: Activity | string;
  alertes?: AlertRef[];
  notes?: string;
  photoThumbnail?: string | null;
  hypoRiskScore?: number | null;
  nightMode?: boolean;
  fasting?: boolean;
  illness?: boolean;
  insulinProfileId?: string | null;
  hypoTreatment?: { carbsG: number; recheckAt?: string | null; recheckValue?: number | null } | null;
  schemaVersion?: number;
  // champs v4 (lecture seule, migrés à la volée)
  preMealGlycemia?: number | string | null;
  postMealGlycemia?: number | string | null;
  totalCarbs?: number;
  doseCalculated?: number;
  doseInjected?: number;
  doseSuggested?: number;
  foods?: unknown;
  correctionDetails?: { glycemia?: number; target?: number; iob?: number } | null;
  schedule?: unknown;
}

export interface GlucoseReading {
  value: number;
  at: Date;
  kind: 'pre' | 'post' | 'spot' | 'cgm';
  entryId: string | number;
}
