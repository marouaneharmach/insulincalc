import { useState, useMemo } from 'react';
import { calcIOB } from '../domain/insulin/iob';
import { DEFAULT_RAPID_PROFILE } from '../domain/insulin/profiles';
import { evaluatePostPrandial } from '../domain/engine/clinicalEngine';
import { computeDailySummary } from '../domain/analytics/daily';
import { computeGlycemicMetrics } from '../domain/analytics/metrics';
import { getSplitPlanTotal, scaleDosePlan } from '../domain/engine/dosePlan';
import { getActualDose, getSuggestedDose, getGlucosePre, getGlucosePost, getCarbs, entryKind, readingsFromJournal } from '../domain/journal';
import { addDays, formatDate, formatTime, localDateKey, toLocalISO } from '../domain/time';
import { newId } from '../domain/ids';
import { normalizeGlucose } from '../domain/units';
import GlycEvolutionChart from './GlycEvolutionChart';
import { alertText } from './alertText';
import { useNow } from '../hooks/useNow';

function glycColor(v) {
  if (!v || isNaN(v)) return '#64748B';
  if (v < 0.7) return '#DC2626';
  if (v < 1.0) return '#EA580C';
  if (v <= 1.8) return '#059669';
  if (v <= 2.5) return '#D97706';
  return '#DC2626';
}

