/**
 * Data migration utilities for v4 → v5 upgrade
 * Handles field renaming, new field defaults, and idempotent operations
 */

/**
 * Check if journal entry needs migration to v5
 * @param {string|null|undefined} appVersion - Current app version
 * @returns {boolean} true if migration needed
 */
export function needsMigration(appVersion) {
  if (!appVersion) return true;

  const major = parseInt(appVersion.split('.')[0], 10);
  return major < 5;
}

/**
 * Extract time (HH:MM) from ISO datetime string
 * @param {string} dateStr - ISO format date string
 * @returns {string} HH:MM format
 */
function extractTime(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

/**
 * Migrate a single v4 journal entry to v5 format
 * Field mappings:
 *   preMealGlycemia → glycPre
 *   postMealGlycemia → glycPost
 *   totalCarbs → totalGlucides
 *   foods → aliments
 *   doseCalculated → doseSuggeree
 *   doseInjected → doseReelle
 *
 * New v5 fields (with defaults if not present):
 *   tendance: null
 *   niveauGras: 'aucun'
 *   iobAuMoment: null
 *   bolusType: 'unique'
 *   activitePhysique: 'aucune'
 *   alertes: []
 *   notes: ''
 *   heure: extracted from date
 *
 * @param {Object} entry - v4 journal entry
 * @returns {Object} Migrated v5 entry (idempotent)
 */
export function migrateEntry(entry) {
  if (!entry) return entry;

  // Start with a copy to avoid mutating input
  const migrated = { ...entry };

  // Field mappings (old → new)
  const fieldMappings = {
    preMealGlycemia: 'glycPre',
    postMealGlycemia: 'glycPost',
    totalCarbs: 'totalGlucides',
    foods: 'aliments',
    doseCalculated: 'doseSuggeree',
    doseInjected: 'doseReelle',
  };

  // Apply field mappings: copy old field to new if present
  Object.entries(fieldMappings).forEach(([oldKey, newKey]) => {
    if (oldKey in entry && !(newKey in entry)) {
      migrated[newKey] = entry[oldKey];
    }
  });

  // Extract heure from date if not already present
  if (!migrated.heure && entry.date) {
    migrated.heure = extractTime(entry.date);
  }

  // Add new v5 fields with defaults (only if not already present - idempotent)
  if (!('tendance' in migrated)) migrated.tendance = null;
  if (!('iobAuMoment' in migrated)) migrated.iobAuMoment = null;
  if (!('niveauGras' in migrated)) migrated.niveauGras = 'aucun';
  if (!('bolusType' in migrated)) migrated.bolusType = 'unique';
  if (!('activitePhysique' in migrated)) migrated.activitePhysique = 'aucune';
  if (!('alertes' in migrated)) migrated.alertes = [];
  if (!('notes' in migrated)) migrated.notes = '';

  return migrated;
}

/**
 * Migrate an array of journal entries to v5 format
 * @param {Array<Object>} entries - Array of v4 entries
 * @returns {Array<Object>} Array of migrated v5 entries
 */
export function migrateAllEntries(entries) {
  if (!Array.isArray(entries)) return entries;
  return entries.map(migrateEntry);
}
