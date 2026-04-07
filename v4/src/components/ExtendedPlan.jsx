/**
 * ExtendedPlan — 4-6h injection timeline for rich/fatty meals (type "etendu").
 * Shows 3 phases with scheduled times, glycemia checkpoints, and completion toggles.
 */
import { useState } from 'react';

export default function ExtendedPlan({ plan, onTogglePhase, isDark, t }) {
  if (!plan || !plan.phases || plan.phases.length === 0) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks -- conditional early return above is stable
  const [now] = useState(() => Date.now());

  return (
    <div className={`rounded-2xl p-4 border-2 ${isDark ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-bold text-sm ${isDark ? 'text-indigo-400' : 'text-indigo-700'}`}>
          {'📋 '}{t?.('planEtendu') || 'Plan étendu 4h'}
        </h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-indigo-800 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
          {plan.phases.length} phases
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-4">
        {plan.phases.map((phase, i) => {
          const done = phase.done;
          const isActive = !done && (i === 0 || plan.phases[i - 1].done);
          return (
            <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: isDark ? '#1e293b' : '#e2e8f0' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: done ? '100%' : isActive ? '50%' : '0%',
                  background: done ? '#10b981' : isActive ? '#818cf8' : 'transparent',
                }} />
            </div>
          );
        })}
      </div>

      {/* Phases timeline */}
      <div className="relative space-y-1">
        {/* Vertical connector line */}
        <div className={`absolute left-[15px] top-4 bottom-4 w-0.5 ${isDark ? 'bg-indigo-800' : 'bg-indigo-200'}`} />

        {plan.phases.map((phase, i) => {
          const scheduledTime = plan.startTime + phase.delayMinutes * 60000;
          const timeStr = new Date(scheduledTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const isNext = !phase.done && (i === 0 || plan.phases[i - 1].done);
          const minutesUntil = Math.max(0, Math.round((scheduledTime - now) / 60000));

          return (
            <div key={i} className="relative flex gap-3 items-start">
              {/* Phase node */}
              <button
                onClick={() => onTogglePhase?.(i)}
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border-2 transition-all ${
                  phase.done
                    ? 'bg-emerald-500 border-emerald-400 text-white'
                    : isNext
                    ? `border-indigo-500 ${isDark ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-600'} animate-pulse`
                    : `${isDark ? 'bg-slate-800 border-slate-600 text-slate-500' : 'bg-gray-100 border-gray-300 text-gray-400'}`
                }`}
              >
                {phase.done ? '✓' : i + 1}
              </button>

              {/* Phase content */}
              <div className={`flex-1 rounded-xl p-2.5 border transition-all ${
                phase.done
                  ? isDark ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-emerald-50/50 border-emerald-200'
                  : isNext
                  ? isDark ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-200'
                  : isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xs font-semibold ${
                      phase.done ? (isDark ? 'text-emerald-400' : 'text-emerald-700')
                      : isNext ? (isDark ? 'text-indigo-300' : 'text-indigo-700')
                      : (isDark ? 'text-slate-400' : 'text-slate-500')
                    }`}>
                      {phase.label}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {i === 0 ? 'Maintenant' : `+${phase.delayMinutes} min`} — {timeStr}
                      {isNext && minutesUntil > 0 && (
                        <span className={`ml-1 font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                          (dans {minutesUntil} min)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      phase.done ? 'text-emerald-500'
                      : isNext ? 'text-indigo-500'
                      : (isDark ? 'text-slate-500' : 'text-slate-400')
                    }`}>
                      {phase.units}u
                    </p>
                    <p className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {phase.pct}%
                    </p>
                  </div>
                </div>

                {/* Glycemia checkpoint */}
                {phase.checkGlycemia && (
                  <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${
                    isDark ? 'text-pink-400' : 'text-pink-600'
                  }`}>
                    <span>🩸</span>
                    <span>{t?.('controlerGlycemieAvant') || 'Contrôler glycémie avant injection'}</span>
                  </div>
                )}

                {/* Toggle done */}
                {!phase.done && isNext && (
                  <button
                    onClick={() => onTogglePhase?.(i)}
                    className={`mt-2 w-full py-1.5 rounded-lg text-[11px] font-medium transition ${
                      isDark ? 'bg-indigo-700 text-indigo-200 hover:bg-indigo-600' : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    }`}
                  >
                    {'💉 '}{t?.('marquerFait') || 'Marquer comme fait'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className={`mt-3 pt-2 border-t text-center ${isDark ? 'border-indigo-800' : 'border-indigo-200'}`}>
        <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {t?.('doseTotal') || 'Dose totale'}: {plan.phases.reduce((s, p) => s + p.units, 0)}u
          {' — '}
          {plan.phases.filter(p => p.done).length}/{plan.phases.length} {t?.('phasesTerminees') || 'phases terminées'}
        </p>
      </div>
    </div>
  );
}
