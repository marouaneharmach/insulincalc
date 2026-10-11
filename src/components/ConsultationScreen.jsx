import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import GlycemiaInput from './GlycemiaInput';
import MealInput from './MealInput';
import ContextInput from './ContextInput';
import ClinicalResponse from './ClinicalResponse';
import OverdoseDialog from './OverdoseDialog';
import { analyzeAndRecommend } from '../domain/engine/clinicalEngine';
import { scaleDosePlan } from '../domain/engine/dosePlan';
import { velocityFromReadings } from '../domain/engine/velocity';
import { calcHypoRisk } from '../domain/engine/hypoRisk';
import { iobFromJournal, minutesSinceLastBolus } from '../domain/insulin/iob';
import { getActiveProfile } from '../domain/timeProfiles';
import { readingsFromJournal, isCorrectionOnly, getActualDose, entryKind, entryDate } from '../domain/journal';
import { dailyTotals } from '../domain/analytics/treatmentAnalyzer';
import { estimateTDD } from '../domain/anthropometry';
import { combineDateAndTime, isNightHour, localDateKey, minutesBetween, timeKey, formatTime } from '../domain/time';
import { round05 } from '../domain/units';
import { useNow } from '../hooks/useNow';

// Grammes de lipides approximatifs par portion selon le niveau qualitatif
const FAT_GRAMS_APPROX = { aucun: 0, faible: 3, moyen: 10, 'élevé': 20 };
const RISK_STYLE = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  high: 'bg-red-100 text-red-800 border-red-300',
  critical: 'bg-red-200 text-red-900 border-red-400',
};

