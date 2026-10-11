import { useState } from 'react';
import { dedupeAgainst, downsample, parseCgmCsv, toJournalEntries } from '../domain/import/cgmCsv';

/**
 * Import d'un export CSV de capteur (LibreView, Dexcom Clarity ou CSV générique).
 * Les lectures capteur sont agrégées par 15 min, converties en entrées « mesure » de source 'cgm',
 * dédoublonnées contre le journal, puis remises au parent via onImport (qui persiste).
 */

const DOWNSAMPLE_MINUTES = 15;
const FORMAT_LABELS = { libreview: 'LibreView', dexcom: 'Dexcom Clarity', generic: 'CSV' };

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('READ_ERROR'));
    reader.readAsText(file);
  });
}

export default function CgmImport({ journal = [], onImport, t, isDark }) {
  const [result, setResult] = useState(null);

  const importFile = async (e) => {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;

    let text = '';
    try {
      text = await readFileText(file);
    } catch {
      text = '';
    }
    const { format, readings, skipped, errors } = parseCgmCsv(text);
    if (errors.length > 0 && readings.length === 0) {
      setResult({ ok: false });
      input.value = '';
      return;
    }

    const entries = toJournalEntries(downsample(readings, DOWNSAMPLE_MINUTES));
    const deduped = dedupeAgainst(Array.isArray(journal) ? journal : [], entries);
    if (onImport) onImport(deduped);

    setResult({
      ok: true,
      format: FORMAT_LABELS[format] || format,
      added: deduped.length,
      duplicates: entries.length - deduped.length,
      skipped,
    });
    input.value = '';
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const headingClass = `text-xs font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <section className={cardClass} aria-labelledby="cgm-import-title">
      <h3 id="cgm-import-title" className={headingClass}>
        {t('importCgmTitre')}
      </h3>
      <p className={`text-xs mb-2 ${mutedClass}`}>{t('importCgmDesc')}</p>
      <label
        className={`block min-h-[44px] py-3 px-2 rounded-xl border text-center text-xs font-medium transition cursor-pointer hover:scale-[1.02] active:scale-95 focus-within:ring-2 focus-within:ring-teal-500 ${
          isDark ? 'border-teal-700 bg-teal-900/20 text-teal-300' : 'border-teal-200 bg-teal-50 text-teal-700'
        }`}
      >
        {t('importCgmChoisir')}
        <input type="file" accept=".csv,text/csv" aria-label={t('importCgmChoisir')} onChange={importFile} className="sr-only" />
      </label>
      {result && !result.ok && (
        <p role="alert" className={`text-xs mt-2 p-2 rounded-xl ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
          {t('importCgmErreur')}
        </p>
      )}
      {result && result.ok && (
        <div role="status" className={`text-xs mt-2 p-2 rounded-xl ${isDark ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
          <p className="font-medium">{t('importCgmFormat', { format: result.format })}</p>
          <p className="mt-1">
            {t('importCgmResultat', { added: result.added, duplicates: result.duplicates, skipped: result.skipped })}
          </p>
        </div>
      )}
    </section>
  );
}
