import { useState, useMemo, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useTheme } from './hooks/useTheme';
import { useI18n } from './i18n/useI18n';
import { round05, calcWeightSuggestions, getOverallFat, getDominantGI, buildSchedule, calcIMC, calcBSA, calcBMR } from './utils/calculations';
import { QTY_PROFILES, DIGESTION_PROFILES, FAT_FACTOR } from './data/constants';
import FOOD_DB from './data/foods';
import { scheduleFromPlan, cancelAll, setFallbackHandler } from './utils/notifications';
import { getActiveProfile } from './components/TimeProfiles';

import HomeScreen from './components/HomeScreen';
import MealBuilder from './components/MealBuilder';
import DayTimeline from './components/DayTimeline';
import Settings from './components/Settings';
import BottomNav from './components/BottomNav';
import QuickAddSheet from './components/QuickAddSheet';
import Onboarding from './components/Onboarding';
import PdfExport from './components/PdfExport';
import OverdoseDialog from './components/OverdoseDialog';

export default function App() {
  const { theme, isDark, colors, toggleTheme } = useTheme();
  const { t, locale, setLocale, isRTL } = useI18n();

  const [onboarded, setOnboarded] = useLocalStorage('onboarded', false);

  const [tab, setTab] = useState('home');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddType, setQuickAddType] = useState(null);

  // Core parameters
  const [glycemia, setGlycemia] = useLocalStorage('glycemia', '');
  const [weight, setWeight] = useLocalStorage('weight', '');
  const [ratio, setRatio] = useLocalStorage('ratio', 10);
  const [isf, setIsf] = useLocalStorage('isf', 50);
  const [targetGMin, setTargetGMin] = useLocalStorage('targetGMin', 0.8);
  const [targetGMax, setTargetGMax] = useLocalStorage('targetGMax', 1.3);
  const targetGMid = Math.round(((targetGMin + targetGMax) / 2) * 100) / 100;
  const [digestion, setDigestion] = useLocalStorage('digestion', 'normal');
  const [maxDose, setMaxDose] = useLocalStorage('maxDose', 20);

  // Profile
  const [height, setHeight] = useLocalStorage('height', '');
  const [age, setAge] = useLocalStorage('age', '');
  const [sex, setSex] = useLocalStorage('sex', 'M');
  const [patientName, setPatientName] = useLocalStorage('patientName', '');
  const [notifEnabled, setNotifEnabled] = useLocalStorage('notifEnabled', false);

  // Journal
  const [journal, setJournal] = useLocalStorage('journal', []);

  // Time-based profiles
  const [timeProfiles, setTimeProfiles] = useLocalStorage('timeProfiles', []);
  const activeProfile = useMemo(() => getActiveProfile(timeProfiles, ratio, isf), [timeProfiles, ratio, isf]);

  // Overdose dialog
  const [overdoseDialog, setOverdoseDialog] = useState(null);

  // In-app notification fallback (for Safari private browsing, etc.)
  const [inAppNotif, setInAppNotif] = useState(null);
  useState(() => {
    setFallbackHandler((notif) => {
      setInAppNotif(notif);
      setTimeout(() => setInAppNotif(null), 15000); // auto-dismiss after 15s
    });
  });

  // Selections
  const [selData, setSelData] = useLocalStorage('selections', []);
  const [favorites, setFavorites] = useLocalStorage('favorites', []);
  const [customFoods, setCustomFoods] = useLocalStorage('custom_foods', []);

  // All foods map
  const allFoods = useMemo(() => {
    const map = {};
    for (const foods of Object.values(FOOD_DB)) {
      for (const f of foods) map[f.id] = f;
    }
    for (const f of customFoods) map[f.id] = f;
    return map;
  }, [customFoods]);

  const [selections, setSelectionsRaw] = useState(() =>
    selData.map(s => ({ food: allFoods[s.foodId], mult: s.mult })).filter(s => s.food)
  );

  const setSelections = useCallback((updater) => {
    setSelectionsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setSelData(next.map(s => ({ foodId: s.food.id, mult: s.mult })));
      return next;
    });
  }, [setSelData]);

  // Derived calculations
  const weightKg = parseFloat(weight);
  const heightCm = parseFloat(height);
  const ageNum = parseInt(age);
  const weightOk = !isNaN(weightKg) && weightKg >= 20 && weightKg <= 200;
  const wSugg = weightOk ? calcWeightSuggestions(weightKg, ageNum, sex) : null;
  const imc = (weightOk && heightCm > 50) ? calcIMC(weightKg, heightCm) : null;

  const totalCarbs = useMemo(() => Math.round(selections.reduce((s, sel) => s + sel.food.carbs * sel.mult, 0)), [selections]);
  const dominantFat = useMemo(() => getOverallFat(selections), [selections]);
  const dominantGI = useMemo(() => getDominantGI(selections), [selections]);

  const gVal = parseFloat(glycemia);
  const glycOk = !isNaN(gVal) && gVal >= 0.3 && gVal <= 6.0;
  const canCalc = glycOk && totalCarbs > 0;

  const result = useMemo(() => {
    if (!canCalc) return null;
    const effectiveRatio = activeProfile.ratio;
    const effectiveIsf = activeProfile.isf;
    const bolusRepas = totalCarbs / effectiveRatio;
    const ecart = gVal - targetGMid;
    const correction = ecart > 0 ? (ecart * 100) / effectiveIsf : 0;
    const fatBonus = (totalCarbs / effectiveRatio) * FAT_FACTOR[dominantFat];
    const total = round05(bolusRepas + correction + fatBonus);
    const hasFat = dominantFat === 'élevé' || dominantFat === 'moyen';
    const bolusType = hasFat ? 'dual' : 'standard';
    const schedule = buildSchedule(totalCarbs, bolusRepas, correction, fatBonus, gVal, targetGMid, digestion, bolusType, dominantGI);
    const warnings = [];
    if (gVal < 1.0) warnings.push({ t: 'w', txt: t('glycemieBasse') });
    if (gVal > 2.0) warnings.push({ t: 'w', txt: t('glycemieElevee') });
    if (bolusType === 'dual') warnings.push({ t: 'i', txt: t('repasGras') });
    if (dominantGI === 'élevé') warnings.push({ t: 'c', txt: t('igEleve') });
    if (total > 20) warnings.push({ t: 'w', txt: t('doseElevee') });
    return { total, bolusType, warnings, schedule, bolusRepas: +bolusRepas.toFixed(1), correction: +correction.toFixed(1), fatBonus: +fatBonus.toFixed(1) };
  }, [canCalc, totalCarbs, activeProfile, gVal, targetGMid, dominantFat, dominantGI, digestion, t]);

  // Save to journal with overdose check
  const doSaveToJournal = useCallback((doseActual) => {
    if (!result) return;
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      glycPre: gVal.toFixed(2),
      glycPost: '',
      totalCarbs,
      doseSuggested: result.total,
      doseActual: doseActual != null ? doseActual : result.total,
      aliments: selections.map(s => s.food.name).join(', '),
      alimentIds: selections.map(s => s.food.id),
      bolusType: result.bolusType,
      digestion,
      schedule: result.schedule,
      mealType: 'dejeuner',
    };
    setJournal(prev => {
      if (prev.length > 0 && Date.now() - prev[0].id < 120000) return prev;
      return [entry, ...prev].slice(0, 200);
    });

    if (notifEnabled && result.schedule) {
      scheduleFromPlan(result.schedule);
    }
  }, [result, gVal, totalCarbs, selections, digestion, notifEnabled, setJournal]);

  const saveToJournal = useCallback((doseActual) => {
    const dose = doseActual != null ? doseActual : result?.total;
    if (dose > maxDose) {
      setOverdoseDialog({ dose, callback: () => doSaveToJournal(doseActual) });
    } else {
      doSaveToJournal(doseActual);
    }
  }, [result, maxDose, doSaveToJournal]);

  const resetMeal = () => {
    setSelections([]);
    setGlycemia('');
  };

  const toggleFood = useCallback((food) => {
    setSelections(prev => {
      const ex = prev.find(s => s.food.id === food.id);
      if (ex) return prev.filter(s => s.food.id !== food.id);
      const profile = QTY_PROFILES[food.qty] || QTY_PROFILES['plat'];
      const defaultM = profile.find(s => Math.abs(s.m - 1) < 0.01)?.m || profile[Math.floor(profile.length / 2)].m;
      return [...prev, { food, mult: defaultM }];
    });
  }, [setSelections]);

  const updateMult = useCallback((id, mult) => {
    setSelections(prev => prev.map(s => s.food.id === id ? { ...s, mult: Math.max(0.25, Math.min(mult, 10)) } : s));
  }, [setSelections]);

  const openQuickAdd = (type) => {
    setQuickAddType(type);
    setShowQuickAdd(true);
  };

  // Get last glycemia from journal
  const lastGlyc = useMemo(() => {
    const last = journal.find(e => e.glycPre);
    if (!last) return null;
    const minAgo = Math.round((Date.now() - last.id) / 60000);
    return { value: parseFloat(last.glycPre), minutesAgo: minAgo, date: last.date };
  }, [journal]);

  if (!onboarded) {
    return (
      <Onboarding
        setPatientName={setPatientName}
        setAge={setAge}
        setSex={setSex}
        setHeight={setHeight}
        setWeight={setWeight}
        setRatio={setRatio}
        setIsf={setIsf}
        setTargetGMin={setTargetGMin}
        setTargetGMax={setTargetGMax}
        onComplete={() => setOnboarded(true)}
        t={t}
        isDark={isDark}
        colors={colors}
      />
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={`min-h-screen ${isDark ? 'bg-slate-900 text-slate-200' : 'bg-[#F7FAFB] text-slate-800'} font-sans`}>
      {/* Legal disclaimer */}
      <div className={`px-4 py-1.5 text-center text-[10px] ${isDark ? 'bg-red-950/30 text-red-300 border-b border-red-900/30' : 'bg-red-50 text-red-700 border-b border-red-100'}`}>
        ⚕️ {t('disclaimerBanner')}
      </div>

      {/* Main content */}
      <div className="max-w-lg mx-auto pb-24 px-0 sm:px-2">
        {tab === 'home' && (
          <HomeScreen
            patientName={patientName}
            lastGlyc={lastGlyc}
            glycemia={glycemia}
            journal={journal}
            targetGMin={targetGMin}
            targetGMax={targetGMax}
            targetGMid={targetGMid}
            result={result}
            totalCarbs={totalCarbs}
            selections={selections}
            setTab={setTab}
            onQuickAdd={openQuickAdd}
            activeProfile={activeProfile}
            t={t}
            colors={colors}
            isDark={isDark}
          />
        )}
        {tab === 'repas' && (
          <MealBuilder
            glycemia={glycemia}
            setGlycemia={setGlycemia}
            weight={weight}
            setWeight={setWeight}
            selections={selections}
            toggleFood={toggleFood}
            updateMult={updateMult}
            resetMeal={resetMeal}
            totalCarbs={totalCarbs}
            dominantFat={dominantFat}
            dominantGI={dominantGI}
            digestion={digestion}
            setDigestion={setDigestion}
            result={result}
            maxDose={maxDose}
            onSave={saveToJournal}
            favorites={favorites}
            setFavorites={setFavorites}
            customFoods={customFoods}
            setCustomFoods={setCustomFoods}
            allFoods={allFoods}
            wSugg={wSugg}
            gVal={gVal}
            glycOk={glycOk}
            targetGMid={targetGMid}
            isf={isf}
            ratio={ratio}
            t={t}
            colors={colors}
            isDark={isDark}
            isRTL={isRTL}
          />
        )}
        {tab === 'timeline' && (
          <>
            <DayTimeline
              journal={journal}
              setJournal={setJournal}
              targetGMin={targetGMin}
              targetGMax={targetGMax}
              targetGMid={targetGMid}
              isf={isf}
              ratio={ratio}
              t={t}
              colors={colors}
              isDark={isDark}
            />
            <PdfExport
              journal={journal}
              patientName={patientName}
              ratio={ratio}
              isf={isf}
              targetGMin={targetGMin}
              targetGMax={targetGMax}
              t={t}
              colors={colors}
              isDark={isDark}
            />
          </>
        )}
        {tab === 'settings' && (
          <Settings
            ratio={ratio} setRatio={setRatio}
            isf={isf} setIsf={setIsf}
            targetGMin={targetGMin} setTargetGMin={setTargetGMin}
            targetGMax={targetGMax} setTargetGMax={setTargetGMax}
            targetGMid={targetGMid}
            digestion={digestion} setDigestion={setDigestion}
            maxDose={maxDose} setMaxDose={setMaxDose}
            patientName={patientName} setPatientName={setPatientName}
            weight={weight} setWeight={setWeight}
            height={height} setHeight={setHeight}
            age={age} setAge={setAge}
            sex={sex} setSex={setSex}
            imc={imc}
            notifEnabled={notifEnabled} setNotifEnabled={setNotifEnabled}
            theme={theme} isDark={isDark} toggleTheme={toggleTheme}
            locale={locale} setLocale={setLocale}
            timeProfiles={timeProfiles} setTimeProfiles={setTimeProfiles}
            journal={journal}
            t={t} colors={colors} isRTL={isRTL}
          />
        )}
      </div>

      {/* Bottom navigation */}
      <BottomNav tab={tab} setTab={setTab} t={t} colors={colors} isDark={isDark} selections={selections} />

      {/* Overdose safety dialog */}
      {overdoseDialog && (
        <OverdoseDialog
          dose={overdoseDialog.dose}
          maxDose={maxDose}
          onConfirm={() => { overdoseDialog.callback(); setOverdoseDialog(null); }}
          onCancel={() => setOverdoseDialog(null)}
          isDark={isDark}
        />
      )}

      {/* In-app notification toast (fallback for Safari/private browsing) */}
      {inAppNotif && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md animate-pulse">
          <div className={`rounded-2xl p-3 shadow-lg border ${isDark ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200'}`}
            onClick={() => setInAppNotif(null)}>
            <p className={`text-sm font-bold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>🔔 {inAppNotif.title}</p>
            <p className={`text-xs mt-1 whitespace-pre-line ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{inAppNotif.body}</p>
            <p className={`text-[10px] mt-1 ${isDark ? 'text-blue-600' : 'text-blue-300'}`}>Tap pour fermer</p>
          </div>
        </div>
      )}

      {/* Quick add overlay */}
      {showQuickAdd && (
        <QuickAddSheet
          type={quickAddType}
          onClose={() => setShowQuickAdd(false)}
          setTab={setTab}
          setGlycemia={setGlycemia}
          journal={journal}
          setJournal={setJournal}
          targetGMid={targetGMid}
          isf={isf}
          t={t}
          colors={colors}
          isDark={isDark}
        />
      )}
    </div>
  );
}