export default function ConsultationScreen({
  glycemia, setGlycemia, ratio, isf, targetGMin, targetGMax,
  postKeto, slowDigestion, insulinProfile, weight, maxDoseU, night, fasting, basalDose,
  journal, selections, foods, customFoods, toggleFood, updateMult,
  timeProfiles, onSaveToJournal, onLogHypo, onLogBasal, onPhotoMeal, onSaveCustomFood, setTab,
  t, isRTL, isDark, locale = 'fr',
}) {
  const now = useNow();
  const [trend, setTrend] = useState('?');
  const [hour, setHour] = useState(() => timeKey(new Date()));
  const [activity, setActivity] = useState('aucune');
  const [illness, setIllness] = useState(false);
  const [mealSlot, setMealSlot] = useState('other');
  const [fatLevel, setFatLevel] = useState('aucun');
  const [manualCarbs, setManualCarbs] = useState(0);
  const [result, setResult] = useState(null);
  const [actualDose, setActualDose] = useState('');
  const [notes, setNotes] = useState('');
  const [showOverdose, setShowOverdose] = useState(false);
  const [hypoLogged, setHypoLogged] = useState(false);
  const resultRef = useRef(null);
  const prevResultRef = useRef(null);

  useEffect(() => {
    if (result && result !== prevResultRef.current && resultRef.current) {
      resultRef.current.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
    prevResultRef.current = result;
  }, [result]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (result?.recommendation?.dose != null) setActualDose(String(result.recommendation.dose));
  }, [result?.recommendation?.dose]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const allFoodsList = useMemo(() => [...foods, ...(customFoods || [])], [foods, customFoods]);

  const totalCarbs = useMemo(() => {
    const fromSelections = Object.entries(selections).reduce((sum, [id, sel]) => {
      const food = allFoodsList.find((f) => f.id === id);
      return sum + (food ? food.carbs * (sel.mult || 1) : 0);
    }, 0);
    return manualCarbs > 0 ? Number(manualCarbs) : Math.round(fromSelections);
  }, [manualCarbs, selections, allFoodsList]);

  const totalFatGrams = useMemo(() => {
    const grams = Object.entries(selections).reduce((sum, [id, sel]) => {
      const food = allFoodsList.find((f) => f.id === id);
      if (!food) return sum;
      const g = typeof food.fatG === 'number' ? food.fatG : (FAT_GRAMS_APPROX[food.fat] ?? 0);
      return sum + g * (sel.mult || 1);
    }, 0);
    return Math.round(grams);
  }, [selections, allFoodsList]);

  const autoFatLevel = useMemo(() => {
    if (totalFatGrams <= 5) return 'aucun';
    if (totalFatGrams <= 15) return 'faible';
    if (totalFatGrams <= 30) return 'moyen';
    return 'élevé';
  }, [totalFatGrams]);

  // ─── Contexte clinique dérivé du journal (rafraîchi avec `now`) ───────────
  const iobTotal = useMemo(() => iobFromJournal(journal, now, insulinProfile), [journal, now, insulinProfile]);
  const lastInjectionMinutesAgo = useMemo(() => minutesSinceLastBolus(journal, now), [journal, now]);
  const readings = useMemo(() => readingsFromJournal(journal, { days: 3, now }), [journal, now]);
  const lastReading = readings.length ? readings[readings.length - 1] : null;
  const hypoIn24h = useMemo(() => readings.some((r) => r.value < 0.7 && minutesBetween(r.at, now) <= 1440), [readings, now]);
  const cumulCorrections24h = useMemo(
    () => journal.filter((e) => isCorrectionOnly(e) && minutesBetween(entryDate(e), now) <= 1440 && minutesBetween(entryDate(e), now) >= 0)
      .reduce((s, e) => s + getActualDose(e), 0),
    [journal, now],
  );
  const tddEstimate = useMemo(() => {
    const totals = dailyTotals(journal.filter((e) => minutesBetween(entryDate(e), now) <= 7 * 1440 && minutesBetween(entryDate(e), now) >= 0));
    const values = Array.from(totals.values()).filter((v) => v > 0);
    if (values.length >= 3) return values.reduce((a, b) => a + b, 0) / values.length;
    return estimateTDD(weight) ?? null;
  }, [journal, now, weight]);
  const basalTakenToday = useMemo(() => journal.some((e) => entryKind(e) === 'basal' && localDateKey(e.date) === localDateKey(now)), [journal, now]);

  const activeParams = useMemo(() => {
    const h = parseInt(hour.split(':')[0], 10);
    const profile = getActiveProfile(timeProfiles, ratio, isf, Number.isInteger(h) ? h : undefined);
    return { ratio: profile.ratio, isf: profile.isf, slot: profile.slot };
  }, [hour, timeProfiles, ratio, isf]);

  const selectionsArray = useMemo(() => Object.entries(selections || {}).map(([id, sel]) => {
    const food = allFoodsList.find((f) => f.id === id);
    return food ? { food, mult: sel.mult || 1 } : null;
  }).filter(Boolean), [selections, allFoodsList]);

  const gVal = parseFloat(glycemia);
  const entryTime = useMemo(() => combineDateAndTime(now, hour), [now, hour]);
  const velocityEstimate = useMemo(
    () => (Number.isFinite(gVal) && gVal > 0 ? velocityFromReadings(readings, { value: gVal, at: entryTime }) : null),
    [readings, gVal, entryTime],
  );
  const hourNumber = entryTime.getHours();
  const nightActive = Boolean(night?.enabled) && isNightHour(hourNumber, night?.start ?? 21, night?.end ?? 6);
  const maxDoseEff = maxDoseU && maxDoseU > 0 ? maxDoseU : weight ? round05(weight * 0.3) : null;

  const quickRisk = useMemo(() => {
    const g = Number.isFinite(gVal) && gVal > 0 ? gVal : lastReading?.value;
    if (g == null) return null;
    return calcHypoRisk({
      glycemia: g, iobTotal, velocityClass: velocityEstimate?.cls ?? 'unknown', hypoIn24h, activity,
      hour: now.getHours(), nightStart: night?.start, nightEnd: night?.end,
    });
  }, [gVal, lastReading, iobTotal, velocityEstimate, hypoIn24h, activity, now, night]);

  const handleAnalyze = () => {
    if (isNaN(gVal) || gVal <= 0) return;
    setHypoLogged(false);
    const r = analyzeAndRecommend({
      glycemia: gVal, trend, velocity: velocityEstimate?.velocity ?? null,
      totalCarbs, fatLevel: manualCarbs > 0 ? fatLevel : autoFatLevel,
      totalFatGrams: manualCarbs > 0 ? null : totalFatGrams,
      activity, ratio: activeParams.ratio, isfMgdl: activeParams.isf,
      targetMin: targetGMin, targetMax: targetGMax,
      iobTotal, lastInjectionMinutesAgo, slowDigestion, postKeto, illness,
      hour: hourNumber, night, cumulCorrections24h, tddEstimate, hypoIn24h, maxDoseU: maxDoseEff,
      fasting: fasting?.enabled ? { enabled: true, mealSlot, suhoorFactor: fasting.suhoorFactor } : null,
      insulinProfile,
    });
    setResult(r);
  };

  const doSave = useCallback(() => {
    if (!result) return;
    const splitResult = result.recommendation.split;
    const doseSug = result.recommendation.dose;
    const doseReel = !isNaN(parseFloat(actualDose)) ? parseFloat(actualDose) : doseSug;
    const scaledPlan = scaleDosePlan({
      bolusType: splitResult.type,
      splitImmediate: splitResult.immediate,
      splitDelayed: splitResult.delayed,
      splitDelayMinutes: splitResult.delayMinutes,
      splitPhases: splitResult.phases?.map((phase) => ({ ...phase, done: phase.delayMinutes === 0 })) ?? null,
    }, doseSug, doseReel);
    const alerts = [...result.vigilance.risks, ...result.vigilance.warnings, ...result.vigilance.infos]
      .map((a) => ({ type: a.type, code: a.code, params: a.params, severity: a.severity }));
    onSaveToJournal({
      glycPre: gVal, tendance: result.analysis.trend, velocity: result.analysis.velocity, heure: hour,
      mealType: fasting?.enabled && mealSlot !== 'other' ? 'repas' : (totalCarbs > 0 ? 'repas' : 'injection'),
      mealSlot: fasting?.enabled && mealSlot !== 'other' ? mealSlot : null,
      injectionType: totalCarbs > 0 ? 'bolus' : 'correction',
      totalGlucides: totalCarbs, niveauGras: manualCarbs > 0 ? fatLevel : autoFatLevel, totalLipides: totalFatGrams,
      aliments: selectionsArray.length ? selectionsArray.map(({ food, mult }) => ({ id: food.id, name: food.name, carbs: food.carbs, qty: mult, fat: food.fat, gi: food.gi })) : null,
      iobAuMoment: Math.round(iobTotal * 10) / 10,
      doseSuggeree: doseSug, doseReelle: doseReel, doseActual: doseReel,
      bolusType: scaledPlan.bolusType, splitImmediate: scaledPlan.splitImmediate, splitDelayed: scaledPlan.splitDelayed,
      splitDelayMinutes: scaledPlan.splitDelayMinutes, splitPhases: scaledPlan.splitPhases,
      activitePhysique: activity, alertes: alerts, notes: notes.trim(),
      hypoRiskScore: result.analysis.hypoRisk?.score ?? null, nightMode: result.analysis.nightMode,
      fasting: Boolean(fasting?.enabled), illness,
    });
    setResult(null); setTrend('?'); setActivity('aucune'); setFatLevel('aucun'); setManualCarbs(0); setActualDose(''); setNotes(''); setIllness(false);
    setShowOverdose(false);
    if (setTab) setTab('journal');
  }, [result, actualDose, onSaveToJournal, gVal, hour, fasting, mealSlot, totalCarbs, manualCarbs, fatLevel, autoFatLevel, totalFatGrams, selectionsArray, iobTotal, activity, notes, illness, setTab]);

  const handleSave = () => {
    if (!result) return;
    const doseReel = !isNaN(parseFloat(actualDose)) ? parseFloat(actualDose) : result.recommendation.dose;
    if (maxDoseEff && doseReel > maxDoseEff) {
      setShowOverdose(true);
      return;
    }
    doSave();
  };

  const handleLogHypo = () => {
    onLogHypo?.({ glycemia: gVal, carbsG: 15, heure: hour });
    setHypoLogged(true);
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const subtle = isDark ? 'text-slate-400' : 'text-slate-500';
  const isHypoNow = Number.isFinite(gVal) && gVal > 0 && gVal < 0.7;

  return (
    <div className="space-y-4 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Résumé du jour */}
      <section className={cardClass} aria-label={t('aujourdhuiResume')}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[8rem]">
            <p className={`text-xs uppercase tracking-wider font-semibold ${subtle}`}>{t('derniereGlycemie')}</p>
            {lastReading ? (
              <p className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                {lastReading.value.toFixed(2)} g/L
                <span className={`ml-2 text-xs font-normal ${subtle}`}>{t('ilYa', { minutes: Math.max(0, Math.round(minutesBetween(lastReading.at, now))) })}</span>
              </p>
            ) : (
              <p className={`text-sm ${subtle}`}>{t('aucuneDonnee')}</p>
            )}
          </div>
          <div className="min-w-[6rem]">
            <p className={`text-xs uppercase tracking-wider font-semibold ${subtle}`}>{t('cl_iobActive')}</p>
            <p className={`text-base font-bold tabular-nums ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{iobTotal.toFixed(1)} {t('cl_unites')}</p>
          </div>
          {quickRisk && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${RISK_STYLE[quickRisk.level]}`} aria-label={t('cl_scoreHypo')}>
              {t(`RISK_${quickRisk.level}`)} · {quickRisk.score}
            </span>
          )}
          {nightActive && (
            <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>🌑 {t('modeNuitActif')}</span>
          )}
        </div>
        {basalDose > 0 && (
          <div className={`mt-2 flex items-center justify-between gap-2 text-xs ${subtle}`}>
            <span>{basalTakenToday ? `✅ ${t('basalePriseAujourdhui')}` : `⏰ ${t('basaleNonPrise')}`}</span>
            {!basalTakenToday && (
              <button type="button" onClick={() => onLogBasal?.(basalDose)}
                className={`rounded-lg px-2 py-1 font-semibold ${isDark ? 'bg-teal-900/50 text-teal-200' : 'bg-teal-50 text-teal-700'}`}>
                {t('basaleEnregistrer')} · {t('basaleUnites', { units: basalDose })}
              </button>
            )}
          </div>
        )}
      </section>

      <GlycemiaInput glycemia={glycemia} setGlycemia={setGlycemia} trend={trend} setTrend={setTrend}
        hour={hour} setHour={setHour} t={t} isDark={isDark} />

      {velocityEstimate?.velocity != null && (
        <p className={`text-xs px-1 ${subtle}`}>
          {t(`VEL_${velocityEstimate.cls}`)} · {velocityEstimate.velocity > 0 ? '+' : ''}{velocityEstimate.velocity.toFixed(2)} g/L/h ({t('velocityMesuree', { minutes: velocityEstimate.intervalMinutes })})
        </p>
      )}

      {isHypoNow ? (
        <section className={`rounded-2xl p-4 border-2 ${isDark ? 'bg-red-950/40 border-red-800' : 'bg-red-50 border-red-300'}`} aria-live="assertive">
          <h2 className={`text-base font-bold ${isDark ? 'text-red-200' : 'text-red-800'}`}>🚨 {t('hypoParcoursTitre')}</h2>
          <ol className={`mt-2 space-y-1 text-sm list-decimal list-inside ${isDark ? 'text-red-100' : 'text-red-900'}`}>
            <li>{t('hypoParcoursEtape1')}</li>
            <li>{t('hypoParcoursEtape2')}</li>
            <li>{t('hypoParcoursEtape3')}</li>
            <li>{t('hypoParcoursEtape4')}</li>
          </ol>
          <p className={`mt-2 text-xs ${isDark ? 'text-red-300' : 'text-red-700'}`}>{t('hypoSevereAide')}</p>
          {hypoLogged ? (
            <p role="status" className={`mt-3 text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>✅ {t('hypoEnregistre')}</p>
          ) : (
            <button type="button" onClick={handleLogHypo} className="mt-3 w-full py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700">
              🍬 {t('hypoDemarrer')}
            </button>
          )}
        </section>
      ) : (
        <>
          <MealInput totalCarbs={manualCarbs} setTotalCarbs={setManualCarbs} fatLevel={fatLevel} setFatLevel={setFatLevel}
            foods={foods} selections={selectionsArray} toggleFood={toggleFood} updateMult={updateMult} customFoods={customFoods}
            onPhotoMeal={onPhotoMeal} onSaveCustomFood={onSaveCustomFood} t={t} isDark={isDark} totalFatGrams={totalFatGrams} />

          <ContextInput activity={activity} setActivity={setActivity} iobTotal={iobTotal} t={t} isDark={isDark} />

          <div className={cardClass}>
            <div className="flex flex-wrap gap-2 items-center">
              <label className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                <input type="checkbox" checked={illness} onChange={(e) => setIllness(e.target.checked)} className="w-5 h-5 rounded" />
                🤒 {t('maladieJour')}
              </label>
              {fasting?.enabled && (
                <div role="group" aria-label={t('ramadanRepasSlot')} className="flex gap-1 ml-auto">
                  {[['suhoor', t('ramadanSuhoor')], ['iftar', t('ramadanIftar')], ['other', t('ramadanAutre')]].map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setMealSlot(k)} aria-pressed={mealSlot === k}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border ${mealSlot === k
                        ? (isDark ? 'bg-indigo-900/40 border-indigo-500 text-indigo-200' : 'bg-indigo-50 border-indigo-400 text-indigo-800')
                        : (isDark ? 'border-slate-600 text-slate-300' : 'border-gray-200 text-gray-600')}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {illness && <p className={`mt-1 text-xs ${subtle}`}>{t('maladieJourDesc')}</p>}
          </div>

          <button type="button" onClick={handleAnalyze} disabled={isNaN(gVal) || gVal <= 0}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-lg disabled:opacity-40 hover:bg-blue-700">
            {t('cl_analyser') || 'Analyser'}
          </button>

          <div ref={resultRef}>
            <ClinicalResponse result={result} t={t} isDark={isDark} locale={locale} />
          </div>

          {result && !result.recommendation.blocked && (
            <div className="space-y-2">
              <label htmlFor="consult-notes" className={`text-xs font-medium ${subtle}`}>
                {t('notes') || 'Notes'} ({t('optionnel') || 'optionnel'})
              </label>
              <input id="consult-notes" type="text" placeholder={t('notesPlaceholder') || 'Stress, maladie, contexte...'} value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400' : 'bg-white border-gray-300 text-slate-800 placeholder:text-slate-500'}`} />
              <label htmlFor="consult-dose" className={`text-xs font-medium ${subtle}`}>
                {t('doseReelle') || 'Dose réellement injectée'} (U)
              </label>
              <div className="flex gap-2">
                <input id="consult-dose" type="number" step="0.5" min="0" inputMode="decimal" value={actualDose} onChange={(e) => setActualDose(e.target.value)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-center text-xl font-bold ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-gray-300 text-slate-800'}`} />
                <button type="button" onClick={handleSave} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700">
                  {t('confirmerEnregistrer') || '💉 Confirmer'}
                </button>
              </div>
              {maxDoseEff && (
                <p className={`text-xs ${subtle}`}>{t('plafondDose')} : {maxDoseEff} U</p>
              )}
            </div>
          )}
        </>
      )}

      {showOverdose && (
        <OverdoseDialog dose={parseFloat(actualDose) || result?.recommendation.dose} maxDose={maxDoseEff}
          onConfirm={doSave} onCancel={() => setShowOverdose(false)} isDark={isDark} t={t} />
      )}

      <p className={`text-xs text-center ${subtle}`}>{formatTime(now, locale)} · {t('cl_iobActive')} {iobTotal.toFixed(1)} U</p>
    </div>
  );
}
