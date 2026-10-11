import { useState } from 'react';
import { LEGACY_SETTINGS_KEY_MAP, SCHEMA_VERSION, SETTINGS_KEYS, parseBackup, parseJournal } from '../data/schema';
import { migrateAllEntries } from '../data/migrations';
import { listReminders } from '../data/reminders';
import { APP_VERSION } from '../version';
import { formatDate, localDateKey } from '../domain/time';

/**
 * Sauvegarde & restauration : export d'un fichier JSON complet (profil, journal, rappels)
 * et import validé (schéma zod + migrations). Le composant ne touche jamais au stockage en
 * écriture : le parent reçoit les entrées (onImportJournal) et le profil (onImportProfile).
 */

const STORAGE_PREFIX = 'insulincalc_v4_';
/** Clés jamais exportées ni importées (secrets propres à l'appareil). */
const SECRET_KEYS = new Set(['groqApiKey']);

/** Clé réglage → orthographes localStorage historiques (ex. customFoods → custom_foods). */
const LEGACY_SPELLINGS = Object.entries(LEGACY_SETTINGS_KEY_MAP).reduce((acc, [legacy, key]) => {
  acc[key] = [...(acc[key] || []), legacy];
  return acc;
}, {});

function readStoredValue(key) {
  for (const spelling of [key, ...(LEGACY_SPELLINGS[key] || [])]) {
    const raw = localStorage.getItem(STORAGE_PREFIX + spelling);
    if (raw === null) continue;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

/** Profil exporté : chaque réglage connu présent dans localStorage, secrets exclus. */
function collectProfile() {
  const profile = {};
  for (const key of SETTINGS_KEYS) {
    if (SECRET_KEYS.has(key)) continue;
    const value = readStoredValue(key);
    if (value !== undefined) profile[key] = value;
  }
  return profile;
}

/** Profil importé : orthographes historiques ramenées aux clés courantes, secrets écartés. */
function normalizeProfile(raw) {
  const profile = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const canonical = LEGACY_SETTINGS_KEY_MAP[key] || key;
    if (SECRET_KEYS.has(canonical)) continue;
    if (!(canonical in profile) || key === canonical) profile[canonical] = value;
  }
  return profile;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('READ_ERROR'));
    reader.readAsText(file);
  });
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Traduction avec repli français quand la clé n'existe pas encore dans le dictionnaire. */
function tr(t, key, fallback, params) {
  const text = t(key, params);
  if (text && text !== key) return text;
  return Object.entries(params || {}).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), fallback);
}

export default function DataExport({ journal = [], onImportJournal, onImportProfile, t, isDark, locale = 'fr' }) {
  const [result, setResult] = useState(null);

  const exportData = () => {
    const now = new Date();
    downloadJson(
      {
        app: 'InsulinCalc',
        version: APP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        exportDate: now.toISOString(),
        profile: collectProfile(),
        journal: Array.isArray(journal) ? journal : [],
        reminders: listReminders(),
      },
      `insulincalc_backup_${localDateKey(now)}.json`,
    );
  };

  const importData = async (e) => {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;

    let parsed;
    try {
      parsed = JSON.parse(await readFileText(file));
    } catch (err) {
      setResult({ ok: false, message: t('importCorrompu', { error: err instanceof Error ? err.message : String(err) }) });
      input.value = '';
      return;
    }

    const res = parseBackup(parsed);
    if (!res.ok) {
      setResult({ ok: false, message: t('importFormatInvalide') });
      input.value = '';
      return;
    }

    const { backup } = res;
    const { entries, rejected } = parseJournal(migrateAllEntries(backup.journal));
    const profile = normalizeProfile(backup.profile);
    const counts = { params: Object.keys(profile).length, entries: entries.length, rejected };

    if (onImportJournal) onImportJournal(entries);
    if (onImportProfile) onImportProfile(profile);

    setResult({
      ok: true,
      message: t('importReussi', counts),
      detail: tr(t, 'importReussiDetail', '{params} réglages · {entries} entrées · {rejected} rejetées · sauvegarde du {date}', {
        ...counts,
        date: formatDate(backup.exportDate, locale),
      }),
    });
    input.value = '';
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const headingClass = `text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const actionClass = 'min-h-[44px] py-3 px-2 rounded-xl border text-center text-xs font-medium transition cursor-pointer hover:scale-[1.02] active:scale-95 focus-within:ring-2 focus-within:ring-teal-500';

  return (
    <section className={cardClass} aria-labelledby="data-export-title">
      <h3 id="data-export-title" className={headingClass}>
        {t('sauvegardeRestauration')}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={exportData}
          aria-label={t('exporter')}
          className={`${actionClass} ${isDark ? 'border-teal-700 bg-teal-900/20 text-teal-300' : 'border-teal-200 bg-teal-50 text-teal-700'}`}
        >
          <span className="text-lg block" aria-hidden="true">📤</span>
          {t('exporter')}
        </button>
        <label
          className={`${actionClass} ${isDark ? 'border-blue-700 bg-blue-900/20 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700'}`}
        >
          <span className="text-lg block" aria-hidden="true">📥</span>
          {t('importer')}
          <input type="file" accept=".json,application/json" aria-label={t('importer')} onChange={importData} className="sr-only" />
        </label>
      </div>
      {result && (
        <div
          role="status"
          className={`text-xs mt-2 p-2 rounded-xl ${
            result.ok
              ? isDark ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
              : isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'
          }`}
        >
          <p className="font-medium">{result.message}</p>
          {result.detail && <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{result.detail}</p>}
        </div>
      )}
    </section>
  );
}
