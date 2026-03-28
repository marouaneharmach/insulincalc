import { useState, useMemo, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useTheme } from './hooks/useTheme';
import { useI18n } from './i18n/useI18n';
import { calcIMC } from './utils/calculations';
import { QTY_PROFILES } from './data/constants';
import FOOD_DB from './data/foods';
import { setFallbackHandler } from './utils/notifications';

import DayTimeline from './components/DayTimeline';
import Settings from './components/Settings';
import BottomNav3 from './components/BottomNav3';
import Onboarding from './components/Onboarding';
import PdfExport from './components/PdfExport';
import OverdoseDialog from './components/OverdoseDialog';
import ConsultationScreen from './components/ConsultationScreen';

export default function App() {
  const { theme, isDark, colors, toggleTheme } = useTheme();
  const { t, locale, setLocale, isRTL } = useI18n();

  const [onboarded, setOnboarded] = useLocalStorage('onboarded', false);

  const [tab, setTab] = useState('consultation');

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

  // Medical profile
  const [insulinBasal, setInsulinBasal] = useLocalStorage('insulinBasal', 'Tresiba');
  const [insulinRapid, setInsulinRapid] = useLocalStorage('insulinRapid', 'NovoRapid');
  const [basalDose, setBasalDose] = useLocalStorage('basalDose', 12);
  const [postKeto, setPostKeto] = useLocalStorage('postKeto', false);
  const [slowDigestion, setSlowDigestion] = useLocalStorage('slowDigestion', false);
  const [dia, setDia] = useLocalStorage('dia', 4.5);

  // Journal
  const [journal, setJournal] = useLocalStorage('journal', []);

  // Time-based profiles
  const [timeProfiles, setTimeProfiles] = useLocalStorage('timeProfiles', []);

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
  const weightOk = !isNaN(weightKg) && weightKg >= 20 && weightKg <= 200;
  const imc = (weightOk && heightCm > 50) ? calcIMC(weightKg, heightCm) : null;

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

  // Bridge: convert selections array to object map for ConsultationScreen
  const selectionsMap = useMemo(() => {
    const map = {};
    selections.forEach(s => { map[s.food.id] = { mult: s.mult }; });
    return map;
  }, [selections]);

  // Flat foods array for ConsultationScreen
  const foodsFlat = useMemo(() => Object.values(FOOD_DB).flat(), []);

  // V5 journal save handler for ConsultationScreen
  const onSaveToJournalV5 = useCallback((entry) => {
    const fullEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      ...entry,
      doseReelle: entry.doseSuggeree, // default to suggested, patient can edit
      glycPost: null,
    };

    // Overdose check
    if (fullEntry.doseSuggeree > maxDose) {
      setOverdoseDialog({ dose: fullEntry.doseSuggeree, callback: () => {
        setJournal(prev => [fullEntry, ...prev].slice(0, 200));
      }});
    } else {
      setJournal(prev => [fullEntry, ...prev].slice(0, 200));
    }

    // Schedule split bolus notification if applicable
    if (notifEnabled && entry.bolusType === 'fractionne') {
      // Will be implemented in Task 14
    }
  }, [maxDose, setJournal, notifEnabled]);

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
        setDigestion={setDigestion}
        setInsulinBasal={setInsulinBasal}
        setInsulinRapid={setInsulinRapid}
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
        {tab === 'consultation' && (
          <ConsultationScreen
            glycemia={glycemia} setGlycemia={setGlycemia}
            ratio={ratio} isf={isf}
            targetGMin={targetGMin} targetGMax={targetGMax}
            maxDose={maxDose}
            postKeto={postKeto} slowDigestion={slowDigestion} dia={dia}
            journal={journal}
            selections={selectionsMap}
            foods={foodsFlat}
            customFoods={customFoods}
            toggleFood={toggleFood}
            updateMult={updateMult}
            timeProfiles={timeProfiles}
            onSaveToJournal={onSaveToJournalV5}
            onPhotoMeal={null}
            t={t} isRTL={isRTL}
          />
        )}
        {tab === 'journal' && (
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
        {tab === 'reglages' && (
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
            insulinBasal={insulinBasal} setInsulinBasal={setInsulinBasal}
            insulinRapid={insulinRapid} setInsulinRapid={setInsulinRapid}
            basalDose={basalDose} setBasalDose={setBasalDose}
            postKeto={postKeto} setPostKeto={setPostKeto}
            slowDigestion={slowDigestion} setSlowDigestion={setSlowDigestion}
            dia={dia} setDia={setDia}
            t={t} colors={colors} isRTL={isRTL}
          />
        )}
      </div>

      {/* Bottom navigation */}
      <BottomNav3 tab={tab} setTab={setTab} t={t} />

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

    </div>
  );
}
