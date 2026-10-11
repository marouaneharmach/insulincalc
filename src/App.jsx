import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useTheme } from './hooks/useTheme';
import { useI18n } from './i18n/useI18n';
import { useJournal } from './hooks/useJournal';
import { useAppVersioning } from './hooks/useAppVersioning';
import { calcIMC } from './domain/anthropometry';
import { QTY_PROFILES } from './data/constants';
import FOOD_DB from './data/foods';
import { newId } from './domain/ids';
import { combineDateAndTime, isNightHour, toLocalISO } from './domain/time';
import { effectiveRapidProfile } from './domain/insulin/profiles';
import { SETTINGS_KEYS } from './data/schema';
import { STORAGE_PREFIX } from './hooks/useLocalStorage';
import {
  startReminderLoop, scheduleEntryReminders, scheduleHypoRecheck, scheduleDailyBasalReminder,
  missedReminders, acknowledgeReminder,
} from './app/notificationService';
import { recognizeFood, mapToLocalFoods, compressImage } from './utils/foodRecognition';
import { APP_VERSION, BUILD_ID } from './version';

import DayTimeline from './components/DayTimeline';
import Settings from './components/Settings';
import BottomNav3 from './components/BottomNav3';
import Onboarding from './components/Onboarding';
import ConsultationScreen from './components/ConsultationScreen';

const ReportsScreen = lazy(() => import('./components/ReportsScreen'));

