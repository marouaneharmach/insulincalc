// ─── DATA MIGRATION UTILITY ─────────────────────────────────────────────────
// Versioned, idempotent migrations for localStorage schema changes.
// Must run before the app renders.

export const CURRENT_VERSION = 2;

/**
 * Run all pending data migrations.
 * Safe to call multiple times — skips already-applied versions.
 */
export function migrateData() {
  const currentVersion = parseInt(localStorage.getItem('insulincalc_v1_dataVersion') || '0');
  if (currentVersion >= CURRENT_VERSION) return;

  if (currentVersion < 1) migrateV0ToV1();
  if (currentVersion < 2) migrateV1ToV2();

  localStorage.setItem('insulincalc_v1_dataVersion', String(CURRENT_VERSION));
}

// ─── V0 → V1: Migrate App.jsx journal → journalStore format ────────────────

function migrateV0ToV1() {
  const oldRaw = localStorage.getItem('journal');
  if (!oldRaw) return;

  const oldEntries = JSON.parse(oldRaw);
  const existingRaw = localStorage.getItem('insulincalc_v1_journal');
  const existing = existingRaw ? JSON.parse(existingRaw) : [];

  const migrated = oldEntries.map(e => ({
    id: String(e.id),
    date: e.date,
    mealType: guessMealTypeFromHour(new Date(e.date).getHours()),
    preMealGlycemia: parseFloat(e.glycPre) || null,
    postMealGlycemia: e.glycPost ? parseFloat(e.glycPost) : null,
    postMealTime: null,
    foods: (e.alimentIds || []).map((fid, i) => ({
      foodId: fid,
      name: (e.aliments || '').split(', ')[i] || fid,
      mult: 1,
      carbs: 0, // cannot reconstruct from old schema
    })),
    totalCarbs: 0,
    doseCalculated: e.doseSuggested || 0,
    doseInjected: e.doseActual || e.doseSuggested || 0,
    correction: null,
    notes: '',
  }));

  const merged = [...migrated, ...existing];
  localStorage.setItem('insulincalc_v1_journal', JSON.stringify(merged));
}

// ─── V1 → V2: Single ratio/ISF → per-period profiles ───────────────────────

function migrateV1ToV2() {
  const ratio = parseFloat(localStorage.getItem('insulincalc_v1_ratio'));
  const isf = parseFloat(localStorage.getItem('insulincalc_v1_isf'));

  if (!isNaN(ratio) && !isNaN(isf)) {
    const profile = { ratio, isf };
    const profiles = {
      matin: { ...profile },
      midi: { ...profile },
      gouter: { ...profile },
      soir: { ...profile },
      nuit: { ...profile },
    };
    localStorage.setItem('insulincalc_v1_timeProfiles', JSON.stringify(profiles));
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function guessMealTypeFromHour(h) {
  if (h < 10) return 'petit-déjeuner';
  if (h < 15) return 'déjeuner';
  if (h < 18) return 'collation';
  return 'dîner';
}
