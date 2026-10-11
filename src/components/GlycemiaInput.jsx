import { useEffect, useId } from 'react';

const TRENDS = [
  { value: '↑', labelKey: 'VEL_rising_fast', fallback: 'Montée rapide' },
  { value: '↗', labelKey: 'VEL_rising', fallback: 'Montée lente' },
  { value: '→', labelKey: 'VEL_stable', fallback: 'Stable' },
  { value: '↘', labelKey: 'VEL_falling', fallback: 'Descente lente' },
  { value: '↓', labelKey: 'VEL_falling_fast', fallback: 'Descente rapide' },
  { value: '?', labelKey: 'VEL_unknown', fallback: 'Inconnue' },
];

function getCurrentTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Traduction avec repli : `t` renvoie la clé elle-même lorsqu'elle est absente. */
function tr(t, key, fallback) {
  const value = t?.(key);
  return value && value !== key ? value : fallback;
}

export default function GlycemiaInput({
  glycemia, setGlycemia,
  trend, setTrend,
  hour, setHour,
  t, isDark
}) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const glycId = `${uid}-glyc`;
  const hintId = `${uid}-hint`;
  const hourId = `${uid}-hour`;
  const trendLabelId = `${uid}-trend`;

  // Auto-fill current time on mount if no hour set
  useEffect(() => {
    if (!hour) {
      setHour(getCurrentTime());
    }
  }, [hour, setHour]);

  const handleGlycemiaChange = (e) => {
    let val = e.target.value;
    const num = parseFloat(val);
    // Auto-convert mg/dL → g/L if value >= 30
    if (!isNaN(num) && num >= 30) {
      val = (num / 100).toFixed(2);
    }
    setGlycemia(val);
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const labelClass = `text-xs uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const inputClass = `w-full p-2.5 rounded-xl border outline-none text-sm transition focus-visible:ring-2 focus-visible:ring-pink-500 ${isDark ? 'bg-slate-700 border-slate-600 text-white focus:border-pink-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-pink-400'}`;
  const hint = tr(t, 'glycemieSaisieHint', 'Saisie en g/L — une valeur en mg/dL (≥ 30) est convertie automatiquement.');

  return (
    <section className={cardClass} aria-labelledby={titleId}>
      <h3 id={titleId} className={`text-xs uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>
        🩸 {t('glycemie')}
      </h3>

      <div className="space-y-3">
        {/* Glycemia value + hour */}
        <div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor={glycId} className={labelClass}>{t('uniteGL') || 'g/L'}</label>
              <input
                id={glycId}
                type="number"
                step="0.01"
                min="0"
                max="600"
                inputMode="decimal"
                placeholder="1.10"
                aria-describedby={hintId}
                value={glycemia}
                onChange={handleGlycemiaChange}
                className={`${inputClass} text-center text-lg font-bold`}
              />
            </div>
            <div className="w-28">
              <label htmlFor={hourId} className={labelClass}>{t('heure') || 'Heure'}</label>
              <input
                id={hourId}
                type="time"
                value={hour}
                onChange={e => setHour(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <p id={hintId} className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {hint}
          </p>
        </div>

        {/* Trend selector */}
        <div>
          <p id={trendLabelId} className={labelClass}>{t('cl_tendance') || 'Tendance'}</p>
          <div className="flex gap-1" role="group" aria-labelledby={trendLabelId}>
            {TRENDS.map(tr_ => {
              const name = t(tr_.labelKey) || tr_.fallback;
              const selected = trend === tr_.value;
              return (
                <button
                  key={tr_.value}
                  type="button"
                  title={name}
                  aria-label={name}
                  aria-pressed={selected}
                  onClick={() => setTrend(tr_.value)}
                  className={`flex-1 py-2 rounded-xl text-base font-bold transition border outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
                    selected
                      ? 'border-pink-400 bg-pink-50 text-pink-700' + (isDark ? ' !bg-pink-900/30 !text-pink-300' : '')
                      : isDark
                        ? 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span aria-hidden="true">{tr_.value}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
