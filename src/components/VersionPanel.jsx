function formatBuildDate(dateString) {
  if (!dateString) return '—';
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatLastCheck(dateString) {
  return dateString ? formatBuildDate(dateString) : 'Jamais';
}

export default function VersionPanel({
  diagnostics,
  updateAvailable,
  releaseNotes,
  isDark,
  t,
  onCheckForUpdates,
  onApplyUpdate,
}) {
  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const labelClass = `text-[10px] uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`;
  const valueClass = `${isDark ? 'text-slate-200' : 'text-slate-700'} text-sm font-medium`;
  const remoteVersion = diagnostics?.remoteVersion?.version || '—';
  const remoteBuildId = diagnostics?.remoteVersion?.buildId || '—';

  return (
    <div className="space-y-2">
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {t('diagnosticTitre')}
            </p>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('diagnosticSousTitre')}
            </p>
          </div>
          <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
            updateAvailable
              ? isDark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-50 text-amber-700'
              : isDark ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {updateAvailable ? t('miseAJourDisponible') : t('versionActuelle')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className={labelClass}>{t('versionInstallee')}</label>
            <p className={valueClass}>{diagnostics?.version || '—'}</p>
          </div>
          <div>
            <label className={labelClass}>{t('buildId')}</label>
            <p className={valueClass}>{diagnostics?.buildId || '—'}</p>
          </div>
          <div>
            <label className={labelClass}>{t('dateBuild')}</label>
            <p className={valueClass}>{formatBuildDate(diagnostics?.buildDate)}</p>
          </div>
          <div>
            <label className={labelClass}>{t('serviceWorkerEtat')}</label>
            <p className={valueClass}>{diagnostics?.serviceWorkerState || '—'}</p>
          </div>
          <div>
            <label className={labelClass}>{t('versionDisponible')}</label>
            <p className={valueClass}>{remoteVersion}</p>
          </div>
          <div>
            <label className={labelClass}>{t('buildDisponible')}</label>
            <p className={valueClass}>{remoteBuildId}</p>
          </div>
          <div>
            <label className={labelClass}>{t('cachesActifs')}</label>
            <p className={valueClass}>{diagnostics?.cacheNames?.length ?? 0}</p>
          </div>
          <div>
            <label className={labelClass}>{t('derniereVerification')}</label>
            <p className={valueClass}>{formatLastCheck(diagnostics?.lastUpdateCheck)}</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onCheckForUpdates}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
              isDark ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t('verifierMisesAJour')}
          </button>
          <button
            type="button"
            onClick={onApplyUpdate}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
              updateAvailable
                ? 'bg-teal-500 text-white hover:bg-teal-600'
                : isDark ? 'bg-teal-900/40 text-teal-200 hover:bg-teal-800/60' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
            }`}
          >
            {t('forcerMiseAJour')}
          </button>
        </div>
      </div>

      <div className={cardClass}>
        <label className={labelClass}>{t('quoiDeNeuf')}</label>
        <ul className={`space-y-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {releaseNotes?.length
            ? releaseNotes.map((note) => <li key={note}>• {note}</li>)
            : <li>• {t('aucuneNouvelle')}</li>}
        </ul>
      </div>
    </div>
  );
}
