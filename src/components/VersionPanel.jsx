import { formatDateTime } from '../domain/time';

/** Traduction avec repli : `t` renvoie la clé elle-même lorsqu'elle est absente. */
function tr(t, key, fallback, params) {
  const value = t?.(key, params);
  return value && value !== key ? value : fallback;
}

function formatBuildDate(dateString, locale) {
  if (!dateString) return '—';
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return formatDateTime(parsed, locale);
}

export default function VersionPanel({
  diagnostics,
  updateAvailable,
  releaseNotes,
  isDark,
  t,
  locale = 'fr',
  onCheckForUpdates,
  onApplyUpdate,
}) {
  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const labelClass = `text-xs uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const valueClass = `${isDark ? 'text-slate-200' : 'text-slate-700'} text-sm font-medium`;
  const remoteVersion = diagnostics?.remoteVersion?.version || '—';
  const remoteBuildId = diagnostics?.remoteVersion?.buildId || '—';
  const never = tr(t, 'jamais', 'Jamais');
  const lastCheck = diagnostics?.lastUpdateCheck ? formatBuildDate(diagnostics.lastUpdateCheck, locale) : never;

  const items = [
    [t('versionInstallee'), diagnostics?.version || '—'],
    [t('buildId'), diagnostics?.buildId || '—'],
    [t('dateBuild'), formatBuildDate(diagnostics?.buildDate, locale)],
    [t('serviceWorkerEtat'), diagnostics?.serviceWorkerState || '—'],
    [t('versionDisponible'), remoteVersion],
    [t('buildDisponible'), remoteBuildId],
    [t('cachesActifs'), diagnostics?.cacheNames?.length ?? 0],
    [t('derniereVerification'), lastCheck],
  ];

  return (
    <div className="space-y-2">
      <section className={cardClass} aria-label={t('diagnosticTitre')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {t('diagnosticTitre')}
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('diagnosticSousTitre')}
            </p>
          </div>
          <span
            role="status"
            className={`px-2 py-1 rounded-full text-xs font-semibold ${
              updateAvailable
                ? isDark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-50 text-amber-800'
                : isDark ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {updateAvailable ? t('miseAJourDisponible') : t('versionActuelle')}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 mt-3">
          {items.map(([label, value]) => (
            <div key={label}>
              <dt className={labelClass}>{label}</dt>
              <dd className={valueClass}>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCheckForUpdates}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              isDark ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t('verifierMisesAJour')}
          </button>
          <button
            type="button"
            onClick={onApplyUpdate}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              updateAvailable
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : isDark ? 'bg-teal-900/40 text-teal-200 hover:bg-teal-800/60' : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
            }`}
          >
            {t('forcerMiseAJour')}
          </button>
        </div>
      </section>

      <section className={cardClass} aria-label={t('quoiDeNeuf')}>
        <h3 className={labelClass}>{t('quoiDeNeuf')}</h3>
        <ul className={`list-disc list-inside space-y-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {releaseNotes?.length
            ? releaseNotes.map((note) => <li key={note}>{note}</li>)
            : <li>{t('aucuneNouvelle')}</li>}
        </ul>
      </section>
    </div>
  );
}
