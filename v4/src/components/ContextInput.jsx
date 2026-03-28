const ACTIVITY_OPTIONS = [
  { value: 'aucune', labelKey: 'cl_aucune', fallback: 'Aucune', icon: '🪑' },
  { value: 'légère', labelKey: 'cl_legere', fallback: 'Légère', icon: '🚶' },
  { value: 'modérée', labelKey: 'cl_moderee', fallback: 'Modérée', icon: '🏃' },
  { value: 'intense', labelKey: 'cl_intense', fallback: 'Intense', icon: '⚡' },
];

export default function ContextInput({
  activity, setActivity,
  iobTotal,
  t, isDark
}) {
  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const labelClass = `text-[10px] uppercase tracking-wider font-semibold mb-2 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

  const hasIob = iobTotal != null && iobTotal > 0;

  return (
    <div className={cardClass}>
      <label className={`text-[10px] uppercase tracking-wider font-semibold mb-2 block ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
        🏃 {t('cl_activite') || 'Activité physique'}
      </label>

      <div className="space-y-3">
        {/* IOB badge */}
        {hasIob && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            isDark
              ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <span className="text-base">💉</span>
            <div className="flex-1">
              <p className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                {t('cl_iobActive') || 'Insuline active'}
              </p>
              <p className={`text-lg font-bold leading-tight ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                {iobTotal.toFixed(1)}
                <span className={`text-xs font-normal ml-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  {t('cl_unites') || 'u'}
                </span>
              </p>
            </div>
            <div className={`text-[10px] text-right ${isDark ? 'text-amber-500' : 'text-amber-500'}`}>
              IOB
            </div>
          </div>
        )}

        {!hasIob && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
            isDark ? 'bg-slate-700/50' : 'bg-gray-50'
          }`}>
            <span className="text-base opacity-40">💉</span>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('cl_iobActive') || 'Insuline active'} — 0 {t('cl_unites') || 'u'}
            </p>
          </div>
        )}

        {/* Activity selector */}
        <div>
          <label className={labelClass}>{t('cl_activite') || 'Activité'}</label>
          <div className="grid grid-cols-4 gap-1.5">
            {ACTIVITY_OPTIONS.map(opt => {
              const label = t(opt.labelKey) || opt.fallback;
              const isSelected = activity === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setActivity(opt.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition ${
                    isSelected
                      ? 'border-amber-400 bg-amber-50 text-amber-700' + (isDark ? ' !bg-amber-900/30 !text-amber-400' : '')
                      : isDark
                        ? 'border-slate-600 bg-slate-700 text-slate-400 hover:bg-slate-600'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className={`text-[10px] font-medium ${
                    isSelected
                      ? isDark ? 'text-amber-400' : 'text-amber-700'
                      : isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
