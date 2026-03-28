import { useMemo, useRef, useEffect } from 'react';
import { APP_VERSION } from '../version';
import GlycemiaChart from './GlycemiaChart';
import TrendChart from './TrendChart';
import DoseAnimation from './DoseAnimation';

export default function HomeScreen({ patientName, lastGlyc, glycemia, journal, targetGMin, targetGMax, targetGMid, result, totalCarbs, selections, setTab, onQuickAdd, activeProfile, t, colors, isDark }) {

  // Compute stats directly from in-memory journal (uses glycPre/glycPost field names)
  const stats = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    const entries = journal
      .filter(e => new Date(e.date).getTime() >= cutoff)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const glycValues = [];
    entries.forEach(e => {
      const pre = parseFloat(e.glycPre);
      if (!isNaN(pre) && pre > 0) glycValues.push(pre);
      const post = parseFloat(e.glycPost);
      if (!isNaN(post) && post > 0) glycValues.push(post);
    });

    if (glycValues.length === 0) {
      return { count: 0, measureCount: 0, average: 0, timeInRange: 0, entries };
    }

    const avg = glycValues.reduce((s, v) => s + v, 0) / glycValues.length;
    const target = glycValues.filter(v => v >= 1.0 && v <= 1.8).length;
    const n = glycValues.length;

    return {
      count: entries.length,
      measureCount: n,
      average: Math.round(avg * 100) / 100,
      timeInRange: Math.round((target / n) * 100),
      entries,
    };
  }, [journal]);

  // Estimate HbA1c from glycPre/glycPost values
  const hba1c = useMemo(() => {
    const vals = [];
    journal.forEach(e => {
      const pre = parseFloat(e.glycPre);
      if (!isNaN(pre) && pre > 0) vals.push(pre);
      const post = parseFloat(e.glycPost);
      if (!isNaN(post) && post > 0) vals.push(post);
    });
    if (vals.length < 30) return null;
    const avgGL = vals.reduce((s, v) => s + v, 0) / vals.length;
    const avgMgDL = avgGL * 100;
    return Math.round(((avgMgDL + 46.7) / 28.7) * 10) / 10;
  }, [journal]);
  
  const glycColor = (v) => {
    if (!v || isNaN(v)) return colors.muted;
    if (v < 0.7) return colors.red;
    if (v < 1.0) return colors.orange;
    if (v <= 1.8) return colors.green;
    if (v <= 2.5) return colors.yellow;
    return colors.red;
  };

  const glycStatus = (v) => {
    if (!v) return '';
    if (v < 0.7) return '⚠️ Hypoglycémie';
    if (v < 1.0) return 'Limite basse';
    if (v <= 1.8) return '✅ Zone cible';
    if (v <= 2.5) return '⚠️ Élevée';
    return '🚨 Hyperglycémie';
  };

  const timeAgo = (mins) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${h}h`;
  };

  // Ref for auto-scroll to result
  const resultRef = useRef(null);
  const prevResultTotalRef = useRef(null);

  useEffect(() => {
    if (result && result.total !== prevResultTotalRef.current && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevResultTotalRef.current = result ? result.total : null;
  }, [result]);

  return (
    <div className="px-4 pt-3 space-y-2">
      {/* Header greeting */}
      <div className="flex items-center justify-between">
        <div>
          {patientName && (
            <p className={`text-sm ${isDark ? 'text-teal-400' : 'text-teal-600'} font-medium`}>
              {t('bonjour')} {patientName} 👋
            </p>
          )}
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            InsulinCalc <span className={`text-xs font-normal ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>v{APP_VERSION}</span>
          </h1>
        </div>
        {/* Current carbs badge if meal in progress */}
        {selections.length > 0 && (
          <div className={`px-3 py-1.5 rounded-xl ${isDark ? 'bg-teal-900/40 border-teal-700' : 'bg-teal-50 border-teal-200'} border`}>
            <p className="text-[10px] text-teal-600 uppercase tracking-wider font-medium">{t('glucides')}</p>
            <p className="text-xl font-bold text-teal-600">{totalCarbs}g</p>
          </div>
        )}
      </div>

      {/* Main glycemia card */}
      <div className={`rounded-2xl p-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} border shadow-sm`}>
        {lastGlyc ? (
          <div className="text-center">
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>{t('derniereMesure')}</p>
            <p className="text-4xl font-bold tracking-tight" style={{ color: glycColor(lastGlyc.value) }}>
              {lastGlyc.value.toFixed(2)}
              <span className={`text-lg font-normal ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>g/L</span>
            </p>
            <p className="text-sm mt-2" style={{ color: glycColor(lastGlyc.value) }}>
              {glycStatus(lastGlyc.value)} · {lastGlyc.source === 'current' ? '⚡ ' + (t('enCours') || 'En cours') : t('ilYA') + ' ' + timeAgo(lastGlyc.minutesAgo)}
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-4xl mb-2">🩸</p>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Aucune mesure</p>
            <button
              onClick={() => onQuickAdd('glycemia')}
              className="mt-3 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition"
            >
              + {t('ajouterGlycemie')}
            </button>
          </div>
        )}
      </div>

      {/* Glycemia chart */}
      {stats.measureCount >= 2 && (
        <div className={`rounded-2xl p-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} border shadow-sm`}>
          <GlycemiaChart entries={stats.entries} targetGMin={targetGMin} targetGMax={targetGMax} isDark={isDark} colors={colors} />
        </div>
      )}

      {/* Trend chart */}
      <TrendChart journal={journal} targetGMin={targetGMin} targetGMax={targetGMax} isDark={isDark} colors={colors} />

      {/* Active profile indicator */}
      {activeProfile.slot && (
        <div className={`rounded-xl px-3 py-1.5 text-center text-[10px] font-medium ${isDark ? 'bg-teal-900/20 text-teal-400 border border-teal-800/30' : 'bg-teal-50 text-teal-700 border border-teal-200'}`}>
          🕐 Profil actif : {activeProfile.label} — ICR 1/{activeProfile.ratio}g · ISF {activeProfile.isf} mg/dL
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl p-2.5 text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} border shadow-sm`}>
          <p className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('tirLabel')}</p>
          <p className="text-xl font-bold text-emerald-500">{stats.timeInRange || 0}%</p>
          {/* TIR mini bar */}
          <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stats.timeInRange || 0}%` }} />
          </div>
        </div>
        <div className={`rounded-2xl p-2.5 text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} border shadow-sm`}>
          <p className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('moyenneGL')}</p>
          <p className="text-xl font-bold" style={{ color: glycColor(stats.average) }}>
            {stats.average ? stats.average.toFixed(2) : '—'}
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>g/L</p>
        </div>
        <div className={`rounded-2xl p-2.5 text-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} border shadow-sm`}>
          <p className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('hba1cEstimee')}</p>
          <p className="text-xl font-bold text-purple-500">{hba1c ? `${hba1c}%` : '—'}</p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{stats.measureCount} {t('mesures')}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { type: 'glycemia', icon: '🩸', label: t('ajouterGlycemie'), color: 'bg-pink-50 text-pink-600 border-pink-100', darkColor: 'bg-pink-900/20 text-pink-400 border-pink-800/30' },
          { type: 'meal', icon: '🍽', label: t('ajouterRepas'), color: 'bg-emerald-50 text-emerald-600 border-emerald-100', darkColor: 'bg-emerald-900/20 text-emerald-400 border-emerald-800/30' },
          { type: 'insulin', icon: '💉', label: t('ajouterInsuline'), color: 'bg-blue-50 text-blue-600 border-blue-100', darkColor: 'bg-blue-900/20 text-blue-400 border-blue-800/30' },
          { type: 'activity', icon: '🏃', label: t('ajouterActivite'), color: 'bg-amber-50 text-amber-600 border-amber-100', darkColor: 'bg-amber-900/20 text-amber-400 border-amber-800/30' },
        ].map(action => (
          <button
            key={action.type}
            onClick={() => action.type === 'meal' ? setTab('repas') : onQuickAdd(action.type)}
            className={`flex flex-col items-center gap-1 p-2 rounded-2xl border transition-all hover:scale-105 active:scale-95 ${isDark ? action.darkColor : action.color}`}
          >
            <span className="text-xl">{action.icon}</span>
            <span className="text-[10px] font-medium leading-tight text-center">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Active result card if meal in progress */}
      {result && (
        <div ref={resultRef} className={`rounded-2xl p-4 border-2 ${isDark ? 'bg-slate-800 border-teal-600/50' : 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              {t('doseTotale')}
            </p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              result.bolusType === 'dual'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-teal-100 text-teal-700'
            }`}>
              {result.bolusType === 'dual' ? '⚡ Dual' : '💉 Standard'}
            </span>
          </div>
          <DoseAnimation dose={result.total} bolusType={result.bolusType} isDark={isDark} />
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {[
              { label: t('repas'), val: `${result.bolusRepas}U`, color: 'text-teal-600' },
              { label: t('correction'), val: result.correction > 0 ? `+${result.correction}U` : '—', color: result.correction > 0 ? 'text-amber-500' : 'text-slate-400' },
              { label: t('graisses'), val: result.fatBonus > 0 ? `+${result.fatBonus}U` : '—', color: result.fatBonus > 0 ? 'text-purple-500' : 'text-slate-400' },
            ].map((item, i) => (
              <div key={i} className={`text-center p-2 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-white/60'}`}>
                <p className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</p>
                <p className={`text-sm font-bold ${item.color}`}>{item.val}</p>
              </div>
            ))}
          </div>
          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-3 py-1.5 rounded-lg">
                  {w.txt}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
