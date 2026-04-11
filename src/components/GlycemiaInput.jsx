import { useEffect } from 'react';

const TRENDS = [
  { value: '↑', label: '↑', title: 'Montée rapide' },
  { value: '↗', label: '↗', title: 'Montée lente' },
  { value: '→', label: '→', title: 'Stable' },
  { value: '↘', label: '↘', title: 'Descente lente' },
  { value: '↓', label: '↓', title: 'Descente rapide' },
  { value: '?', label: '?', title: 'Inconnue' },
];

function getCurrentTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function GlycemiaInput({
  glycemia, setGlycemia,
  trend, setTrend,
  hour, setHour,
  t, isDark
}) {
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
  const labelClass = `text-[10px] uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`;
  const inputClass = `w-full p-2.5 rounded-xl border outline-none text-sm transition ${isDark ? 'bg-slate-700 border-slate-600 text-white focus:border-pink-500' : 'bg-gray-50 border-gray-200 focus:border-pink-400'}`;

  return (
    <div className={cardClass}>
      <label className={`text-[10px] uppercase tracking-wider font-semibold mb-2 block ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>
        🩸 {t('glycemie')}
      </label>

      <div className="space-y-3">
        {/* Glycemia value + hour */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className={labelClass}>{t('uniteGL') || 'g/L'}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="600"
              inputMode="decimal"
              placeholder="1.10"
              value={glycemia}
              onChange={handleGlycemiaChange}
              className={`${inputClass} text-center text-lg font-bold`}
            />
          </div>
          <div className="w-28">
            <label className={labelClass}>Heure</label>
            <input
              type="time"
              value={hour}
              onChange={e => setHour(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Trend selector */}
        <div>
          <label className={labelClass}>{t('cl_tendance') || 'Tendance'}</label>
          <div className="flex gap-1">
            {TRENDS.map(tr => (
              <button
                key={tr.value}
                title={tr.title}
                onClick={() => setTrend(tr.value)}
                className={`flex-1 py-2 rounded-xl text-base font-bold transition border ${
                  trend === tr.value
                    ? 'border-pink-400 bg-pink-50 text-pink-700' + (isDark ? ' !bg-pink-900/30 !text-pink-400' : '')
                    : isDark
                      ? 'border-slate-600 bg-slate-700 text-slate-400 hover:bg-slate-600'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
