/**
 * ExtendedPlan — 4-6h injection timeline for rich/fatty meals (type "etendu").
 * Shows 3 phases with scheduled times, glycemia checkpoints, and completion toggles.
 */
import { useState } from 'react';
import { formatTime } from '../domain/time';

const noTranslate = () => undefined;

/**
 * Les plans récents portent un code (PHASE_FAST_CARBS…) traduit via `t` ;
 * les entrées historiques conservent un libellé français brut, affiché tel
 * quel lorsque `t` renvoie la clé elle-même.
 */
function phaseLabel(t, label) {
  if (!label) return '';
  const translated = t(label);
  return translated && translated !== label ? translated : label;
}

export default function ExtendedPlan({ plan, onTogglePhase, isDark, t = noTranslate, locale = 'fr' }) {
  const [now] = useState(() => Date.now());

  if (!plan || !plan.phases || plan.phases.length === 0) return null;

  const unit = t('cl_unites') || 'u';
  const totalUnits = plan.phases.reduce((s, p) => s + p.units, 0);
  const doneCount = plan.phases.filter((p) => p.done).length;
  const markDone = t('marquerFait') || 'Marquer fait';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <section
      aria-label={t('planEtendu4h') || t('planEtendu') || 'Plan étendu 4 h'}
      className={`rounded-2xl p-4 border-2 ${isDark ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-200'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-bold text-sm ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
          {'📋 '}{t('planEtendu4h') || t('planEtendu') || 'Plan étendu 4 h'}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-indigo-800 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>
          {plan.phases.length} {t('phases') || 'phases'}
        </span>
      </div>

      {/* Progress bar (décorative : l'état est porté par la liste ci-dessous) */}
      <div className="flex gap-1 mb-4" aria-hidden="true">
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
      <ol className="relative space-y-1 list-none p-0 m-0">
        {/* Vertical connector line */}
        <div aria-hidden="true" className={`absolute left-[15px] top-4 bottom-4 w-0.5 ${isDark ? 'bg-indigo-800' : 'bg-indigo-200'}`} />

        {plan.phases.map((phase, i) => {
          const scheduledTime = plan.startTime + phase.delayMinutes * 60000;
          const timeStr = formatTime(scheduledTime, locale);
          const isNext = !phase.done && (i === 0 || plan.phases[i - 1].done);
          const minutesUntil = Math.max(0, Math.round((scheduledTime - now) / 60000));
          const label = phaseLabel(t, phase.label);
          const inMinutes = t('dansMinutes', { minutes: minutesUntil }) || `dans ${minutesUntil} min`;

          return (
            <li key={i} className="relative flex gap-3 items-start">
              {/* Phase node */}
              <button
                type="button"
                onClick={() => onTogglePhase?.(i)}
                aria-pressed={Boolean(phase.done)}
                aria-label={`${markDone} — ${label}`}
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  phase.done
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : isNext
                    ? `border-indigo-500 ${isDark ? 'bg-indigo-900 text-indigo-200' : 'bg-indigo-100 text-indigo-700'} animate-pulse`
                    : `${isDark ? 'bg-slate-800 border-slate-600 text-slate-400' : 'bg-gray-100 border-gray-300 text-gray-600'}`
                }`}
              >
                <span aria-hidden="true">{phase.done ? '✓' : i + 1}</span>
              </button>

              {/* Phase content */}
              <div className={`flex-1 rounded-xl p-2.5 border transition-all ${
                phase.done
                  ? isDark ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-emerald-50/50 border-emerald-200'
                  : isNext
                  ? isDark ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-200'
                  : isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-xs font-semibold ${
                      phase.done ? (isDark ? 'text-emerald-300' : 'text-emerald-800')
                      : isNext ? (isDark ? 'text-indigo-300' : 'text-indigo-700')
                      : mutedClass
                    }`}>
                      {label}
                    </p>
                    <p className={`text-xs mt-0.5 ${mutedClass}`}>
                      {i === 0 ? (t('maintenant') || 'Maintenant') : `+${phase.delayMinutes} min`} — {timeStr}
                      {isNext && minutesUntil > 0 && (
                        <span className={`ml-1 font-medium ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                          ({inMinutes})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      phase.done ? (isDark ? 'text-emerald-400' : 'text-emerald-700')
                      : isNext ? (isDark ? 'text-indigo-400' : 'text-indigo-600')
                      : mutedClass
                    }`}>
                      {phase.units} {unit}
                    </p>
                    <p className={`text-xs ${mutedClass}`}>
                      {phase.pct}%
                    </p>
                  </div>
                </div>

                {/* Glycemia checkpoint */}
                {phase.checkGlycemia && (
                  <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${isDark ? 'text-pink-300' : 'text-pink-700'}`}>
                    <span aria-hidden="true">🩸</span>
                    <span>{t('controlerGlycemieAvant') || 'Contrôler glycémie avant injection'}</span>
                  </p>
                )}

                {/* Toggle done */}
                {!phase.done && isNext && (
                  <button
                    type="button"
                    onClick={() => onTogglePhase?.(i)}
                    className={`mt-2 w-full py-1.5 rounded-lg text-xs font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                      isDark ? 'bg-indigo-700 text-indigo-100 hover:bg-indigo-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {'💉 '}{markDone}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Summary footer */}
      <div className={`mt-3 pt-2 border-t text-center ${isDark ? 'border-indigo-800' : 'border-indigo-200'}`}>
        <p className={`text-xs ${mutedClass}`}>
          {t('doseTotal') || 'Dose totale'} : {totalUnits} {unit}
          {' — '}
          {doneCount}/{plan.phases.length} {t('phasesTerminees') || 'phases terminées'}
        </p>
      </div>
    </section>
  );
}
