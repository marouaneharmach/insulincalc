// v4/src/components/ConsultationScreen.jsx
import { useState, useMemo, useRef, useEffect } from 'react';
import GlycemiaInput from './GlycemiaInput';
import MealInput from './MealInput';
import ContextInput from './ContextInput';
import ClinicalResponse from './ClinicalResponse';
import { analyzeAndRecommend } from '../utils/clinicalEngine';
import { calcTotalIOB } from '../utils/iobCurve';
import { scaleDosePlan } from '../utils/dosePlan';

// Approximate fat grams per portion for each qualitative level
const FAT_GRAMS_APPROX = { aucun: 0, faible: 3, moyen: 10, 'élevé': 20 };

export default function ConsultationScreen({
  // From App state
  glycemia, setGlycemia, ratio, isf, targetGMin, targetGMax,
  postKeto, slowDigestion, dia,
  journal, selections, foods, customFoods, toggleFood, updateMult,
  timeProfiles, onSaveToJournal, onPhotoMeal, onSaveCustomFood, setTab, t, isRTL, isDark,
}) {
  const [mountTime] = useState(() => Date.now());
  const [trend, setTrend] = useState('?');
  const [hour, setHour] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  });
  const [activity, setActivity] = useState('aucune');
  const [fatLevel, setFatLevel] = useState('aucun');
  const [manualCarbs, setManualCarbs] = useState(0);
  const [result, setResult] = useState(null);
  const [actualDose, setActualDose] = useState('');
  const [notes, setNotes] = useState('');
  const resultRef = useRef(null);
  const prevResultRef = useRef(null);

  useEffect(() => {
    if (result && result !== prevResultRef.current && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevResultRef.current = result;
  }, [result]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (result?.recommendation?.dose != null) {
      setActualDose(String(result.recommendation.dose));
    }
  }, [result?.recommendation?.dose]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Calculate total carbs (expert mode: manual, assisted mode: from selections)
  const totalCarbs = useMemo(() => {
    const fromSelections = Object.entries(selections).reduce((sum, [id, sel]) => {
      const food = [...foods, ...(customFoods || [])].find(f => f.id === id);
      return sum + (food ? food.carbs * (sel.mult || 1) : 0);
    }, 0);
    return manualCarbs > 0 ? manualCarbs : Math.round(fromSelections);
  }, [manualCarbs, selections, foods, customFoods]);

  // Estimate total fat in grams from selections (qualitative → approximate grams)
  const totalFatGrams = useMemo(() => {
    const fromSelections = Object.entries(selections).reduce((sum, [id, sel]) => {
      const food = [...foods, ...(customFoods || [])].find(f => f.id === id);
      if (!food) return sum;
      const fatGrams = FAT_GRAMS_APPROX[food.fat] ?? 0;
      return sum + fatGrams * (sel.mult || 1);
    }, 0);
    return Math.round(fromSelections);
  }, [selections, foods, customFoods]);

  // Auto-derive fatLevel from estimated fat grams (assisted mode)
  const autoFatLevel = useMemo(() => {
    if (totalFatGrams <= 5) return 'aucun';
    if (totalFatGrams <= 15) return 'faible';
    if (totalFatGrams <= 30) return 'moyen';
    return 'élevé';
  }, [totalFatGrams]);

  // Calculate IOB from recent journal entries
  const diaMinutes = (dia || 4.5) * 60;
  const iobTotal = useMemo(() => {
    const injections = journal
      .filter(e => (e.doseActual ?? e.doseReelle ?? e.doseInjected ?? 0) > 0)
      .map(e => ({
        dose: e.doseActual ?? e.doseReelle ?? e.doseInjected ?? 0,
        minutesAgo: (mountTime - new Date(e.date).getTime()) / 60000,
      }))
      .filter(i => i.minutesAgo < diaMinutes && i.minutesAgo >= 0);
    return calcTotalIOB(injections, diaMinutes);
  }, [journal, diaMinutes, mountTime]);

  // Last injection time
  const lastInjectionMinutesAgo = useMemo(() => {
    const recent = journal
      .filter(e => (e.doseActual ?? e.doseReelle ?? e.doseInjected ?? 0) > 0)
      .map(e => (mountTime - new Date(e.date).getTime()) / 60000)
      .filter(m => m >= 0)
      .sort((a, b) => a - b);
    return recent.length > 0 ? recent[0] : null;
  }, [journal, mountTime]);

  // Get active time profile ratio/isf
  const activeParams = useMemo(() => {
    const h = parseInt(hour.split(':')[0], 10);
    if (timeProfiles && timeProfiles.length > 0) {
      const match = timeProfiles.find(p => {
        if (p.startH <= p.endH) return h >= p.startH && h < p.endH;
        return h >= p.startH || h < p.endH; // wraps midnight
      });
      if (match) return { ratio: match.ratio || ratio, isf: match.isf || isf };
    }
    return { ratio, isf };
  }, [hour, timeProfiles, ratio, isf]);

  // Convert selections object map {id: {mult}} to array [{food, mult}] for MealInput
  const selectionsArray = useMemo(() => {
    if (!selections || typeof selections !== 'object') return [];
    const allFoods = [...foods, ...(customFoods || [])];
    return Object.entries(selections).map(([id, sel]) => {
      const food = allFoods.find(f => f.id === id);
      return food ? { food, mult: sel.mult || 1 } : null;
    }).filter(Boolean);
  }, [selections, foods, customFoods]);

  const gVal = parseFloat(glycemia);

  const handleAnalyze = () => {
    if (isNaN(gVal) || gVal <= 0) return;

    const r = analyzeAndRecommend({
      glycemia: gVal, trend, totalCarbs,
      fatLevel: manualCarbs > 0 ? fatLevel : autoFatLevel,
      activity,
      ratio: activeParams.ratio, isf: activeParams.isf / 100,
      targetMin: targetGMin, targetMax: targetGMax,
      iobTotal, lastInjectionMinutesAgo,
      slowDigestion, postKeto,
      totalFatGrams: manualCarbs > 0 ? null : totalFatGrams,
    });
    setResult(r);
  };

  const handleSave = () => {
    if (!result) return;
    doSave();
  };

  const doSave = () => {
    if (!result) return;

    const splitResult = result.recommendation.split;
    const doseSug = result.recommendation.dose;
    const doseReel = !isNaN(parseFloat(actualDose)) ? parseFloat(actualDose) : doseSug;
    const scaledPlan = scaleDosePlan({
      bolusType: splitResult.type,
      splitImmediate: splitResult.immediate,
      splitDelayed: splitResult.delayed,
      splitDelayMinutes: splitResult.delayMinutes,
      splitPhases: splitResult.phases?.map((phase) => ({
        ...phase,
        done: phase.delayMinutes === 0,
      })) ?? null,
    }, doseSug, doseReel);

    const journalEntry = {
      glycPre: gVal, tendance: trend, heure: hour,
      totalGlucides: totalCarbs,
      niveauGras: manualCarbs > 0 ? fatLevel : autoFatLevel,
      totalLipides: totalFatGrams,
      aliments: Object.keys(selections).length > 0
        ? Object.entries(selections).map(([id, sel]) => {
            const f = [...foods, ...(customFoods || [])].find(f => f.id === id);
            return f ? { id: f.id, name: f.name, carbs: f.carbs, qty: sel.mult || 1, fat: f.fat, gi: f.gi } : null;
          }).filter(Boolean)
        : null,
      iobAuMoment: parseFloat(iobTotal.toFixed(1)),
      doseSuggeree: doseSug,
      doseReelle: doseReel,
      doseActual: doseReel,
      bolusType: scaledPlan.bolusType,
      splitImmediate: scaledPlan.splitImmediate,
      splitDelayed: scaledPlan.splitDelayed,
      splitDelayMinutes: scaledPlan.splitDelayMinutes,
      splitPhases: scaledPlan.splitPhases,
      activitePhysique: activity,
      alertes: [...result.vigilance.risks, ...result.vigilance.warnings],
      notes: notes.trim(),
    };
    onSaveToJournal(journalEntry);

    // Reset consultation form
    setResult(null);
    setTrend('?');
    setActivity('aucune');
    setFatLevel('aucun');
    setManualCarbs(0);
    setActualDose('');
    setNotes('');

    // Redirect to Journal tab to see the saved entry
    if (setTab) setTab('journal');
  };

  return (
    <div className="space-y-4 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <GlycemiaInput glycemia={glycemia} setGlycemia={setGlycemia}
            trend={trend} setTrend={setTrend} hour={hour} setHour={setHour} t={t} />

          <MealInput totalCarbs={manualCarbs} setTotalCarbs={setManualCarbs}
            fatLevel={fatLevel} setFatLevel={setFatLevel}
            foods={foods} selections={selectionsArray} toggleFood={toggleFood}
            updateMult={updateMult} customFoods={customFoods}
            onPhotoMeal={onPhotoMeal} onSaveCustomFood={onSaveCustomFood}
            t={t} isDark={isDark}
            totalFatGrams={totalFatGrams} />

          <ContextInput activity={activity} setActivity={setActivity}
            iobTotal={iobTotal} t={t} isDark={isDark} />

          <button onClick={handleAnalyze}
            disabled={isNaN(gVal) || gVal <= 0}
            className="w-full py-3 rounded-xl bg-blue-500 text-white font-bold text-lg disabled:opacity-40">
            {t('cl_analyser') || 'Analyser'}
          </button>

          <div ref={resultRef}>
            <ClinicalResponse result={result} t={t} isDark={isDark} />
          </div>

          {result && !result.recommendation.blocked && (
            <div className="space-y-2">
              <label className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('notes') || 'Notes'} ({t('optionnel') || 'optionnel'})
              </label>
              <input
                type="text"
                placeholder={t('notesPlaceholder') || 'Stress, maladie, contexte...'}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500'
                    : 'bg-white border-gray-300 text-slate-800 placeholder:text-slate-400'
                }`}
              />
              <label className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('doseReelle') || 'Dose réellement injectée'} (u)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={actualDose}
                  onChange={e => setActualDose(e.target.value)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-center text-xl font-bold ${
                    isDark
                      ? 'bg-slate-700 border-slate-600 text-slate-100'
                      : 'bg-white border-gray-300 text-slate-800'
                  }`}
                />
                <button
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold"
                >
                  {t('confirmerEnregistrer') || '💉 Confirmer'}
                </button>
              </div>
            </div>
          )}
    </div>
  );
}