function StatTile({ value, label, color, isDark }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold tabular-nums ${color || (isDark ? 'text-slate-100' : 'text-slate-800')}`}>{value}</p>
      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
    </div>
  );
}

const formatDose = (value) => {
  const dose = Number(value) || 0;
  return Number.isInteger(dose) ? String(dose) : dose.toFixed(1);
};

export default function DayTimeline({ journal, setJournal, targetGMin, targetGMax, t, isDark, locale = 'fr', insulinProfile = DEFAULT_RAPID_PROFILE }) {
  const now = useNow();
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(now));
  const todayKey = localDateKey(now);
  const isToday = selectedDate === todayKey;
  const isYesterday = selectedDate === addDays(todayKey, -1);

  const dayEntries = useMemo(
    () => journal.filter((e) => e.date && localDateKey(e.date) === selectedDate).sort((a, b) => new Date(a.date) - new Date(b.date)),
    [journal, selectedDate],
  );
  const cgmEntries = useMemo(() => dayEntries.filter((e) => entryKind(e) === 'cgm'), [dayEntries]);
  const listedEntries = useMemo(() => dayEntries.filter((e) => entryKind(e) !== 'cgm'), [dayEntries]);

  const entriesWithIOB = useMemo(() => {
    const nowMs = now.getTime();
    return listedEntries.map((entry) => {
      const kind = entryKind(entry);
      const dose = getActualDose(entry);
      if (dose <= 0 || kind === 'basal' || kind === 'hypo') return { ...entry, iob: 0 };
      const minutesElapsed = (nowMs - new Date(entry.date).getTime()) / 60000;
      return { ...entry, iob: calcIOB(dose, minutesElapsed, insulinProfile.diaMin, insulinProfile.peakMin) };
    });
  }, [listedEntries, insulinProfile, now]);

  const totalIOB = useMemo(() => entriesWithIOB.reduce((sum, e) => sum + (e.iob || 0), 0), [entriesWithIOB]);
  const summary = useMemo(() => computeDailySummary(journal, selectedDate, targetGMin, targetGMax), [journal, selectedDate, targetGMin, targetGMax]);
  const metrics30 = useMemo(() => computeGlycemicMetrics(readingsFromJournal(journal, { days: 30, now })), [journal, now]);

  const dateLabel = isToday ? t('aujourdhui') : isYesterday ? t('hier') : formatDate(selectedDate + 'T12:00:00', locale, { weekday: 'long', day: 'numeric', month: 'long' });

  const [editingPost, setEditingPost] = useState(null);
  const [postValue, setPostValue] = useState('');
  const [editingDose, setEditingDose] = useState(null);
  const [doseValue, setDoseValue] = useState('');
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineGlyc, setInlineGlyc] = useState('');
  const [inlineDose, setInlineDose] = useState('');
  const [inlineType, setInlineType] = useState('correction');
  const [showManualInjection, setShowManualInjection] = useState(false);
  const [manualDose, setManualDose] = useState('');
  const [manualType, setManualType] = useState('correction');

  const updateEntry = (entryId, patch) => setJournal((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...(typeof patch === 'function' ? patch(e) : patch) } : e)));

  const savePostGlyc = (entryId) => {
    const v = normalizeGlucose(postValue);
    if (v == null) return;
    updateEntry(entryId, { glycPost: v, glycPostAt: toLocalISO(new Date()) });
    setEditingPost(null);
    setPostValue('');
  };

  const saveDose = (entryId) => {
    const d = parseFloat(doseValue);
    if (isNaN(d) || d < 0) return;
    updateEntry(entryId, (e) => {
      const scaledPlan = scaleDosePlan(e, getSplitPlanTotal(e), d);
      return { doseActual: d, doseReelle: d, bolusType: scaledPlan.bolusType, splitImmediate: scaledPlan.splitImmediate, splitDelayed: scaledPlan.splitDelayed, splitDelayMinutes: scaledPlan.splitDelayMinutes, splitPhases: scaledPlan.splitPhases };
    });
    setEditingDose(null);
    setDoseValue('');
  };

  const saveInlineEntry = () => {
    const glycVal = normalizeGlucose(inlineGlyc);
    const doseVal = parseFloat(inlineDose);
    const hasGlyc = glycVal != null && glycVal >= 0.3 && glycVal <= 6.0;
    const hasDose = !isNaN(doseVal) && doseVal > 0;
    if (!hasGlyc && !hasDose) return;
    const date = toLocalISO(new Date());
    const additions = [];
    if (hasGlyc) additions.push({ id: newId(), schemaVersion: 7, source: 'manual', date, glycPre: glycVal, glycPost: null, totalGlucides: 0, doseSuggeree: 0, doseActual: 0, doseReelle: 0, mealType: 'mesure' });
    if (hasDose) additions.push({ id: newId(), schemaVersion: 7, source: 'manual', date, glycPre: hasGlyc ? glycVal : null, totalGlucides: 0, doseSuggeree: 0, doseActual: doseVal, doseReelle: doseVal, mealType: inlineType === 'basal' ? 'basal' : 'injection', injectionType: inlineType });
    setJournal((prev) => [...additions, ...prev]);
    setInlineGlyc(''); setInlineDose(''); setShowInlineAdd(false);
  };

  const saveManualInjection = () => {
    const d = parseFloat(manualDose);
    if (isNaN(d) || d <= 0) return;
    setJournal((prev) => [{ id: newId(), schemaVersion: 7, source: 'manual', date: toLocalISO(new Date()), mealType: manualType === 'basal' ? 'basal' : 'injection', injectionType: manualType, doseReelle: d, doseActual: d, doseSuggeree: 0, notes: '' }, ...prev]);
    setManualDose(''); setManualType('correction'); setShowManualInjection(false);
  };

  const deleteEntry = (entryId) => setJournal((prev) => prev.filter((e) => e.id !== entryId));

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const subtle = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputClass = `text-center text-sm p-2 rounded-xl border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-200'}`;
  const eventConfig = {
    glucose: { icon: '🩸', color: '#DB2777', bgLight: 'bg-pink-50 border-pink-200', bgDark: 'bg-pink-900/20 border-pink-800/30' },
    meal: { icon: '🍽', color: '#059669', bgLight: 'bg-emerald-50 border-emerald-200', bgDark: 'bg-emerald-900/20 border-emerald-800/30' },
    injection: { icon: '💉', color: '#2563EB', bgLight: 'bg-blue-50 border-blue-200', bgDark: 'bg-blue-900/20 border-blue-800/30' },
    basal: { icon: '🕐', color: '#7C3AED', bgLight: 'bg-violet-50 border-violet-200', bgDark: 'bg-violet-900/20 border-violet-800/30' },
    hypo: { icon: '🍬', color: '#DC2626', bgLight: 'bg-red-50 border-red-200', bgDark: 'bg-red-900/20 border-red-800/30' },
    cgm: { icon: '📡', color: '#0891B2', bgLight: 'bg-cyan-50 border-cyan-200', bgDark: 'bg-cyan-900/20 border-cyan-800/30' },
  };
  const injectionLabel = (entry) => entry.injectionType === 'correction' ? (t('correctionLabel') || 'Correction')
    : entry.injectionType === 'basal' ? (t('basalLabel') || 'Basale')
      : entry.injectionType === 'manual' ? (t('manualLabel') || 'Injection manuelle') : (t('ajouterInsuline') || 'Injection');

  return (
    <div className="px-4 pt-2 space-y-2">
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setSelectedDate(addDays(selectedDate, -1))} aria-label={t('hier')}
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}>←</button>
          <div className="text-center">
            <h2 className={`text-lg font-bold capitalize ${isDark ? 'text-white' : 'text-slate-800'}`}>{dateLabel}</h2>
            {!isToday && <p className={`text-xs ${subtle}`}>{selectedDate}</p>}
          </div>
          <button type="button" onClick={() => setSelectedDate(addDays(selectedDate, 1))} disabled={isToday} aria-label={t('aujourdhui')}
            className={`w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-30 ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}>→</button>
        </div>
      </div>

      {totalIOB > 0 && isToday && (
        <div className={`rounded-2xl p-3 border ${isDark ? 'bg-blue-900/20 border-blue-800/30' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>💉 {t('insulineActive')}</p>
              <p className={`text-sm ${isDark ? 'text-blue-200' : 'text-blue-600'}`}>IOB {t('enCours') || 'en cours'} · {insulinProfile.name}</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold tabular-nums ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>{totalIOB.toFixed(1)}</p>
              <p className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>{t('unites')}</p>
            </div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-blue-200/30 overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, totalIOB * 20)}%` }} />
          </div>
        </div>
      )}

      {summary.injections + summary.basalDose > 0 && (
        <div className={cardClass}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${subtle}`}>📊 {t('resumeInsulineJour') || 'Résumé insuline du jour'}</p>
          <div className="grid grid-cols-3 gap-2">
            <StatTile isDark={isDark} value={`${summary.totalDose.toFixed(1)}U`} label={t('total')} color="text-blue-600" />
            <StatTile isDark={isDark} value={`${summary.mealBolus.toFixed(1)}U`} label={t('repas')} color="text-emerald-600" />
            <StatTile isDark={isDark} value={`${summary.corrections.toFixed(1)}U`} label={t('correction')} color="text-amber-600" />
          </div>
          {summary.basalDose > 0 && <p className={`text-xs mt-1 text-center ${subtle}`}>{t('basalLabel') || 'Basale'}: {summary.basalDose.toFixed(1)}U</p>}
        </div>
      )}

      {summary.glycReadings > 0 && (
        <div className={cardClass}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${subtle}`}>📊 {t('bilanJournalier') || 'Bilan journalier'}</p>
          <div className="grid grid-cols-4 gap-2">
            <StatTile isDark={isDark} value={`${summary.timeInRange}%`} label={t('tempsEnCible') || 'En cible'} color={summary.timeInRange >= 70 ? 'text-green-600' : summary.timeInRange >= 50 ? 'text-amber-600' : 'text-red-600'} />
            <StatTile isDark={isDark} value={summary.avgGlycemia?.toFixed(2)} label={t('moyenneGlycemie') || 'Moy. g/L'} />
            <StatTile isDark={isDark} value={summary.injections} label={t('nbInjections') || 'Injections'} color="text-blue-600" />
            <StatTile isDark={isDark} value={`${summary.totalCarbs}g`} label={t('totalGlucidesJour') || 'Glucides'} color="text-teal-600" />
          </div>
          {summary.minGlyc != null && (
            <div className={`flex justify-center gap-4 mt-2 text-xs ${subtle}`}>
              <span>Min: <span style={{ color: glycColor(summary.minGlyc) }}>{summary.minGlyc.toFixed(2)}</span></span>
              <span>Max: <span style={{ color: glycColor(summary.maxGlyc) }}>{summary.maxGlyc.toFixed(2)}</span></span>
              {cgmEntries.length > 0 && <span>📡 {t('cgmLectures', { n: cgmEntries.length })}</span>}
            </div>
          )}
        </div>
      )}

      {metrics30.n >= 3 && (
        <div className={cardClass}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${subtle}`}>📈 {t('stats30j') || 'Statistiques 30 jours'}</p>
          <div className={`grid ${metrics30.gmiPct != null ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
            <StatTile isDark={isDark} value={metrics30.meanGl?.toFixed(2)} label={t('moyenneGlycemie') || 'Moy. g/L'} />
            <StatTile isDark={isDark} value={`${metrics30.tirPct}%`} label={t('tempsEnCible') || 'TIR'} color={metrics30.tirPct >= 70 ? 'text-green-600' : metrics30.tirPct >= 50 ? 'text-amber-600' : 'text-red-600'} />
            <StatTile isDark={isDark} value={`${metrics30.cvPct ?? '—'}%`} label={t('coefVariation')} color={metrics30.cvPct != null && metrics30.cvPct <= 36 ? 'text-green-600' : 'text-amber-600'} />
            {metrics30.gmiPct != null && <StatTile isDark={isDark} value={`${metrics30.gmiPct}%`} label="GMI" color={metrics30.gmiPct < 7 ? 'text-green-600' : metrics30.gmiPct < 8 ? 'text-amber-600' : 'text-red-600'} />}
          </div>
          <p className={`text-xs text-center mt-1 ${subtle}`}>
            {t('lecturesEtJours', { n: metrics30.n, days: metrics30.daysWithData })}{metrics30.gmiPct != null && !metrics30.gmiReliable ? ` · ${t('gmiNonFiable')}` : ''}
          </p>
        </div>
      )}

      <GlycEvolutionChart journal={journal} targetGMin={targetGMin} targetGMax={targetGMax} isDark={isDark} t={t} locale={locale} />

      {isToday && (
        <div className={cardClass}>
          {!showInlineAdd ? (
            <button type="button" onClick={() => setShowInlineAdd(true)}
              className={`w-full py-3 rounded-xl text-sm font-medium border border-dashed transition ${isDark ? 'border-slate-600 text-slate-300 hover:border-teal-500' : 'border-gray-300 text-gray-600 hover:border-teal-500'}`}>
              + {t('saisieRapide') || 'Saisie rapide glycémie / injection'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase tracking-wider ${subtle}`}>✏️ {t('saisieRapide') || 'Saisie rapide'}</p>
                <button type="button" onClick={() => setShowInlineAdd(false)} aria-label={t('fermer')} className={`text-sm px-2 py-1 rounded-lg ${subtle}`}>✕</button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor="inline-glyc" className={`text-xs block mb-0.5 ${subtle}`}>🩸 {t('glycemieGL')}</label>
                  <input id="inline-glyc" type="number" step="0.01" min="0" inputMode="decimal" placeholder="1.20" value={inlineGlyc} onChange={(e) => setInlineGlyc(e.target.value)} className={`w-full ${inputClass}`} />
                </div>
                <div className="flex-1">
                  <label htmlFor="inline-dose" className={`text-xs block mb-0.5 ${subtle}`}>💉 {t('dose') || 'Dose'} (U)</label>
                  <input id="inline-dose" type="number" step="0.5" min="0" inputMode="decimal" placeholder="0" value={inlineDose} onChange={(e) => setInlineDose(e.target.value)} className={`w-full ${inputClass}`} />
                </div>
              </div>
              {parseFloat(inlineDose) > 0 && (
                <div role="group" aria-label={t('injection')} className="flex gap-1">
                  {[['correction', `🎯 ${t('correctionLabel') || 'Correction'}`], ['basal', `🕐 ${t('basalLabel') || 'Basale'}`], ['manual', `✏️ ${t('manualLabel') || 'Autre'}`]].map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setInlineType(key)} aria-pressed={inlineType === key}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${inlineType === key ? (isDark ? 'bg-teal-900/30 border-teal-600 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-800') : (isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600')}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={saveInlineEntry} className="w-full py-3 rounded-xl text-sm font-medium text-white bg-teal-600 hover:bg-teal-700">{t('enregistrer') || 'Enregistrer'}</button>
            </div>
          )}
        </div>
      )}

      {listedEntries.length === 0 ? (
        <div className={`${cardClass} text-center py-6`}>
          <p className="text-4xl mb-3" aria-hidden="true">📋</p>
          <p className={subtle}>{t('pasDeRepasAujourdhui')}</p>
          <p className={`text-sm mt-1 ${subtle}`}>{t('ajouterPremierRepas')}</p>
          {cgmEntries.length > 0 && <p className={`text-xs mt-2 ${subtle}`}>📡 {t('cgmLectures', { n: cgmEntries.length })}</p>}
        </div>
      ) : (
        <ol className="relative" aria-label={t('tabJournal')}>
          <div className={`absolute left-6 top-0 bottom-0 w-0.5 ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} aria-hidden="true" />
          {entriesWithIOB.map((entry) => {
            const kind = entryKind(entry);
            const config = eventConfig[kind] ?? eventConfig.glucose;
            const glycPre = getGlucosePre(entry);
            const glycPost = getGlucosePost(entry);
            const dose = getActualDose(entry);
            const suggeree = getSuggestedDose(entry);
            const planTotal = getSplitPlanTotal(entry);
            const totalToDisplay = planTotal > 0 ? planTotal : dose;
            const delta = dose > 0 && suggeree > 0 ? dose - suggeree : 0;
            const alerts = Array.isArray(entry.alertes) ? entry.alertes : [];
            const feedback = kind === 'meal' && glycPre && glycPost ? evaluatePostPrandial(glycPre, glycPost, targetGMin, targetGMax) : null;
            const feedbackColors = { good: isDark ? 'text-green-300 bg-green-900/20' : 'text-green-800 bg-green-50', under: isDark ? 'text-orange-300 bg-orange-900/20' : 'text-orange-800 bg-orange-50', over: isDark ? 'text-red-300 bg-red-900/20' : 'text-red-800 bg-red-50' };

            return (
              <li key={entry.id} className="relative flex gap-4 pb-2">
                <div className="flex flex-col items-center z-10 shrink-0 w-12">
                  <time className={`text-xs font-medium mb-1 ${subtle}`} dateTime={entry.date}>{formatTime(entry.date, locale)}</time>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isDark ? 'border-slate-800' : 'border-white'}`} style={{ backgroundColor: config.color + '20', borderColor: config.color }} aria-hidden="true">
                    {kind === 'injection' && entry.injectionType === 'correction' ? '🎯' : config.icon}
                  </div>
                </div>
                <div className={`flex-1 rounded-2xl p-2 border ${isDark ? config.bgDark : config.bgLight}`}>
                  {kind === 'meal' && (
                    <>
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {entry.photoThumbnail && <img src={entry.photoThumbnail} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />}
                          <p className={`text-sm font-medium truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                            {Array.isArray(entry.aliments) && entry.aliments.length
                              ? entry.aliments.slice(0, 3).map((a) => (a.id?.startsWith?.('ai_') || a.aiEstimated ? `${a.name || a} ✦` : (a.name || a))).join(', ') + (entry.aliments.length > 3 ? '…' : '')
                              : typeof entry.aliments === 'string' && entry.aliments ? entry.aliments.split(',').slice(0, 3).join(', ') : (entry.mealSlot ? t(`ramadan${entry.mealSlot.charAt(0).toUpperCase()}${entry.mealSlot.slice(1)}`) : t('repas'))}
                          </p>
                        </div>
                        <div className="flex items-center shrink-0">
                          {entry.activitePhysique && entry.activitePhysique !== 'aucune' && <span className="text-xs ml-2" aria-label={t('cl_activite')}>{entry.activitePhysique === 'legere' ? '🚶' : entry.activitePhysique === 'moderee' ? '🏃' : '🏋️'}</span>}
                          {entry.nightMode && <span className="text-xs ml-1" aria-label={t('modeNuitActif')}>🌑</span>}
                          {entry.illness && <span className="text-xs ml-1" aria-label={t('maladieJour')}>🤒</span>}
                          <span className="text-xs font-bold text-emerald-700 ml-2">{getCarbs(entry)}g</span>
                        </div>
                      </div>
                      {glycPre != null && (
                        <p className="text-xs mb-1 font-medium" style={{ color: glycColor(glycPre) }}>
                          🩸 {t('glycPre')} : {glycPre.toFixed(2)} g/L{entry.tendance && entry.tendance !== '?' && <span className="ml-1 text-sm">{entry.tendance}</span>}
                        </p>
                      )}
                      {(dose > 0 || suggeree > 0) && (
                        <div className="mb-2 space-y-1">
                          {editingDose === entry.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-blue-600" aria-hidden="true">💉</span>
                              <input type="number" step="0.5" min="0" value={doseValue} onChange={(e) => setDoseValue(e.target.value)} autoFocus aria-label={t('doseReelle')} className={`w-16 ${inputClass} p-1`} />
                              <span className={`text-xs ${subtle}`}>U</span>
                              <button type="button" onClick={() => saveDose(entry.id)} aria-label={t('confirmer')} className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg">✓</button>
                              <button type="button" onClick={() => setEditingDose(null)} aria-label={t('annuler')} className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-lg">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-left">
                                <p className={`text-sm font-bold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                  💉 {t('doseReellePrise') || 'Dose réellement prise'}: {formatDose(dose || suggeree)}U
                                  {entry.bolusType === 'etendu' && <span className="text-xs font-medium text-indigo-500 ml-1">(étendu)</span>}
                                  {(entry.bolusType === 'dual' || entry.bolusType === 'fractionne') && <span className="text-xs font-medium text-amber-600 ml-1">(fractionné)</span>}
                                </p>
                                {suggeree > 0 && (
                                  <p className={`text-xs ${subtle}`}>
                                    {t('doseSuggeree') || 'Dose suggérée'}: {formatDose(suggeree)}U
                                    {dose > 0 && suggeree !== dose && <span className={delta > 0 ? ' text-amber-600' : ' text-emerald-600'}> · écart {delta > 0 ? '+' : ''}{formatDose(delta)}U</span>}
                                  </p>
                                )}
                                {(entry.bolusType === 'etendu' || entry.bolusType === 'fractionne' || entry.bolusType === 'dual') && totalToDisplay > 0 && (
                                  <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('planInjection') || 'Plan d’injection'}: {formatDose(totalToDisplay)}U au total</p>
                                )}
                              </div>
                              <button type="button" onClick={() => { setEditingDose(entry.id); setDoseValue(String(dose || suggeree)); }} title={t('modifierDose') || 'Modifier la dose'} aria-label={t('modifierDose') || 'Modifier la dose'}
                                className={`w-8 h-8 rounded-md flex items-center justify-center text-sm ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-blue-50'}`}>✏️</button>
                            </div>
                          )}
                        </div>
                      )}
                      {entry.bolusType === 'etendu' && entry.splitPhases && (
                        <ul className={`mt-2 space-y-1.5 pl-2 border-l-2 ${isDark ? 'border-indigo-700' : 'border-indigo-200'}`}>
                          {entry.splitPhases.map((phase, pi) => {
                            const phaseTime = new Date(new Date(entry.date).getTime() + phase.delayMinutes * 60000);
                            const label = t(phase.label) === phase.label ? phase.label : t(phase.label);
                            return (
                              <li key={pi} className="flex items-center gap-2">
                                <span className="text-sm" aria-hidden="true">{phase.done ? '✅' : '⬜'}</span>
                                <button type="button" aria-pressed={Boolean(phase.done)}
                                  onClick={() => updateEntry(entry.id, (e) => { const phases = [...e.splitPhases]; phases[pi] = { ...phases[pi], done: !phases[pi].done }; return { splitPhases: phases }; })}
                                  className={`text-xs ${phase.done ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-indigo-300' : 'text-indigo-700')}`}>
                                  {formatDose(phase.units)}u — {label} ({formatTime(phaseTime, locale)}){!phase.done && <span className="ml-1 opacity-70">({t('marquerFait') || 'tap'})</span>}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {entry.bolusType === 'fractionne' && entry.splitImmediate != null && (
                        <ul className={`mt-2 space-y-1.5 pl-2 border-l-2 ${isDark ? 'border-teal-700' : 'border-teal-200'}`}>
                          <li className="flex items-center gap-2"><span className="text-sm" aria-hidden="true">✅</span><p className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{formatDose(entry.splitImmediate)}u — {formatTime(entry.date, locale)}</p></li>
                          <li className="flex items-center gap-2">
                            <span className="text-sm" aria-hidden="true">{entry.splitDone2 ? '✅' : '⬜'}</span>
                            <button type="button" aria-pressed={Boolean(entry.splitDone2)} onClick={() => updateEntry(entry.id, (e) => ({ splitDone2: !e.splitDone2 }))}
                              className={`text-xs ${entry.splitDone2 ? (isDark ? 'text-teal-300' : 'text-teal-700') : (isDark ? 'text-purple-300' : 'text-purple-700')}`}>
                              {formatDose(entry.splitDelayed)}u — +{entry.splitDelayMinutes}min{!entry.splitDone2 && <span className="ml-1 opacity-70">({t('marquerFait') || 'tap'})</span>}
                            </button>
                          </li>
                        </ul>
                      )}
                      {entry.iob > 0 && <p className={`text-xs mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>IOB: {entry.iob.toFixed(1)}U {t('restant')}</p>}
                      {glycPost != null ? (
                        <>
                          <p className="text-xs mt-1 font-medium" style={{ color: glycColor(glycPost) }}>
                            🩸 {t('glycPost')} : {glycPost.toFixed(2)} g/L{glycPre != null && <span className={`ml-2 ${glycPost > glycPre ? 'text-red-600' : 'text-green-700'}`}>({glycPost > glycPre ? '+' : ''}{(glycPost - glycPre).toFixed(2)})</span>}
                          </p>
                          {feedback && (
                            <div className={`mt-1 px-2 py-1 rounded-lg text-xs ${feedbackColors[feedback.verdict]}`}>
                              <span className="font-medium">{t(`PP_${feedback.verdict}`)}</span>
                              {feedback.verdict !== 'good' && <p className="opacity-80 mt-0.5">{t(`PP_suggest_${feedback.verdict}`)}</p>}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="mt-2">
                          {editingPost === entry.id ? (
                            <div className="flex items-center gap-2">
                              <input type="number" step="0.01" inputMode="decimal" placeholder="1.20" value={postValue} onChange={(e) => setPostValue(e.target.value)} autoFocus aria-label={t('saisirGlycPost')} className={`w-20 ${inputClass} p-1`} />
                              <button type="button" onClick={() => savePostGlyc(entry.id)} aria-label={t('confirmer')} className="text-xs px-2 py-1 bg-emerald-600 text-white rounded-lg">✓</button>
                              <button type="button" onClick={() => setEditingPost(null)} aria-label={t('annuler')} className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-lg">✕</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setEditingPost(entry.id)} className={`text-xs px-3 py-2 rounded-lg border border-dashed ${isDark ? 'border-slate-600 text-slate-300' : 'border-gray-300 text-gray-600'}`}>
                              + {t('saisirGlycPost') || 'Glycémie post-repas'}
                            </button>
                          )}
                        </div>
                      )}
                      {alerts.length > 0 && (
                        <details className="mt-1">
                          <summary className={`text-xs cursor-pointer ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>⚠️ {t('alertesJournal', { n: alerts.length })}</summary>
                          <ul className={`mt-1 space-y-0.5 text-xs ${subtle}`}>{alerts.map((a, i) => <li key={i}>• {alertText(a, t)}</li>)}</ul>
                        </details>
                      )}
                      {entry.notes && <p className={`text-xs mt-1 italic ${subtle}`}>📝 {entry.notes}</p>}
                    </>
                  )}

                  {kind === 'glucose' && glycPre != null && (
                    <div className="flex items-center justify-between">
                      <p className={`text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t('glycemie')}</p>
                      <p className="text-lg font-bold tabular-nums" style={{ color: glycColor(glycPre) }}>{glycPre.toFixed(2)} g/L</p>
                    </div>
                  )}

                  {kind === 'hypo' && (
                    <div>
                      <p className={`text-sm font-medium ${isDark ? 'text-red-200' : 'text-red-800'}`}>🍬 {t('hypoEvenement')}{glycPre != null && ` · ${glycPre.toFixed(2)} g/L`}</p>
                      <p className={`text-xs ${subtle}`}>{entry.hypoTreatment?.carbsG ?? getCarbs(entry)} g</p>
                    </div>
                  )}

                  {(kind === 'injection' || kind === 'basal') && (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{kind === 'basal' ? '🕐 ' + (t('basalLabel') || 'Basale') : `🎯 ${injectionLabel(entry)}`}</p>
                          {entry.injectionType === 'correction' && glycPre != null && <p className={`text-xs ${subtle}`}>{t('glycemie')}: {glycPre.toFixed(2)} g/L</p>}
                        </div>
                        <div className="text-right">
                          {editingDose === entry.id ? (
                            <div className="flex items-center gap-1">
                              <input type="number" step="0.5" min="0" value={doseValue} onChange={(e) => setDoseValue(e.target.value)} autoFocus aria-label={t('doseReelle')} className={`w-16 ${inputClass} p-1`} />
                              <button type="button" onClick={() => saveDose(entry.id)} aria-label={t('confirmer')} className="text-xs px-1.5 py-1 bg-blue-600 text-white rounded-lg">✓</button>
                              <button type="button" onClick={() => setEditingDose(null)} aria-label={t('annuler')} className="text-xs px-1.5 py-1 bg-gray-200 text-gray-700 rounded-lg">✕</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => { setEditingDose(entry.id); setDoseValue(String(dose)); }} title={t('modifierDose') || 'Modifier la dose'} aria-label={`${t('modifierDose') || 'Modifier la dose'} ${formatDose(dose)}U`} className="text-right flex items-center gap-1">
                              <span className={`text-lg font-bold tabular-nums ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{formatDose(dose)}U</span>
                              <span className="text-sm" aria-hidden="true">✏️</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {entry.iob > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <p className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>IOB: {entry.iob.toFixed(1)}U</p>
                          <div className="flex-1 h-1 rounded-full bg-blue-200/30 overflow-hidden" aria-hidden="true"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (entry.iob / Math.max(dose, 0.1)) * 100)}%` }} /></div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-1 text-right">
                    <button type="button" onClick={() => deleteEntry(entry.id)} aria-label={`${t('supprimer') || 'Supprimer'} ${formatTime(entry.date, locale)}`} className={`text-xs px-2 py-1 rounded ${isDark ? 'text-slate-400 hover:text-red-300' : 'text-gray-500 hover:text-red-600'}`}>🗑</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="h-20" />

      {showManualInjection && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={() => setShowManualInjection(false)}>
          <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label={t('ajouterInjection') || 'Ajouter une injection'} className={`relative w-full max-w-md rounded-t-3xl p-5 pb-8 space-y-4 z-50 ${isDark ? 'bg-slate-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>💉 {t('ajouterInjection') || 'Ajouter une injection'}</p>
              <button type="button" onClick={() => setShowManualInjection(false)} aria-label={t('fermer')} className={`w-9 h-9 rounded-full flex items-center justify-center ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>✕</button>
            </div>
            <div>
              <label htmlFor="manual-dose" className={`text-xs block mb-1 ${subtle}`}>{t('dose') || 'Dose'} (U)</label>
              <input id="manual-dose" type="number" step="0.5" min="0" inputMode="decimal" placeholder="0" value={manualDose} onChange={(e) => setManualDose(e.target.value)} autoFocus className={`w-full text-lg p-3 ${inputClass}`} />
            </div>
            <div role="group" aria-label={t('injection')} className="flex gap-2">
              {[['correction', `🎯 ${t('correctionLabel') || 'Correction'}`], ['basal', `🕐 ${t('basalLabel') || 'Basale'}`], ['manual', `✏️ ${t('manualLabel') || 'Autre'}`]].map(([key, label]) => (
                <button key={key} type="button" onClick={() => setManualType(key)} aria-pressed={manualType === key}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition ${manualType === key ? (isDark ? 'bg-teal-900/30 border-teal-600 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-800') : (isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600')}`}>{label}</button>
              ))}
            </div>
            <button type="button" onClick={saveManualInjection} className="w-full py-3 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg">{t('enregistrer') || 'Enregistrer'}</button>
          </div>
        </div>
      )}

      {isToday && !showManualInjection && (
        <button type="button" onClick={() => setShowManualInjection(true)} aria-label={t('ajouterInjection') || 'Ajouter une injection'}
          className="fixed bottom-20 right-4 w-12 h-12 rounded-full bg-teal-600 text-white text-2xl shadow-lg flex items-center justify-center z-30 hover:bg-teal-700 active:scale-95 transition-transform">+</button>
      )}
    </div>
  );
}
