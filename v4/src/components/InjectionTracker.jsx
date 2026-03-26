import { useState, useEffect, useMemo } from 'react';
import { calcIOB } from '../utils/calculations';
import { DIGESTION_PROFILES } from '../data/constants';

/**
 * InjectionTracker — Interactive injection plan validation
 * Shows each scheduled step with countdown, lets patient confirm/skip injections
 */
export default function InjectionTracker({ entry, journal, setJournal, isDark, t }) {
  const [now, setNow] = useState(Date.now());
  const [doseInputs, setDoseInputs] = useState({});

  // Update "now" every 30s for countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const steps = entry.scheduleSteps || [];
  if (steps.length === 0) return null;

  const mealTime = new Date(entry.date).getTime();
  const digProfile = DIGESTION_PROFILES[entry.digestion || 'normal'];

  // Compute total validated dose
  const validatedDose = steps
    .filter(s => s.status === 'done')
    .reduce((sum, s) => sum + (s.actualDose || 0), 0);

  // Current IOB from validated steps
  const currentIOB = useMemo(() => {
    return steps
      .filter(s => s.status === 'done' && s.actualDose > 0 && s.completedAt)
      .reduce((sum, s) => {
        const elapsed = (now - s.completedAt) / 60000;
        return sum + calcIOB(s.actualDose, elapsed, digProfile.tail);
      }, 0);
  }, [steps, now, digProfile]);

  const confirmStep = (stepIndex) => {
    const inputDose = doseInputs[stepIndex];
    const step = steps[stepIndex];
    const dose = inputDose !== undefined && inputDose !== '' ? parseFloat(inputDose) : step.units;

    setJournal(prev => prev.map(e => {
      if (e.id !== entry.id) return e;
      const newSteps = [...e.scheduleSteps];
      newSteps[stepIndex] = {
        ...newSteps[stepIndex],
        status: 'done',
        actualDose: isNaN(dose) ? step.units : dose,
        completedAt: Date.now(),
      };
      // Update total doseActual
      const totalDone = newSteps.filter(s => s.status === 'done').reduce((s, st) => s + (st.actualDose || 0), 0);
      return { ...e, scheduleSteps: newSteps, doseActual: totalDone };
    }));
    setDoseInputs(prev => ({ ...prev, [stepIndex]: undefined }));
  };

  const skipStep = (stepIndex) => {
    setJournal(prev => prev.map(e => {
      if (e.id !== entry.id) return e;
      const newSteps = [...e.scheduleSteps];
      newSteps[stepIndex] = { ...newSteps[stepIndex], status: 'skipped', completedAt: Date.now() };
      return { ...e, scheduleSteps: newSteps };
    }));
  };

  const cardBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100';

  return (
    <div className={`rounded-2xl p-3 border shadow-sm ${cardBg}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
          💉 {t?.('planInjection') || 'Plan d\'injection'}
        </p>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            {validatedDose.toFixed(1)}U injecté
          </span>
          {currentIOB > 0.1 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
              IOB {currentIOB.toFixed(1)}U
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-gray-200 mb-3 overflow-hidden">
        <div className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${(steps.filter(s => s.status !== 'pending').length / steps.length) * 100}%` }} />
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => {
          const stepTime = mealTime + step.timeMin * 60000;
          const minutesLeft = Math.round((stepTime - now) / 60000);
          const isPast = now > stepTime;
          const isSoon = !isPast && minutesLeft <= 15;
          const isInjection = step.units != null;
          const timeLabel = new Date(stepTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

          if (step.status === 'done') {
            const proposed = step.units;
            const actual = step.actualDose;
            const differs = proposed != null && actual != null && Math.abs(proposed - actual) >= 0.1;
            return (
              <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl ${isDark ? 'bg-emerald-900/15' : 'bg-emerald-50'}`}>
                <span className="text-base">✅</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{step.label}</p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{timeLabel}</p>
                </div>
                <div className="text-right shrink-0">
                  {actual > 0 && (
                    <p className="text-sm font-bold text-emerald-500">{actual}U ✓</p>
                  )}
                  {differs && proposed > 0 && (
                    <p className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      proposé: {proposed}U
                    </p>
                  )}
                </div>
              </div>
            );
          }

          if (step.status === 'skipped') {
            return (
              <div key={i} className={`flex items-center gap-3 p-2 rounded-xl opacity-50 ${isDark ? 'bg-slate-700/30' : 'bg-gray-50'}`}>
                <span className="text-base">⏭</span>
                <p className={`text-sm flex-1 line-through ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{step.label}</p>
              </div>
            );
          }

          // Pending step
          return (
            <div key={i} className={`p-3 rounded-xl border-2 transition ${
              isSoon
                ? 'border-amber-300 bg-amber-50 animate-pulse' + (isDark ? ' !bg-amber-900/20 !border-amber-600' : '')
                : isPast
                  ? 'border-red-200 bg-red-50' + (isDark ? ' !bg-red-900/15 !border-red-800/30' : '')
                  : isDark ? 'border-slate-600 bg-slate-700/30' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                  style={{ background: (step.color || '#3B82F6') + '20', border: `2px solid ${step.color || '#3B82F6'}` }}>
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{step.label}</p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {timeLabel}
                    {!isPast && minutesLeft > 0 && (
                      <span className={isSoon ? ' font-bold text-amber-600' : ''}>
                        {' '}· dans {minutesLeft < 60 ? `${minutesLeft}min` : `${Math.floor(minutesLeft/60)}h${minutesLeft%60>0 ? minutesLeft%60+'min' : ''}`}
                      </span>
                    )}
                    {isPast && <span className="font-bold text-red-400"> · en retard</span>}
                  </p>
                </div>
                {isInjection && (
                  <span className={`text-sm font-bold px-2 py-1 rounded-full ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                    {step.units}U
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-2">
                {isInjection ? (
                  <>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder={String(step.units)}
                        value={doseInputs[i] ?? ''}
                        onChange={e => setDoseInputs(prev => ({ ...prev, [i]: e.target.value }))}
                        className={`w-16 text-center text-sm font-bold p-1.5 rounded-lg border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200'}`}
                      />
                      <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>U</span>
                    </div>
                    <button onClick={() => confirmStep(i)}
                      className="px-4 py-1.5 rounded-xl text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition">
                      ✓ Injecté
                    </button>
                  </>
                ) : (
                  <button onClick={() => confirmStep(i)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition ${
                      isDark ? 'bg-purple-900/30 text-purple-400 border border-purple-700' : 'bg-purple-50 text-purple-600 border border-purple-200'
                    }`}>
                    🩸 Mesuré
                  </button>
                )}
                <button onClick={() => skipStep(i)}
                  className={`px-3 py-1.5 rounded-xl text-xs transition ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}>
                  ⏭
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
