import { useId } from 'react';

const ACTIVITY_OPTIONS = [
  { value: 'aucune', labelKey: 'cl_aucune', fallback: 'Aucune', icon: '🪑' },
  { value: 'legere', labelKey: 'cl_legere', fallback: 'Légère', icon: '🚶' },
  { value: 'moderee', labelKey: 'cl_moderee', fallback: 'Modérée', icon: '🏃' },
  { value: 'intense', labelKey: 'cl_intense', fallback: 'Intense', icon: '⚡' },
];

export default function ContextInput({
  activity, setActivity,
  iobTotal,
  t, isDark
}) {
  const titleId = useId();
  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;

  const hasIob = iobTotal != null && iobTotal > 0;
  const iobLabel = t('cl_iobActive') || 'Insuline active';
  const unit = t('cl_unites') || 'u';

  return (
    <section className={cardClass} aria-labelledby={titleId}>
      <h3 id={titleId} className={`text-xs uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
        🏃 {t('cl_activite') || 'Activité physique'}
      </h3>

      <div className="space-y-3">
        {/* IOB badge */}
        {hasIob && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            isDark
              ? 'bg-amber-900/20 border-amber-700/40 text-amber-300'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <span className="text-base" aria-hidden="true">💉</span>
            <div className="flex-1">
              <p className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                {iobLabel}
              </p>
              <p className={`text-lg font-bold leading-tight ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                {iobTotal.toFixed(1)}
                <span className={`text-xs font-normal ml-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                  {unit}
                </span>
              </p>
            </div>
            <div className={`text-xs text-right ${isDark ? 'text-amber-400' : 'text-amber-700'}`} aria-hidden="true">
              IOB
            </div>
          </div>
        )}

        {!hasIob && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
            isDark ? 'bg-slate-700/50' : 'bg-gray-50'
          }`}>
            <span className="text-base opacity-40" aria-hidden="true">💉</span>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {iobLabel} — 0 {unit}
            </p>
          </div>
        )}

        {/* Activity selector */}
        <div
          role="group"
          aria-label={t('cl_activite') || 'Activité physique'}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {ACTIVITY_OPTIONS.map(opt => {
            const label = t(opt.labelKey) || opt.fallback;
            const isSelected = activity === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setActivity(opt.value)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isSelected
                    ? 'border-amber-400 bg-amber-50 text-amber-800' + (isDark ? ' !bg-amber-900/30 !text-amber-300' : '')
                    : isDark
                      ? 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg" aria-hidden="true">{opt.icon}</span>
                <span className={`text-xs font-medium ${
                  isSelected
                    ? isDark ? 'text-amber-300' : 'text-amber-800'
                    : isDark ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