export default function App() {
  const { theme, setTheme, isDark, colors, toggleTheme } = useTheme();
  const { t, locale, setLocale, isRTL } = useI18n();
  const {
    diagnostics, releaseNotes, updateAvailable, remoteVersion, showWhatsNew, checkForUpdates, applyUpdate, dismissWhatsNew,
  } = useAppVersioning();
  const { journal, setJournal, importEntries, ready: journalReady, storageMode } = useJournal();

  const [onboarded, setOnboarded] = useLocalStorage('onboarded', false);
  const [tab, setTab] = useState('accueil');

  // Paramètres cliniques
  const [glycemia, setGlycemia] = useLocalStorage('glycemia', '');
  const [weight, setWeight] = useLocalStorage('weight', '');
  const [ratio, setRatio] = useLocalStorage('ratio', 15);
  const [isf, setIsf] = useLocalStorage('isf', 60);
  const [targetGMin, setTargetGMin] = useLocalStorage('targetGMin', 1.0);
  const [targetGMax, setTargetGMax] = useLocalStorage('targetGMax', 1.2);
  const targetGMid = Math.round(((targetGMin + targetGMax) / 2) * 100) / 100;

  // Profil
  const [height, setHeight] = useLocalStorage('height', '');
  const [age, setAge] = useLocalStorage('age', '');
  const [sex, setSex] = useLocalStorage('sex', 'M');
  const [patientName, setPatientName] = useLocalStorage('patientName', '');
  const [notifEnabled, setNotifEnabled] = useLocalStorage('notifEnabled', false);

  // Profil médical
  const [insulinBasal, setInsulinBasal] = useLocalStorage('insulinBasal', 'Tresiba');
  const [insulinRapid, setInsulinRapid] = useLocalStorage('insulinRapid', 'NovoRapid');
  const [insulinProfileId, setInsulinProfileId] = useLocalStorage('insulinProfileId', null);
  const [basalDose, setBasalDose] = useLocalStorage('basalDose', 12);
  const [basalReminderTime, setBasalReminderTime] = useLocalStorage('basalReminderTime', null);
  const [postKeto, setPostKeto] = useLocalStorage('postKeto', false);
  const [slowDigestion, setSlowDigestion] = useLocalStorage('slowDigestion', false);
  const [dia, setDia] = useLocalStorage('dia', 4.5);

  // Sécurité
  const [maxDoseU, setMaxDoseU] = useLocalStorage('maxDoseU', null);
  const [nightModeEnabled, setNightModeEnabled] = useLocalStorage('nightModeEnabled', true);
  const [nightStart, setNightStart] = useLocalStorage('nightStart', 21);
  const [nightEnd, setNightEnd] = useLocalStorage('nightEnd', 6);
  const [nightCorrectionMin, setNightCorrectionMin] = useLocalStorage('nightCorrectionMin', 1.8);

  // Ramadan
  const [fastingEnabled, setFastingEnabled] = useLocalStorage('fastingEnabled', false);
  const [fastingSuhoorReductionPct, setFastingSuhoorReductionPct] = useLocalStorage('fastingSuhoorReductionPct', 25);
  const [fastingBasalReductionPct, setFastingBasalReductionPct] = useLocalStorage('fastingBasalReductionPct', 20);

  // Clé API (stockée uniquement sur l'appareil)
  const [groqApiKey, setGroqApiKey] = useLocalStorage('groqApiKey', '');

  const [timeProfiles, setTimeProfiles] = useLocalStorage('timeProfiles', []);
  const [selData, setSelData] = useLocalStorage('selections', []);
  const [customFoods, setCustomFoods] = useLocalStorage('custom_foods', []);

  const insulinProfile = useMemo(
    () => effectiveRapidProfile(insulinProfileId, insulinRapid, dia),
    [insulinProfileId, insulinRapid, dia],
  );

  // ─── Rappels ────────────────────────────────────────────────────────────────
  const [inAppNotif, setInAppNotif] = useState(null);
  const [missed, setMissed] = useState(() => missedReminders());
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  useEffect(() => {
    const stop = startReminderLoop({
      getT: () => tRef.current,
      onInApp: (n) => {
        setInAppNotif(n);
        setMissed(missedReminders());
        setTimeout(() => setInAppNotif((cur) => (cur?.id === n.id ? null : cur)), 20000);
      },
    });
    return stop;
  }, []);
  useEffect(() => {
    scheduleDailyBasalReminder(basalReminderTime, basalDose);
  }, [basalReminderTime, basalDose]);
  const acknowledge = useCallback((id) => {
    acknowledgeReminder(id);
    setMissed(missedReminders());
  }, []);

  // ─── Aliments ───────────────────────────────────────────────────────────────
  const allFoods = useMemo(() => {
    const map = {};
    for (const foods of Object.values(FOOD_DB)) for (const f of foods) map[f.id] = f;
    for (const f of customFoods) map[f.id] = f;
    return map;
  }, [customFoods]);

  const [selections, setSelectionsRaw] = useState(() =>
    selData.map((s) => ({ food: allFoods[s.foodId], mult: s.mult })).filter((s) => s.food),
  );

  const setSelections = useCallback((updater) => {
    setSelectionsRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setSelData(next.map((s) => ({ foodId: s.food.id, mult: s.mult })));
      return next;
    });
  }, [setSelData]);

  const weightKg = parseFloat(weight);
  const heightCm = parseFloat(height);
  const weightOk = !isNaN(weightKg) && weightKg >= 20 && weightKg <= 200;
  const imc = weightOk && heightCm > 50 ? calcIMC(weightKg, heightCm) : null;

  const toggleFood = useCallback((food) => {
    setSelections((prev) => {
      const ex = prev.find((s) => s.food.id === food.id);
      if (ex) return prev.filter((s) => s.food.id !== food.id);
      const profile = QTY_PROFILES[food.qty] || QTY_PROFILES['plat'];
      const defaultM = profile.find((s) => Math.abs(s.m - 1) < 0.01)?.m || profile[Math.floor(profile.length / 2)].m;
      return [...prev, { food, mult: defaultM }];
    });
  }, [setSelections]);

  const updateMult = useCallback((id, mult) => {
    setSelections((prev) => prev.map((s) => (s.food.id === id ? { ...s, mult: Math.max(0.25, Math.min(mult, 10)) } : s)));
  }, [setSelections]);

  const clearSelections = useCallback(() => setSelections([]), [setSelections]);

  // ─── Photo ──────────────────────────────────────────────────────────────────
  const [lastPhotoThumbnail, setLastPhotoThumbnail] = useState(null);
  const handlePhotoMeal = useCallback(async (file) => {
    if (!groqApiKey) throw new Error(t('cleApiGroqManquante'));
    const thumb = await compressImage(file, 80);
    const reader = new FileReader();
    reader.onloadend = () => setLastPhotoThumbnail(reader.result);
    reader.readAsDataURL(thumb);
    const results = await recognizeFood(file, groqApiKey);
    return mapToLocalFoods(results, allFoods);
  }, [allFoods, groqApiKey, t]);

  const selectionsMap = useMemo(() => {
    const map = {};
    selections.forEach((s) => { map[s.food.id] = { mult: s.mult }; });
    return map;
  }, [selections]);
  const foodsFlat = useMemo(() => Object.values(FOOD_DB).flat(), []);

  // ─── Journal ────────────────────────────────────────────────────────────────
  const entryDateFor = useCallback((heure) => {
    const now = new Date();
    let d = combineDateAndTime(now, heure);
    // Une heure saisie « dans le futur » (ex. 23:30 saisi à 00:10) appartient à la veille.
    if (d.getTime() - now.getTime() > 5 * 60000) d = new Date(d.getTime() - 86400000);
    return d;
  }, []);

  const onSaveToJournal = useCallback((entry) => {
    const date = entryDateFor(entry.heure);
    const fullEntry = {
      id: newId(),
      schemaVersion: 7,
      source: 'manual',
      mealType: entry.mealType || ((entry.totalGlucides ?? 0) > 0 ? 'repas' : 'injection'),
      ...entry,
      date: toLocalISO(date),
      doseReelle: entry.doseReelle ?? entry.doseSuggeree,
      doseActual: entry.doseActual ?? entry.doseReelle ?? entry.doseSuggeree,
      glycPost: null,
      photoThumbnail: lastPhotoThumbnail || null,
      insulinProfileId: insulinProfile.id,
    };
    setLastPhotoThumbnail(null);
    setJournal((prev) => [fullEntry, ...prev]);
    if (notifEnabled) scheduleEntryReminders(fullEntry, { now: new Date() });
    else scheduleEntryReminders({ ...fullEntry, totalGlucides: 0, doseReelle: 0 }, { now: new Date() });
    clearSelections();
    return fullEntry;
  }, [entryDateFor, lastPhotoThumbnail, insulinProfile.id, setJournal, notifEnabled, clearSelections]);

  const onLogHypo = useCallback(({ glycemia: g, carbsG = 15, heure }) => {
    const date = entryDateFor(heure);
    const entry = {
      id: newId(), schemaVersion: 7, source: 'manual', date: toLocalISO(date), heure: heure ?? null,
      mealType: 'hypo', glycPre: g, totalGlucides: carbsG, doseSuggeree: 0, doseReelle: 0, doseActual: 0,
      hypoTreatment: { carbsG, recheckAt: new Date(date.getTime() + 15 * 60000).toISOString(), recheckValue: null },
      notes: '',
    };
    setJournal((prev) => [entry, ...prev]);
    scheduleHypoRecheck(new Date(), entry.id);
    return entry;
  }, [entryDateFor, setJournal]);

  const onLogBasal = useCallback((units) => {
    const entry = {
      id: newId(), schemaVersion: 7, source: 'manual', date: toLocalISO(new Date()), mealType: 'basal', injectionType: 'basal',
      doseSuggeree: 0, doseReelle: units, doseActual: units, notes: '',
    };
    setJournal((prev) => [entry, ...prev]);
    return entry;
  }, [setJournal]);

  const onImportProfile = useCallback((profile) => {
    for (const key of SETTINGS_KEYS) {
      if (key === 'groqApiKey' || !(key in profile)) continue;
      const storageKey = key === 'customFoods' ? 'custom_foods' : key;
      try { localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(profile[key])); } catch { /* quota */ }
    }
    setTimeout(() => window.location.reload(), 1200);
  }, []);

  const now = new Date();
  const nightActive = nightModeEnabled && isNightHour(now.getHours(), nightStart, nightEnd);

  if (!onboarded) {
    return (
      <Onboarding
        setPatientName={setPatientName} setAge={setAge} setSex={setSex} setHeight={setHeight} setWeight={setWeight}
        setRatio={setRatio} setIsf={setIsf} setTargetGMin={setTargetGMin} setTargetGMax={setTargetGMax}
        setInsulinBasal={setInsulinBasal} setInsulinRapid={setInsulinRapid}
        onComplete={() => setOnboarded(true)} t={t} isDark={isDark} colors={colors} isRTL={isRTL}
      />
    );
  }

  const bannerClass = (tone) => tone === 'amber'
    ? (isDark ? 'bg-amber-950/30 border-amber-900/40 text-amber-200' : 'bg-amber-50 border-amber-100 text-amber-800')
    : (isDark ? 'bg-teal-950/30 border-teal-900/40 text-teal-100' : 'bg-teal-50 border-teal-100 text-teal-800');

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={`min-h-screen ${isDark ? 'bg-slate-900 text-slate-200' : 'bg-[#F7FAFB] text-slate-800'} font-sans`}>
      <header className={`px-4 py-2 flex items-center justify-between border-b ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div>
          <span className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            InsulinCalc <span className={`text-xs font-mono font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>v{APP_VERSION}</span>
          </span>
          <p className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>build {BUILD_ID}</p>
        </div>
        <div className="flex items-center gap-2">
          {fastingEnabled && (
            <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-indigo-900/40 text-indigo-200' : 'bg-indigo-50 text-indigo-700'}`} aria-label={t('ramadanActiver')}>🌙 {t('ramadanActiver')}</span>
          )}
          {nightActive && (
            <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`} aria-label={t('modeNuitActif')}>🌑 {t('modeNuitActif')}</span>
          )}
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('appSubtitle')}</span>
        </div>
      </header>

      <div role="note" className={`px-4 py-1.5 text-center text-xs ${isDark ? 'bg-red-950/30 text-red-300 border-b border-red-900/30' : 'bg-red-50 text-red-700 border-b border-red-100'}`}>
        ⚕️ {t('disclaimerBanner')}
      </div>

      {updateAvailable && (
        <div className={`px-4 py-2 border-b ${bannerClass('amber')}`}>
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t('miseAJourDisponible')}</p>
              <p className="text-xs opacity-80">{t('miseAJourVersion', { version: remoteVersion?.version || diagnostics.version })}</p>
            </div>
            <button type="button" onClick={applyUpdate} className="shrink-0 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700">
              {t('actualiserMaintenant')}
            </button>
          </div>
        </div>
      )}

      {showWhatsNew && (
        <div className={`px-4 py-2 border-b ${bannerClass('teal')}`}>
          <div className="max-w-lg mx-auto flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t('quoiDeNeuf')} · v{APP_VERSION}</p>
              <ul className="mt-1 space-y-1 text-xs opacity-90">
                {releaseNotes.map((note) => <li key={note}>• {note}</li>)}
              </ul>
            </div>
            <button type="button" onClick={dismissWhatsNew} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${isDark ? 'bg-teal-900/60 text-teal-100' : 'bg-white text-teal-700'}`}>
              {t('fermer')}
            </button>
          </div>
        </div>
      )}

      {missed.length > 0 && (
        <section aria-label={t('rappelsManques')} className={`px-4 py-2 border-b ${bannerClass('amber')}`}>
          <div className="max-w-lg mx-auto">
            <p className="text-sm font-semibold">🔔 {t('rappelsManques')}</p>
            <p className="text-xs opacity-80">{t('rappelsManquesDesc')}</p>
            <ul className="mt-1 space-y-1">
              {missed.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>{t(r.titleCode, r.params)} : {t(r.bodyCode, r.params)}</span>
                  <button type="button" onClick={() => acknowledge(r.id)} className={`shrink-0 rounded-lg px-2 py-1 font-semibold ${isDark ? 'bg-amber-900/60 text-amber-100' : 'bg-white text-amber-800'}`}>
                    {t('rappelFait')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <main className="max-w-lg mx-auto pb-24 px-0 sm:px-2">
        {tab === 'accueil' && (
          <ConsultationScreen
            glycemia={glycemia} setGlycemia={setGlycemia}
            ratio={ratio} isf={isf} targetGMin={targetGMin} targetGMax={targetGMax}
            postKeto={postKeto} slowDigestion={slowDigestion}
            insulinProfile={insulinProfile}
            weight={weightOk ? weightKg : null}
            maxDoseU={maxDoseU}
            night={{ enabled: nightModeEnabled, start: nightStart, end: nightEnd, correctionMin: nightCorrectionMin }}
            fasting={{ enabled: fastingEnabled, suhoorFactor: 1 - fastingSuhoorReductionPct / 100 }}
            basalDose={basalDose}
            journal={journal} journalReady={journalReady}
            selections={selectionsMap} foods={foodsFlat} customFoods={customFoods}
            toggleFood={toggleFood} updateMult={updateMult}
            timeProfiles={timeProfiles}
            onSaveToJournal={onSaveToJournal} onLogHypo={onLogHypo} onLogBasal={onLogBasal}
            onPhotoMeal={handlePhotoMeal}
            onSaveCustomFood={(food) => setCustomFoods((prev) => [...prev, food])}
            setTab={setTab}
            t={t} isRTL={isRTL} isDark={isDark} locale={locale}
          />
        )}
        {tab === 'journal' && (
          <DayTimeline
            journal={journal} setJournal={setJournal}
            targetGMin={targetGMin} targetGMax={targetGMax}
            insulinProfile={insulinProfile}
            t={t} isDark={isDark} locale={locale}
          />
        )}
        {tab === 'rapports' && (
          <Suspense fallback={<p className={`p-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>…</p>}>
            <ReportsScreen
              journal={journal} targetGMin={targetGMin} targetGMax={targetGMax} ratio={ratio} isf={isf}
              patientName={patientName} insulinRapid={insulinProfile.name} basalDose={basalDose}
              t={t} isDark={isDark} locale={locale}
            />
          </Suspense>
        )}
        {tab === 'reglages' && (
          <Settings
            ratio={ratio} setRatio={setRatio} isf={isf} setIsf={setIsf}
            targetGMin={targetGMin} setTargetGMin={setTargetGMin} targetGMax={targetGMax} setTargetGMax={setTargetGMax} targetGMid={targetGMid}
            patientName={patientName} setPatientName={setPatientName}
            weight={weight} setWeight={setWeight} height={height} setHeight={setHeight} age={age} setAge={setAge} sex={sex} setSex={setSex}
            imc={imc}
            notifEnabled={notifEnabled} setNotifEnabled={setNotifEnabled}
            theme={theme} setTheme={setTheme} isDark={isDark} toggleTheme={toggleTheme}
            locale={locale} setLocale={setLocale}
            timeProfiles={timeProfiles} setTimeProfiles={setTimeProfiles}
            journal={journal} onImportJournal={importEntries} onImportProfile={onImportProfile} storageMode={storageMode}
            insulinBasal={insulinBasal} setInsulinBasal={setInsulinBasal}
            insulinRapid={insulinRapid} setInsulinRapid={setInsulinRapid}
            insulinProfileId={insulinProfileId} setInsulinProfileId={setInsulinProfileId} insulinProfile={insulinProfile}
            basalDose={basalDose} setBasalDose={setBasalDose}
            basalReminderTime={basalReminderTime} setBasalReminderTime={setBasalReminderTime}
            postKeto={postKeto} setPostKeto={setPostKeto}
            slowDigestion={slowDigestion} setSlowDigestion={setSlowDigestion}
            dia={dia} setDia={setDia}
            maxDoseU={maxDoseU} setMaxDoseU={setMaxDoseU}
            nightModeEnabled={nightModeEnabled} setNightModeEnabled={setNightModeEnabled}
            nightStart={nightStart} setNightStart={setNightStart} nightEnd={nightEnd} setNightEnd={setNightEnd}
            nightCorrectionMin={nightCorrectionMin} setNightCorrectionMin={setNightCorrectionMin}
            fastingEnabled={fastingEnabled} setFastingEnabled={setFastingEnabled}
            fastingSuhoorReductionPct={fastingSuhoorReductionPct} setFastingSuhoorReductionPct={setFastingSuhoorReductionPct}
            fastingBasalReductionPct={fastingBasalReductionPct} setFastingBasalReductionPct={setFastingBasalReductionPct}
            groqApiKey={groqApiKey} setGroqApiKey={setGroqApiKey}
            diagnostics={diagnostics} updateAvailable={updateAvailable} releaseNotes={releaseNotes}
            onCheckForUpdates={checkForUpdates} onApplyUpdate={applyUpdate}
            t={t} colors={colors} isRTL={isRTL}
          />
        )}
      </main>

      <BottomNav3 tab={tab} setTab={setTab} t={t} />

      {inAppNotif && (
        <div role="status" aria-live="polite" className="fixed top-2 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
          <button type="button" onClick={() => setInAppNotif(null)} className={`w-full text-left rounded-2xl p-3 shadow-lg border ${isDark ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
            <p className={`text-sm font-bold ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>🔔 {inAppNotif.title}</p>
            <p className={`text-xs mt-1 whitespace-pre-line ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>{inAppNotif.body}</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-blue-300' : 'text-blue-500'}`}>{t('tapPourFermer')}</p>
          </button>
        </div>
      )}
    </div>
  );
}
