import { useState, useMemo } from 'react';
import { calcIOB } from '../utils/calculations';
import { DIGESTION_PROFILES } from '../data/constants';
import { evaluatePostPrandial } from '../utils/clinicalEngine';
import GlycEvolutionChart from './GlycEvolutionChart';

function glycColor(v) {
  if (!v || isNaN(v)) return '#94A3B8';
  if (v < 0.7) return '#EF4444';
  if (v < 1.0) return '#F97316';
  if (v <= 1.8) return '#10B981';
  if (v <= 2.5) return '#F59E0B';
  return '#EF4444';
}

export default function DayTimeline({ journal, setJournal, targetGMin, targetGMax, targetGMid, isf, t, colors, isDark }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Get entries for selected date
  const dayEntries = useMemo(() => {
    return journal
      .filter(e => e.date && e.date.startsWith(selectedDate))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [journal, selectedDate]);

  // Calculate IOB for each entry
  const entriesWithIOB = useMemo(() => {
    const now = Date.now();
    return dayEntries.map(entry => {
      if ((!entry.doseActual || entry.doseActual <= 0) && (!entry.doseReelle || entry.doseReelle <= 0)) return { ...entry, iob: 0 };
      const dose = entry.doseActual || entry.doseReelle || 0;
      const minutesElapsed = (now - new Date(entry.date).getTime()) / 60000;
      const digProfile = DIGESTION_PROFILES[entry.digestion || 'normal'];
      const iob = calcIOB(dose, minutesElapsed, digProfile.tail);
      return { ...entry, iob };
    });
  }, [dayEntries]);

  // Total IOB right now
  const totalIOB = useMemo(() => {
    return entriesWithIOB.reduce((sum, e) => sum + (e.iob || 0), 0);
  }, [entriesWithIOB]);

  // Daily insulin totals
  const dailyInsulinStats = useMemo(() => {
    let totalDose = 0;
    let corrections = 0;
    let mealBolus = 0;
    let basalCount = 0;
    let injectionCount = 0;

    dayEntries.forEach(e => {
      const dose = e.doseActual || e.doseReelle || 0;
      if (dose > 0) {
        totalDose += dose;
        injectionCount++;
        if (e.mealType === 'injection') {
          if (e.injectionType === 'correction') corrections += dose;
          else if (e.injectionType === 'basal') basalCount += dose;
          else corrections += dose;
        } else if ((e.totalCarbs || e.totalGlucides || 0) > 0) {
          mealBolus += dose;
        }
      }
    });
    return { totalDose, corrections, mealBolus, basalCount, injectionCount };
  }, [dayEntries]);

  // Navigate dates
  const changeDate = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const isYesterday = (() => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    return selectedDate === y.toISOString().split('T')[0];
  })();

  const dateLabel = isToday ? t('aujourdhui') : isYesterday ? t('hier') : new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getEventType = (entry) => {
    if (entry.mealType === 'mesure') return 'glycemia';
    if (entry.mealType === 'injection') return 'insulin';
    if ((entry.totalCarbs || entry.totalGlucides || 0) > 0) return 'meal';
    return 'glycemia';
  };

  const getInjectionLabel = (entry) => {
    if (entry.injectionType === 'correction') return t('correctionLabel') || 'Correction';
    if (entry.injectionType === 'basal') return t('basalLabel') || 'Basale';
    if (entry.injectionType === 'manual') return t('manualLabel') || 'Injection manuelle';
    return t('ajouterInsuline') || 'Injection';
  };

  const getInjectionIcon = (entry) => {
    if (entry.injectionType === 'correction') return '🎯';
    if (entry.injectionType === 'basal') return '🕐';
    return '💉';
  };

  const eventConfig = {
    glycemia: { icon: '🩸', color: '#EC4899', bgLight: 'bg-pink-50 border-pink-200', bgDark: 'bg-pink-900/20 border-pink-800/30' },
    meal: { icon: '🍽', color: '#10B981', bgLight: 'bg-emerald-50 border-emerald-200', bgDark: 'bg-emerald-900/20 border-emerald-800/30' },
    insulin: { icon: '💉', color: '#3B82F6', bgLight: 'bg-blue-50 border-blue-200', bgDark: 'bg-blue-900/20 border-blue-800/30' },
  };

  // Post-meal glycemia input
  const [editingPost, setEditingPost] = useState(null);
  const [postValue, setPostValue] = useState('');
  // Dose editing
  const [editingDose, setEditingDose] = useState(null);
  const [doseValue, setDoseValue] = useState('');
  // Expand schedule
  const [expandedSchedule, setExpandedSchedule] = useState(null);
  // Quick add inline
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineGlyc, setInlineGlyc] = useState('');
  const [inlineDose, setInlineDose] = useState('');
  const [inlineType, setInlineType] = useState('mesure'); // 'mesure', 'correction', 'basal'
  // Manual injection FAB
  const [showManualInjection, setShowManualInjection] = useState(false);
  const [manualDose, setManualDose] = useState('');
  const [manualType, setManualType] = useState('correction');

  const savePostGlyc = (entryId) => {
    if (!postValue) return;
    setJournal(prev => prev.map(e => e.id === entryId ? { ...e, glycPost: postValue } : e));
    setEditingPost(null);
    setPostValue('');
  };

  const saveDose = (entryId) => {
    const d = parseFloat(doseValue);
    if (isNaN(d) || d < 0) return;
    setJournal(prev => prev.map(e => e.id === entryId ? { ...e, doseActual: d, doseReelle: d } : e));
    setEditingDose(null);
    setDoseValue('');
  };

  const saveInlineEntry = () => {
    const glycVal = parseFloat(inlineGlyc);
    const doseVal = parseFloat(inlineDose);
    const hasGlyc = !isNaN(glycVal) && glycVal >= 0.3 && glycVal <= 6.0;
    const hasDose = !isNaN(doseVal) && doseVal > 0;
    if (!hasGlyc && !hasDose) return;

    if (hasGlyc) {
      const glycEntry = {
        id: Date.now(),
        date: new Date().toISOString(),
        glycPre: glycVal.toFixed(2),
        glycPost: '',
        totalCarbs: 0,
        doseSuggested: 0,
        doseActual: 0,
        aliments: '',
        alimentIds: [],
        mealType: 'mesure',
      };
      setJournal(prev => [glycEntry, ...prev].slice(0, 200));
    }

    if (hasDose) {
      const doseEntry = {
        id: Date.now() + 1,
        date: new Date().toISOString(),
        glycPre: hasGlyc ? glycVal.toFixed(2) : '',
        glycPost: '',
        totalCarbs: 0,
        doseSuggested: 0,
        doseActual: doseVal,
        aliments: '',
        alimentIds: [],
        mealType: 'injection',
        injectionType: inlineType === 'mesure' ? 'manual' : inlineType,
      };
      setJournal(prev => [doseEntry, ...prev].slice(0, 200));
    }

    setInlineGlyc('');
    setInlineDose('');
    setShowInlineAdd(false);
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;

  return (
    <div className="px-4 pt-2 space-y-2">
      {/* Date navigation */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <button onClick={() => changeDate(-1)} className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
            ←
          </button>
          <div className="text-center">
            <p className={`text-lg font-bold capitalize ${isDark ? 'text-white' : 'text-slate-800'}`}>{dateLabel}</p>
            {!isToday && <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{selectedDate}</p>}
          </div>
          <button onClick={() => changeDate(1)} disabled={isToday}
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isToday ? 'opacity-30 cursor-not-allowed' : ''
            } ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
            →
          </button>
        </div>
      </div>

      {/* IOB indicator */}
      {totalIOB > 0 && isToday && (
        <div className={`rounded-2xl p-3 border ${isDark ? 'bg-blue-900/20 border-blue-800/30' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>💉 {t('insulineActive')}</p>
              <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-500'}`}>IOB {t('enCours') || 'en cours'}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-500">{totalIOB.toFixed(1)}</p>
              <p className="text-xs text-blue-400">{t('unites')}</p>
            </div>
          </div>
          {/* IOB decay bar */}
          <div className="mt-2 h-1.5 rounded-full bg-blue-200/30 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, totalIOB * 20)}%` }} />
          </div>
        </div>
      )}

      {/* Daily insulin summary */}
      {dailyInsulinStats.injectionCount > 0 && (
        <div className={cardClass}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            📊 {t('resumeInsulineJour') || 'Résumé insuline du jour'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-lg font-bold text-blue-500">{dailyInsulinStats.totalDose.toFixed(1)}U</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-500">{dailyInsulinStats.mealBolus.toFixed(1)}U</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('repas')}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-500">{dailyInsulinStats.corrections.toFixed(1)}U</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('correction')}</p>
            </div>
          </div>
          {dailyInsulinStats.basalCount > 0 && (
            <p className={`text-[10px] mt-1 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('basalLabel') || 'Basale'}: {dailyInsulinStats.basalCount.toFixed(1)}U
            </p>
          )}
        </div>
      )}

      {/* Glycemia evolution chart */}
      <GlycEvolutionChart
        journal={journal}
        targetGMin={targetGMin}
        targetGMax={targetGMax}
        isDark={isDark}
        t={t}
      />

      {/* Quick inline add */}
      {isToday && (
        <div className={cardClass}>
          {!showInlineAdd ? (
            <button onClick={() => setShowInlineAdd(true)}
              className={`w-full py-2 rounded-xl text-sm font-medium border border-dashed transition ${
                isDark ? 'border-slate-600 text-slate-400 hover:border-teal-500 hover:text-teal-400' : 'border-gray-300 text-gray-400 hover:border-teal-400 hover:text-teal-600'
              }`}>
              + {t('saisieRapide') || 'Saisie rapide glycémie / injection'}

            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  ✏️ {t('saisieRapide') || 'Saisie rapide'}
                </p>
                <button onClick={() => setShowInlineAdd(false)}
                  className={`text-xs px-2 py-1 rounded-lg ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}>✕</button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={`text-[10px] block mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>🩸 Glycémie (g/L)</label>
                  <input type="number" step="0.01" min="0.3" max="6.0" placeholder="1.20" value={inlineGlyc}
                    onChange={e => setInlineGlyc(e.target.value)}
                    className={`w-full text-center text-sm p-2 rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-200'}`} />
                </div>
                <div className="flex-1">
                  <label className={`text-[10px] block mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>💉 Dose (U)</label>
                  <input type="number" step="0.5" min="0" placeholder="0" value={inlineDose}
                    onChange={e => setInlineDose(e.target.value)}
                    className={`w-full text-center text-sm p-2 rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-200'}`} />
                </div>
              </div>
              {parseFloat(inlineDose) > 0 && (
                <div className="flex gap-1">
                  {[
                    { key: 'correction', label: '🎯 Correction', },
                    { key: 'basal', label: '🕐 Basale' },
                    { key: 'manual', label: '✏️ Autre' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setInlineType(opt.key)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium border transition ${
                        inlineType === opt.key
                          ? isDark ? 'bg-teal-900/30 border-teal-600 text-teal-400' : 'bg-teal-50 border-teal-300 text-teal-700'
                          : isDark ? 'border-slate-600 text-slate-500' : 'border-gray-200 text-gray-400'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={saveInlineEntry}
                className="w-full py-2 rounded-xl text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 transition">
                {t('enregistrer') || 'Enregistrer'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {dayEntries.length === 0 ? (
        <div className={`${cardClass} text-center py-6`}>
          <p className="text-4xl mb-3">📋</p>
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>{t('pasDeRepasAujourdhui')}</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('ajouterPremierRepas')}</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className={`absolute left-6 top-0 bottom-0 w-0.5 ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />

          {entriesWithIOB.map((entry, idx) => {
            const type = getEventType(entry);
            const config = eventConfig[type];
            const glycPre = parseFloat(entry.glycPre);
            const glycPost = parseFloat(entry.glycPost);

            return (
              <div key={entry.id} className="relative flex gap-4 pb-2">
                {/* Time + icon node */}
                <div className="flex flex-col items-center z-10 shrink-0 w-12">
                  <p className={`text-[10px] font-medium mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {formatTime(entry.date)}
                  </p>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isDark ? 'border-slate-800' : 'border-white'}`}
                    style={{ backgroundColor: config.color + '20', borderColor: config.color }}>
                    {type === 'insulin' ? getInjectionIcon(entry) : config.icon}
                  </div>
                </div>

                {/* Content card */}
                <div className={`flex-1 rounded-2xl p-2 border ${isDark ? config.bgDark : config.bgLight}`}>
                  {/* Meal event */}
                  {type === 'meal' && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {entry.aliments
                            ? Array.isArray(entry.aliments)
                              ? entry.aliments.slice(0, 3).map(a => a.name || a).join(', ')
                              : entry.aliments.split(',').slice(0, 3).join(', ')
                            : 'Repas'}
                          {entry.aliments && (Array.isArray(entry.aliments) ? entry.aliments.length : entry.aliments.split(',').length) > 3 && '...'}
                        </p>
                        <div className="flex items-center">
                          {entry.activitePhysique && entry.activitePhysique !== 'aucune' && (
                            <span className="text-xs ml-2">
                              {entry.activitePhysique === 'legere' ? '🚶‍♀️' :
                               entry.activitePhysique === 'moderee' ? '🏃' :
                               entry.activitePhysique === 'intense' ? '🏋️' : ''}
                            </span>
                          )}
                          {entry.alertes && entry.alertes.length > 0 && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold ml-1">
                              {entry.alertes.length}
                            </span>
                          )}
                          <span className="text-xs font-bold text-emerald-600 ml-2">{entry.totalCarbs || entry.totalGlucides || 0}g</span>
                        </div>
                      </div>
                      {/* Glycemia pre */}
                      {!isNaN(glycPre) && glycPre > 0 && (
                        <p className="text-xs mb-1" style={{ color: glycColor(glycPre) }}>
                          🩸 Glyc. pré : {glycPre.toFixed(2)} g/L
                          {entry.tendance && entry.tendance !== '?' && (
                            <span className="ml-1 text-sm">{entry.tendance}</span>
                          )}
                        </p>
                      )}
                      {/* Dose — with suggested vs actual comparison */}
                      {(() => {
                        const dose = entry.doseActual || entry.doseReelle || 0;
                        const suggeree = entry.doseSuggeree || entry.doseSuggested || 0;
                        if (dose <= 0 && suggeree <= 0) return null;
                        return (
                          <div className="flex items-center gap-2 mb-1">
                            {editingDose === entry.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-blue-500">💉</span>
                                <input type="number" step="0.5" min="0" value={doseValue}
                                  onChange={e => setDoseValue(e.target.value)} autoFocus
                                  className={`w-16 text-center text-sm p-1 rounded-lg border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200'}`} />
                                <span className="text-xs text-gray-400">U</span>
                                <button onClick={() => saveDose(entry.id)}
                                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded-lg">✓</button>
                                <button onClick={() => setEditingDose(null)}
                                  className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-lg">✕</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {suggeree > 0 && dose > 0 && suggeree !== dose ? (
                                  <button onClick={() => { setEditingDose(entry.id); setDoseValue(String(dose)); }}
                                    className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                                    💉 <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{t('doseSuggeree') || 'Suggérée'}: {suggeree}U</span>
                                    <span className="mx-0.5">→</span>
                                    <span className="font-bold">{t('reelle') || 'Réelle'}: {dose}U</span>
                                    {dose > suggeree && <span className="text-amber-500 text-[10px]">+{(dose - suggeree).toFixed(1)}</span>}
                                    {dose < suggeree && <span className="text-green-500 text-[10px]">{(dose - suggeree).toFixed(1)}</span>}
                                  </button>
                                ) : (
                                  <button onClick={() => { setEditingDose(entry.id); setDoseValue(String(dose || suggeree)); }}
                                    className="text-xs text-blue-500 hover:underline">
                                    💉 <span className="font-bold">{dose || suggeree}U</span>
                                    {entry.bolusType === 'etendu' &&
                                      <span className="ml-1 text-indigo-500">(étendu 3 phases)</span>
                                    }
                                    {(entry.bolusType === 'dual' || entry.bolusType === 'fractionne') &&
                                      <span className="ml-1 text-amber-500">(fractionné)</span>
                                    }
                                  </button>
                                )}
                                <button onClick={() => { setEditingDose(entry.id); setDoseValue(String(dose || suggeree)); }}
                                  className={`ml-1 w-6 h-6 rounded-md flex items-center justify-center text-sm transition ${isDark ? 'text-slate-500 hover:text-blue-400 hover:bg-slate-700' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                                  title={t('modifierDose') || 'Modifier la dose'}>
                                  ✏️
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {/* Extended 3-phase injection plan */}
                      {entry.bolusType === 'etendu' && entry.splitPhases && (
                        <div className={`mt-2 space-y-1.5 pl-2 border-l-2 ${isDark ? 'border-indigo-700' : 'border-indigo-200'}`}>
                          {entry.splitPhases.map((phase, pi) => {
                            const phaseTime = new Date(new Date(entry.date).getTime() + phase.delayMinutes * 60000);
                            const timeStr = phaseTime.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
                            return (
                              <div key={pi} className="flex items-center gap-2">
                                <span className="text-sm">{phase.done ? '✅' : '⬜'}</span>
                                <button
                                  onClick={() => {
                                    setJournal(prev => prev.map(e => {
                                      if (e.id !== entry.id) return e;
                                      const phases = [...e.splitPhases];
                                      phases[pi] = { ...phases[pi], done: !phases[pi].done };
                                      return { ...e, splitPhases: phases };
                                    }));
                                  }}
                                  className={`text-xs ${phase.done
                                    ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                                    : (isDark ? 'text-indigo-300' : 'text-indigo-600')
                                  }`}
                                >
                                  {phase.units}u — {phase.label} ({timeStr})
                                  {!phase.done && <span className="ml-1 opacity-60">(tap)</span>}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Split injection steps for fractionné (2-phase) */}
                      {entry.bolusType === 'fractionne' && entry.splitImmediate != null && (
                        <div className={`mt-2 space-y-1.5 pl-2 border-l-2 ${isDark ? 'border-teal-700' : 'border-teal-200'}`}>
                          {/* Step 1: Immediate - always "done" since it's saved */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm">✅</span>
                            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              {entry.splitImmediate}u — {entry.heure || new Date(entry.date).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}
                            </p>
                          </div>
                          {/* Step 2: Delayed */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{entry.splitDone2 ? '✅' : '⬜'}</span>
                            <button
                              onClick={() => {
                                setJournal(prev => prev.map(e =>
                                  e.id === entry.id ? { ...e, splitDone2: !e.splitDone2 } : e
                                ));
                              }}
                              className={`text-xs ${entry.splitDone2
                                ? (isDark ? 'text-teal-400' : 'text-teal-600')
                                : (isDark ? 'text-purple-300' : 'text-purple-600')
                              }`}
                            >
                              {entry.splitDelayed}u — +{entry.splitDelayMinutes}min
                              {!entry.splitDone2 && (
                                <span className="ml-1 opacity-60">(tap pour marquer fait)</span>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                      {/* IOB */}
                      {entry.iob > 0 && (
                        <p className="text-[10px] text-blue-400 mb-1">IOB: {entry.iob.toFixed(1)}U restant</p>
                      )}
                      {/* Post-meal glycemia */}
                      {glycPost > 0 ? (
                        <>
                          <p className="text-xs mt-1" style={{ color: glycColor(glycPost) }}>
                            🩸 post : {glycPost.toFixed(2)} g/L
                            {!isNaN(glycPre) && glycPre > 0 && (
                              <span className={`ml-2 ${glycPost > glycPre ? 'text-red-400' : 'text-green-500'}`}>
                                ({glycPost > glycPre ? '+' : ''}{(glycPost - glycPre).toFixed(2)})
                              </span>
                            )}
                          </p>
                          {glycPre > 0 && (() => {
                            const feedback = evaluatePostPrandial(glycPre, glycPost, 1.00, 1.80);
                            if (!feedback) return null;
                            const feedbackColors = {
                              good: isDark ? 'text-green-400 bg-green-900/20' : 'text-green-600 bg-green-50',
                              under: isDark ? 'text-orange-400 bg-orange-900/20' : 'text-orange-600 bg-orange-50',
                              over: isDark ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-50',
                            };
                            return (
                              <div className={`mt-1 px-2 py-1 rounded-lg text-[10px] ${feedbackColors[feedback.verdict]}`}>
                                <span className="font-medium">{feedback.message}</span>
                                {feedback.ratioSuggestion && (
                                  <p className="opacity-70 mt-0.5">{feedback.ratioSuggestion}</p>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <div className="mt-2">
                          {editingPost === entry.id ? (
                            <div className="flex items-center gap-2">
                              <input type="number" step="0.01" placeholder="1.20" value={postValue}
                                onChange={e => setPostValue(e.target.value)} autoFocus
                                className={`w-20 text-center text-sm p-1 rounded-lg border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200'}`} />
                              <button onClick={() => savePostGlyc(entry.id)}
                                className="text-xs px-2 py-1 bg-emerald-500 text-white rounded-lg">✓</button>
                              <button onClick={() => setEditingPost(null)}
                                className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-lg">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => setEditingPost(entry.id)}
                              className={`text-[11px] px-3 py-1.5 rounded-lg border border-dashed ${
                                isDark ? 'border-slate-600 text-slate-500 hover:text-slate-300' : 'border-gray-300 text-gray-400 hover:text-gray-600'
                              }`}>
                              + {t('saisirGlycPost') || 'Glycémie post-repas'}
                            </button>
                          )}
                        </div>
                      )}
                      {/* Notes */}
                      {entry.notes && (
                        <p className={`text-[10px] mt-1 italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          📝 {entry.notes}
                        </p>
                      )}
                      {/* Legacy schedule display */}
                      {entry.schedule && entry.schedule.length > 0 ? (
                        <div className="mt-2">
                          <button onClick={() => setExpandedSchedule(expandedSchedule === entry.id ? null : entry.id)}
                            className={`text-[10px] font-medium flex items-center gap-1 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                            📅 {t('voirPlanning') || 'Planning'} ({entry.schedule.length} {t('etapes') || 'étapes'})
                            <span className={`transition-transform ${expandedSchedule === entry.id ? 'rotate-180' : ''}`}>▾</span>
                          </button>
                          {expandedSchedule === entry.id && (
                            <div className={`mt-1.5 space-y-1 pl-2 border-l-2 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                              {entry.schedule.map((step, si) => {
                                const mealTime = new Date(entry.date).getTime();
                                const controlTime = mealTime + step.timeMin * 60000;
                                const now2 = Date.now();
                                const isPast = now2 > controlTime;
                                const isSoon = !isPast && (controlTime - now2) < 30 * 60000;
                                const timeLabel = new Date(controlTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                                return (
                                  <div key={si} className={`text-[10px] px-2 py-1.5 rounded-lg flex items-center gap-2 ${
                                    isSoon ? (isDark ? 'bg-amber-900/30 text-amber-400 border border-amber-700' : 'bg-amber-50 border border-amber-200 text-amber-700')
                                    : isPast ? (isDark ? 'bg-slate-800 text-slate-600' : 'bg-gray-50 text-gray-400')
                                    : step.units != null ? (isDark ? 'bg-blue-900/20 text-blue-400 border border-blue-800/30' : 'bg-blue-50 text-blue-600 border border-blue-100')
                                    : (isDark ? 'bg-purple-900/20 text-purple-400 border border-purple-800/30' : 'bg-purple-50/50 text-purple-500 border border-purple-100')
                                  }`}>
                                    <span>{step.icon}</span>
                                    <span className="font-medium">{timeLabel}</span>
                                    <span className="flex-1">{step.label}</span>
                                    {step.units != null && <span className="font-bold">{step.units}U</span>}
                                    {isSoon && <span className="font-bold animate-pulse">→ {t('mesurerMaintenant') || 'Maintenant'}</span>}
                                    {isPast && <span>✓</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}

                  {/* Glycemia-only event */}
                  {type === 'glycemia' && !isNaN(glycPre) && (
                    <div className="flex items-center justify-between">
                      <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('glycemie') || 'Mesure glycémie'}</p>
                      <p className="text-lg font-bold" style={{ color: glycColor(glycPre) }}>{glycPre.toFixed(2)} g/L</p>
                    </div>
                  )}

                  {/* Insulin-only event — enhanced */}
                  {type === 'insulin' && (
                    <div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {getInjectionIcon(entry)} {getInjectionLabel(entry)}
                          </p>
                          {entry.injectionType === 'correction' && entry.correctionDetails && (
                            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {t('glycemie')}: {parseFloat(entry.correctionDetails.glycemia).toFixed(2)} g/L → {t('votreCible') || 'Cible'}: {entry.correctionDetails.target?.toFixed(2)} g/L
                              {entry.correctionDetails.iob > 0 && ` · IOB: ${entry.correctionDetails.iob.toFixed(1)}U`}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {editingDose === entry.id ? (
                            <div className="flex items-center gap-1">
                              <input type="number" step="0.5" min="0" value={doseValue}
                                onChange={e => setDoseValue(e.target.value)} autoFocus
                                className={`w-16 text-center text-sm p-1 rounded-lg border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200'}`} />
                              <button onClick={() => saveDose(entry.id)}
                                className="text-xs px-1.5 py-1 bg-blue-500 text-white rounded-lg">✓</button>
                              <button onClick={() => setEditingDose(null)}
                                className="text-xs px-1.5 py-1 bg-gray-200 text-gray-600 rounded-lg">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingDose(entry.id); setDoseValue(String(entry.doseActual || entry.doseReelle || 0)); }}
                              className="text-right flex items-center gap-1">
                              <p className="text-lg font-bold text-blue-500">{entry.doseActual || entry.doseReelle || 0}U</p>
                              <span className={`w-7 h-7 rounded-md flex items-center justify-center text-sm transition ${isDark ? 'text-slate-500 hover:text-blue-400 hover:bg-slate-700' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                                title={t('modifierDose') || 'Modifier la dose'}>✏️</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {/* IOB for injection */}
                      {entry.iob > 0 && (
                        <div className="mt-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-blue-400">IOB: {entry.iob.toFixed(1)}U</p>
                            <div className="flex-1 h-1 rounded-full bg-blue-200/30 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-400 transition-all"
                                style={{ width: `${Math.min(100, (entry.iob / entry.doseActual) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="h-20" />

      {/* Manual injection modal */}
      {showManualInjection && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={() => setShowManualInjection(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className={`relative w-full max-w-md rounded-t-3xl p-5 pb-8 space-y-4 z-50 ${isDark ? 'bg-slate-800' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                💉 {t('ajouterInjection') || 'Ajouter une injection'}
              </p>
              <button onClick={() => setShowManualInjection(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>✕</button>
            </div>

            {/* Dose input */}
            <div>
              <label className={`text-xs block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dose') || 'Dose'} (U)</label>
              <input type="number" step="0.5" min="0" placeholder="0" value={manualDose}
                onChange={e => setManualDose(e.target.value)} autoFocus
                className={`w-full text-center text-lg p-3 rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-200'}`} />
            </div>

            {/* Type selector */}
            <div className="flex gap-2">
              {[
                { key: 'correction', label: `🎯 ${t('correctionLabel') || 'Correction'}` },
                { key: 'manual', label: `✏️ ${t('manualLabel') || 'Autre'}` },
              ].map(opt => (
                <button key={opt.key} onClick={() => setManualType(opt.key)}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition ${
                    manualType === opt.key
                      ? isDark ? 'bg-teal-900/30 border-teal-600 text-teal-400' : 'bg-teal-50 border-teal-300 text-teal-700'
                      : isDark ? 'border-slate-600 text-slate-500' : 'border-gray-200 text-gray-400'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Submit */}
            <button onClick={() => {
              const d = parseFloat(manualDose);
              if (isNaN(d) || d <= 0) return;
              const newEntry = {
                id: `manual-${Date.now()}`,
                date: new Date().toISOString(),
                mealType: 'injection',
                injectionType: manualType,
                doseReelle: d,
                doseActual: d,
                doseSuggeree: 0,
                notes: '',
              };
              setJournal(prev => [...prev, newEntry]);
              setManualDose('');
              setManualType('correction');
              setShowManualInjection(false);
            }}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-teal-500 hover:bg-teal-600 transition shadow-lg">
              {t('enregistrer') || 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      {isToday && !showManualInjection && (
        <button onClick={() => setShowManualInjection(true)}
          className="fixed bottom-20 right-4 w-12 h-12 rounded-full bg-teal-500 text-white text-2xl shadow-lg flex items-center justify-center z-30 hover:bg-teal-600 active:scale-95 transition-transform">
          +
        </button>
      )}
    </div>
  );
}
