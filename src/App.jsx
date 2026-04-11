import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useTheme } from './hooks/useTheme';
import { useI18n } from './i18n/useI18n';
import { calcIMC } from './utils/calculations';
import { QTY_PROFILES } from './data/constants';
import FOOD_DB from './data/foods';
import { setFallbackHandler, scheduleSplitReminder, schedulePostMealReminder } from './utils/notifications';
import { needsMigration, migrateAllEntries } from './utils/migration';
import { APP_VERSION, BUILD_ID } from './version';
import { recognizeFood, mapToLocalFoods } from './utils/foodRecognition';
import { useAppVersioning } from './hooks/useAppVersioning';

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
  const {
    diagnostics,
    releaseNotes,
    updateAvailable,
    remoteVersion,
    showWhatsNew,
    checkForUpdates,
    applyUpdate,
    dismissWhatsNew,
  } = useAppVersioning();

  const [onboarded, setOnboarded] = useLocalStorage('onboarded', false);

  const [tab, setTab] = useState('accueil');

  // Core parameters
  const [glycemia, setGlycemia] = useLocalStorage('glycemia', '');
  const [weight, setWeight] = useLocalStorage('weight', '');
  const [ratio, setRatio] = useLocalStorage('ratio', 15);
  const [isf, setIsf] = useLocalStorage('isf', 60);
  const [targetGMin, setTargetGMin] = useLocalStorage('targetGMin', 1.0);
  const [targetGMax, setTargetGMax] = useLocalStorage('targetGMax', 1.2);
  const targetGMid = Math.round(((targetGMin + targetGMax) / 2) * 100) / 100;
  const [maxDose, setMaxDose] = useLocalStorage('maxDose', 10);

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

  // v4 → v5 data migration (run once on mount)
  useEffect(() => {
    const version = localStorage.getItem('insulincalc_v4_app_version');
    if (needsMigration(version)) {
      const migrated = migrateAllEntries(journal);
      setJournal(migrated);
      localStorage.setItem('insulincalc_v4_app_version', APP_VERSION);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [, /* favorites */] = useLocalStorage('favorites', []);
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

  // Photo thumbnail state for journal persistence
  const [lastPhotoThumbnail, setLastPhotoThumbnail] = useState(null);

  // Photo meal recognition handler — returns results for MealInput to display
  // Also generates a small thumbnail for journal persistence
  const handlePhotoMeal = useCallback(async (file) => {
    // Generate small thumbnail (80px) for journal
    const { compressImage } = await import('./utils/foodRecognition');
    const thumb = await compressImage(file, 80);
    const reader = new FileReader();
    reader.onloadend = () => setLastPhotoThumbnail(reader.result);
    reader.readAsDataURL(thumb);

    const results = await recognizeFood(file);
    const mapped = mapToLocalFoods(results, allFoods);
    return mapped;
  }, [allFoods]);

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
      date: (() => {
        if (entry.heure) {
          const [h, m] = entry.heure.split(':').map(Number);
          const d = new Date();
          d.setHours(h, m, 0, 0);
          return d.toISOString();
        }
        return new Date().toISOString();
      })(),
      ...entry,
      doseReelle: entry.doseReelle ?? entry.doseSuggeree,
      glycPost: null,
      photoThumbnail: lastPhotoThumbnail || null,
    };
    setLastPhotoThumbnail(null); // reset after save

    // Overdose check
    if (fullEntry.doseSuggeree > maxDose) {
      setOverdoseDialog({ dose: fullEntry.doseSuggeree, callback: () => {
        setJournal(prev => [fullEntry, ...prev].slice(0, 200));
      }});
    } else {
      setJournal(prev => [fullEntry, ...prev].slice(0, 200));
    }

    // Schedule notifications
    if (notifEnabled) {
      // Extended plan: remind for each future phase
      if (entry.bolusType === 'etendu' && entry.splitPhases) {
        entry.splitPhases.forEach(phase => {
          if (phase.delayMinutes > 0) {
            scheduleSplitReminder(phase.delayMinutes, phase.units);
          }
        });
      }
      // Split bolus: remind for 2nd injection
      else if (entry.bolusType === 'fractionne' && entry.splitDelayed > 0 && entry.splitDelayMinutes > 0) {
        scheduleSplitReminder(entry.splitDelayMinutes, entry.splitDelayed);
      }
      // Always schedule post-meal glycemia check (2h)
      schedulePostMealReminder(120);
    }
  }, [lastPhotoThumbnail, maxDose, setJournal, notifEnabled]);

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
      {/* Header with version */}
      <div className={`px-4 py-2 flex items-center justify-between border-b ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div>
          <span className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            InsulinCalc <span className={`text-xs font-mono font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>v{APP_VERSION}</span>
          </span>
          <p className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>build {BUILD_ID}</p>
        </div>
        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('appSubtitle')}</span>
      </div>

      {/* Legal disclaimer */}
      <div className={`px-4 py-1.5 text-center text-[10px] ${isDark ? 'bg-red-950/30 text-red-300 border-b border-red-900/30' : 'bg-red-50 text-red-700 border-b border-red-100'}`}>
        ⚕️ {t('disclaimerBanner')}
      </div>

      {updateAvailable && (
        <div className={`px-4 py-2 border-b ${isDark ? 'bg-amber-950/30 border-amber-900/40 text-amber-200' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t('miseAJourDisponible')}</p>
              <p className="text-[11px] opacity-80">
                {t('miseAJourVersion', { version: remoteVersion?.version || diagnostics.version })}
              </p>
            </div>
            <button
              type="button"
              onClick={applyUpdate}
              className="shrink-0 rounded-xl bg-teal-500 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-600"
            >
              {t('actualiserMaintenant')}
            </button>
          </div>
        </div>
      )}

      {showWhatsNew && (
        <div className={`px-4 py-2 border-b ${isDark ? 'bg-teal-950/30 border-teal-900/40 text-teal-100' : 'bg-teal-50 border-teal-100 text-teal-800'}`}>
          <div className="max-w-lg mx-auto flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t('quoiDeNeuf')} · v{APP_VERSION}</p>
              <ul className="mt-1 space-y-1 text-[11px] opacity-90">
                {releaseNotes.map((note) => <li key={note}>• {note}</li>)}
              </ul>
            </div>
            <button
              type="button"
              onClick={dismissWhatsNew}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${isDark ? 'bg-teal-900/60 text-teal-100' : 'bg-white text-teal-700'}`}
            >
              {t('fermer')}
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-lg mx-auto pb-24 px-0 sm:px-2">
        {tab === 'accueil' && (
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
            onPhotoMeal={handlePhotoMeal}
            onSaveCustomFood={(food) => setCustomFoods(prev => [...prev, food])}
            setTab={setTab}
            t={t} isRTL={isRTL} isDark={isDark}
          />
        )}
        {tab === 'journal' && (
          <>
            <DayTimeline
              journal={journal}
              setJournal={setJournal}
              targetGMin={targetGMin}
              targetGMax={targetGMax}
              t={t}
              isDark={isDark}
              locale={locale}
              dia={dia}
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
            diagnostics={diagnostics}
            updateAvailable={updateAvailable}
            releaseNotes={releaseNotes}
            onCheckForUpdates={checkForUpdates}
            onApplyUpdate={applyUpdate}
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
