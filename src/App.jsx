import { useState, useMemo, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useTheme } from './hooks/useTheme.js';
import { useI18n } from './i18n/useI18n.js';
import { round05, calcWeightSuggestions, getOverallFat, getDominantGI, buildSchedule, calcIMC, calcBSA, calcBMR, calcIOB } from './utils/calculations.js';
import { applySafetyRules, isNightMode } from './utils/clinicalEngine.js';
import { SPACE, FONT, GI_ICON, GI_COLOR, glycColor, glycLabel, stripDiacritics } from './utils/colors.js';
import { QTY_PROFILES, DIGESTION_PROFILES, FAT_FACTOR } from './data/constants.js';
import FOOD_DB from './data/foods.js';
import { schedulePostMealReminder } from './utils/notifications.js';
import { generateJournalPdf } from './utils/exportPdf.js';
import { addEntry, getEntries, getAllEntries } from './data/journalStore.js';
import { migrateData } from './utils/migration.js';

import TabNav from './components/TabNav.jsx';
import QtyStepper from './components/QtyStepper.jsx';
import FoodList from './components/FoodList.jsx';
import ResultCard from './components/ResultCard.jsx';
import ReglagesPanel from './components/ReglagesPanel.jsx';
import FavoriteMeals from './components/FavoriteMeals.jsx';
import CustomFoodForm from './components/CustomFoodForm.jsx';
import Onboarding from './components/Onboarding.jsx';
import PhotoMeal from './components/PhotoMeal.jsx';
import JournalTab from './components/JournalTab.jsx';
import NightModeIndicator from './components/NightModeIndicator.jsx';

// Run migrations before app renders (idempotent)
migrateData();

export default function App() {
  const { theme, colors: cc, toggleTheme } = useTheme();
  const { t, locale, setLocale, isRTL } = useI18n();

  const [onboarded, setOnboarded] = useLocalStorage("onboarded", false);

  // Core state
  const [tab, setTab] = useState("repas");
  const [glycemia, setGlycemia] = useLocalStorage("glycemia", "");
  const [search, setSearch] = useState("");
  const [openCat, setOpenCat] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [ratio, setRatio] = useLocalStorage("ratio", 10);
  const [isf, setIsf] = useLocalStorage("isf", 50);
  const [targetGMin, setTargetGMin] = useLocalStorage("targetGMin", 0.8);
  const [targetGMax, setTargetGMax] = useLocalStorage("targetGMax", 1.3);
  const targetGMid = Math.round(((targetGMin + targetGMax) / 2) * 100) / 100;
  const [digestion, setDigestion] = useLocalStorage("digestion", "normal");
  const [weight, setWeight] = useLocalStorage("weight", "");
  const [maxDose, setMaxDose] = useLocalStorage("maxDose", 20);

  // Profile fields (Fix #10, #11)
  const [height, setHeight] = useLocalStorage("height", "");
  const [age, setAge] = useLocalStorage("age", "");
  const [sex, setSex] = useLocalStorage("sex", "M");
  const [patientName, setPatientName] = useLocalStorage("patientName", "");
  const [notifEnabled, setNotifEnabled] = useLocalStorage("notifEnabled", false);
  const [notifDelay, setNotifDelay] = useLocalStorage("notifDelay", 120);

  // Journal refresh trigger (journalStore is the single source of truth)
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);
  const refreshJournal = useCallback(() => setJournalRefreshKey(k => k + 1), []);

  const [selData, setSelData] = useLocalStorage("selections", []);
  const [favorites, setFavorites] = useLocalStorage("favorites", []);
  const [customFoods, setCustomFoods] = useLocalStorage("custom_foods", []);
  const [showAddForm, setShowAddForm] = useState(false);

  // Sorted food DB (Fix #7)
  const sortedDB = useMemo(() => {
    const sorted = {};
    const keys = Object.keys(FOOD_DB).sort((a, b) => a.localeCompare(b, 'fr'));
    for (const key of keys) {
      sorted[key] = [...FOOD_DB[key]].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    return sorted;
  }, []);

  // Recent foods from journal (Fix #7) — reads from journalStore
  const recentFoodIds = useMemo(() => {
    const recentEntries = getEntries(7);
    const ids = [];
    for (const entry of recentEntries) {
      if (entry.foods) {
        for (const f of entry.foods) {
          if (f.foodId && !ids.includes(f.foodId)) ids.push(f.foodId);
          if (ids.length >= 5) break;
        }
      }
      if (ids.length >= 5) break;
    }
    return ids;
  }, [journalRefreshKey]);

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
      const next = typeof updater === "function" ? updater(prev) : updater;
      setSelData(next.map(s => ({ foodId: s.food.id, mult: s.mult })));
      return next;
    });
  }, [setSelData]);

  const weightKg = parseFloat(weight);
  const heightCm = parseFloat(height);
  const ageNum = parseInt(age);
  const weightOk = !isNaN(weightKg) && weightKg >= 20 && weightKg <= 200;
  const wSugg = weightOk ? calcWeightSuggestions(weightKg, ageNum, sex) : null;

  // BMI calculations (Fix #10)
  const imc = (weightOk && heightCm > 50) ? calcIMC(weightKg, heightCm) : null;
  const bsa = (weightOk && heightCm > 50) ? calcBSA(weightKg, heightCm) : null;
  const bmr = (weightOk && heightCm > 50 && ageNum > 0) ? calcBMR(weightKg, heightCm, ageNum, sex) : null;

  const filteredDB = useMemo(() => {
    if (!search.trim()) return sortedDB;
    const q = stripDiacritics(search.toLowerCase());
    const out = {};
    for (const [cat, foods] of Object.entries(sortedDB)) {
      const f = foods.filter(fd =>
        stripDiacritics(fd.name.toLowerCase()).includes(q) ||
        (fd.note && stripDiacritics(fd.note.toLowerCase()).includes(q))
      );
      if (f.length) out[cat] = f;
    }
    return out;
  }, [search, sortedDB]);

  const totalCarbs = useMemo(() => Math.round(selections.reduce((s, sel) => s + sel.food.carbs * sel.mult, 0)), [selections]);
  const dominantFat = useMemo(() => getOverallFat(selections), [selections]);
  const dominantGI = useMemo(() => getDominantGI(selections), [selections]);

  const gVal = parseFloat(glycemia);
  const glycOk = !isNaN(gVal) && gVal >= 0.3 && gVal <= 6.0;
  const glycOutOfBounds = glycemia !== "" && !isNaN(gVal) && (gVal < 0.3 || gVal > 6.0);
  const canCalc = glycOk && totalCarbs > 0;

  const toggleFood = useCallback((food) => {
    setSelections(prev => {
      const ex = prev.find(s => s.food.id === food.id);
      if (ex) { setExpandedId(null); return prev.filter(s => s.food.id !== food.id); }
      const profile = QTY_PROFILES[food.qty] || QTY_PROFILES["plat"];
      const defaultM = profile.find(s => Math.abs(s.m - 1) < 0.01)?.m || profile[Math.floor(profile.length / 2)].m;
      setExpandedId(food.id);
      return [...prev, { food, mult: defaultM }];
    });
  }, [setSelections]);

  const updateMult = useCallback((id, mult) => {
    const clamped = Math.max(0.25, Math.min(mult, 10));
    setSelections(prev => prev.map(s => s.food.id === id ? { ...s, mult: clamped } : s));
  }, [setSelections]);

  const loadFavorite = (fav) => {
    const loaded = fav.items
      .map(item => ({ food: allFoods[item.foodId], mult: item.mult }))
      .filter(s => s.food);
    setSelections(loaded);
  };

  const handleAddCustomFood = (food) => {
    setCustomFoods(prev => [...prev, food]);
    setShowAddForm(false);
  };

  const handleDeleteCustomFood = (id) => {
    setCustomFoods(prev => prev.filter(f => f.id !== id));
    setSelections(prev => prev.filter(s => s.food.id !== id));
  };

  // Auto-calculate (Fix #5) — derived state via useMemo
  const result = useMemo(() => {
    if (!canCalc) return null;
    const bolusRepas = totalCarbs / ratio;
    const ecart = gVal - targetGMid;
    const correction = ecart > 0 ? (ecart * 100) / isf : 0;
    const fatBonus = (totalCarbs / ratio) * FAT_FACTOR[dominantFat];
    const total = round05(bolusRepas + correction + fatBonus);
    const hasFat = dominantFat === "élevé" || dominantFat === "moyen";
    const bolusType = hasFat ? "dual" : "standard";
    const schedule = buildSchedule(totalCarbs, bolusRepas, correction, fatBonus, gVal, targetGMid, digestion, bolusType, dominantGI);
    const warnings = [];
    if (gVal < 1.0) warnings.push({ t: "w", txt: t("glycemieBasse") });
    if (gVal > 2.0) warnings.push({ t: "w", txt: t("glycemieElevee") });
    if (bolusType === "dual") warnings.push({ t: "i", txt: t("repasGras") });
    if (dominantGI === "élevé") warnings.push({ t: "c", txt: t("igEleve") });
    if (total > 20) warnings.push({ t: "w", txt: t("doseElevee") });

    // ── Clinical Safety Engine ──
    const now = new Date();
    const currentHour = now.getHours();
    const recentEntries = getEntries(1); // last 24h
    const insulinDurationMin = 240; // 4h standard insulin action

    // Compute IOB from recent journal entries
    const iobTotal = recentEntries.reduce((sum, entry) => {
      const entryTime = new Date(entry.date).getTime();
      const minutesAgo = (now.getTime() - entryTime) / 60000;
      if (minutesAgo >= insulinDurationMin || minutesAgo < 0) return sum;
      const dose = entry.doseInjected || entry.doseCalculated || 0;
      if (dose <= 0) return sum;
      return sum + calcIOB(dose, minutesAgo, insulinDurationMin);
    }, 0);

    // Time since most recent injection
    const lastInjectionMinAgo = recentEntries.length > 0
      ? (now.getTime() - new Date(recentEntries[0].date).getTime()) / 60000
      : 999;

    // Sum of corrections in last 24h
    const cumulCorrections24h = recentEntries.reduce((sum, entry) => {
      return sum + (entry.correction || 0);
    }, 0);

    // Estimated TDD: from weight suggestions or sum of last 7 days / 7
    const weekEntries = getEntries(7);
    let tddEstimated = 30; // default
    const weightSugg = weight ? calcWeightSuggestions(Number(weight), Number(age), sex) : null;
    if (weightSugg) {
      tddEstimated = weightSugg.tdd;
    } else if (weekEntries.length >= 3) {
      const totalDoses = weekEntries.reduce((s, e) => s + (e.doseInjected || e.doseCalculated || 0), 0);
      tddEstimated = Math.round(totalDoses / 7);
    }

    const safety = applySafetyRules({
      glycemia: gVal,
      suggestedDose: total,
      iobTotal,
      currentHour,
      lastInjectionMinAgo,
      cumulCorrections24h,
      tddEstimated,
      correction,
      maxDose,
    });

    // Apply safety adjustments
    let safeTotal = total;
    let safeCorrection = +correction.toFixed(1);
    if (safety.blocked) {
      safeTotal = 0;
      safeCorrection = 0;
    } else if (safety.correctionBlocked) {
      safeCorrection = 0;
      safeTotal = round05(total - correction);
    } else {
      safeCorrection = safety.adjustedCorrection;
      safeTotal = safety.adjustedDose;
    }

    // Add safety warnings to existing warnings
    for (const sw of safety.warnings) {
      warnings.push({ t: sw.severity === 'critical' ? 'w' : sw.severity === 'warning' ? 'w' : 'i', txt: sw.message });
    }

    return {
      total: safeTotal,
      bolusType,
      warnings,
      schedule,
      bolusRepas: +bolusRepas.toFixed(1),
      correction: safeCorrection,
      fatBonus: +fatBonus.toFixed(1),
      nightMode: safety.nightMode,
      blocked: safety.blocked,
      correctionBlocked: safety.correctionBlocked,
    };
  }, [canCalc, totalCarbs, ratio, gVal, targetGMid, isf, dominantFat, dominantGI, digestion, t, journalRefreshKey, weight, age, sex, maxDose]);

  // Save to journal — explicit via bouton Enregistrer (accepts actual dose)
  const saveToJournal = useCallback((doseActual, dosagePlan) => {
    if (!result) return;
    const h = new Date().getHours();
    const mealType = h < 10 ? 'petit-déjeuner' : h < 15 ? 'déjeuner' : h < 18 ? 'collation' : 'dîner';
    const entryData = {
      mealType,
      preMealGlycemia: gVal,
      foods: selections.map(s => ({
        foodId: s.food.id,
        name: s.food.name,
        mult: s.mult,
        carbs: Math.round(s.food.carbs * s.mult),
      })),
      totalCarbs,
      doseCalculated: result.total,
      doseInjected: doseActual != null ? doseActual : result.total,
      correction: result.correction,
      notes: '',
    };
    if (dosagePlan) entryData.dosagePlan = dosagePlan;
    addEntry(entryData);
    refreshJournal();

    if (notifEnabled) {
      schedulePostMealReminder(notifDelay);
    }
  }, [result, gVal, selections, totalCarbs, notifEnabled, notifDelay, refreshJournal]);

  // Reset (Fix #5)
  const resetMeal = () => {
    setSelections([]);
    setGlycemia("");
    setExpandedId(null);
    setSearch("");
    setOpenCat(null);
    setTab("repas");
  };

  const handleOnboardingComplete = ({ weight: w, icr, isf: isfVal, targetGMin: tgMin, targetGMax: tgMax, patientName: pn, age: a, sex: s, height: h, locale: loc }) => {
    setWeight(String(w));
    setRatio(icr);
    setIsf(isfVal);
    if (tgMin !== undefined) setTargetGMin(tgMin);
    if (tgMax !== undefined) setTargetGMax(tgMax);
    if (pn !== undefined) setPatientName(pn);
    if (a !== undefined && a !== '') setAge(String(a));
    if (s !== undefined) setSex(s);
    if (h !== undefined && h !== '') setHeight(String(h));
    if (loc !== undefined) setLocale(loc);
    setOnboarded(true);
  };

  const handleExportPdf = useCallback(() => {
    const allJournal = getAllEntries();
    // Map journalStore entries to the format exportPdf expects
    const pdfEntries = allJournal.map(e => ({
      date: e.date,
      repas: e.mealType || '—',
      glycPre: e.preMealGlycemia != null ? e.preMealGlycemia.toFixed(2) : '—',
      glycPost: e.postMealGlycemia != null ? e.postMealGlycemia.toFixed(2) : '',
      dose: e.doseInjected || e.doseCalculated || 0,
      aliments: e.foods?.map(f => f.name).join(', ') || '—',
    }));
    const glycValues = allJournal.map(e => e.preMealGlycemia).filter(v => v != null && !isNaN(v));
    const tirEntries = glycValues.filter(v => v >= targetGMin && v <= targetGMax);
    const moyenne = glycValues.length > 0 ? (glycValues.reduce((a, b) => a + b, 0) / glycValues.length).toFixed(2) : null;
    const tir = glycValues.length > 0 ? Math.round((tirEntries.length / glycValues.length) * 100) : null;
    const hba1c = moyenne ? ((parseFloat(moyenne) * 100 + 46.7) / 28.7).toFixed(1) : null;
    const stats = { moyenne, tir, hba1c, count: allJournal.length };
    generateJournalPdf(pdfEntries, t("toutesEntrees"), stats, patientName);
  }, [targetGMin, targetGMax, patientName, t]);


  if (!onboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} t={t} locale={locale} setLocale={setLocale} isRTL={isRTL} />;
  }

  const isDark = theme === 'dark';
  const card = { background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 14, padding: SPACE.xl, marginBottom: SPACE.md };
  const lbl = { fontSize: FONT.xs, letterSpacing: 2, color: cc.muted, textTransform: "uppercase", marginBottom: SPACE.sm, display: "block" };
  const inp = { width: "100%", background: isDark ? "#070c12" : '#f8fafc', border: `1px solid ${cc.border}`, borderRadius: 8, color: cc.text, padding: "11px 14px", fontSize: FONT.md, fontFamily: "'IBM Plex Mono',monospace", outline: "none", boxSizing: "border-box" };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: cc.bg, fontFamily: "'IBM Plex Mono',monospace", color: cc.text }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        input:focus{border-color:${cc.accent}!important;box-shadow:0 0 0 2px ${cc.accent}22;}
        .fr:hover{background:${cc.accent}08!important;}
        .cb:hover{color:${isDark ? '#7dd3fc' : cc.accent}!important;}
        .tb:hover{color:${isDark ? '#7dd3fc' : cc.accent}!important;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:${cc.border};border-radius:99px;}
      `}</style>

      {/* DISCLAIMER LEGAL */}
      <div style={{ background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)', borderBottom: `1px solid ${isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'}`, padding: '6px 20px' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', fontSize: 10, color: isDark ? '#fca5a5' : '#b91c1c', lineHeight: 1.5, textAlign: 'center' }}>
          ⚕️ {t("disclaimerBanner")}
        </div>
      </div>

      {/* HEADER */}
      <div style={{ background: isDark ? "linear-gradient(180deg,#0d1117,transparent)" : 'linear-gradient(180deg,#fff,transparent)', padding: "24px 20px 14px", borderBottom: `1px solid ${cc.faint}` }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {patientName && (
              <div style={{ fontSize: 13, color: cc.accent, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{t("bonjour")} {patientName} 👋</span>
                <NightModeIndicator active={isNightMode(new Date().getHours())} t={t} colors={cc} />
              </div>
            )}
            {!patientName && (
              <NightModeIndicator active={isNightMode(new Date().getHours())} t={t} colors={cc} />
            )}
            <div style={{ fontSize: 21, fontWeight: 700, fontFamily: "'Syne Mono',monospace", color: isDark ? "#e2edf5" : '#1a202c', letterSpacing: -0.5 }}>{t("appName")}</div>
            <div style={{ fontSize: 12, color: cc.muted, letterSpacing: 2, textTransform: "uppercase", marginTop: 3 }}>{t("appSubtitle")}</div>
          </div>
          <div style={{ background: cc.adim, border: `1px solid ${cc.accent}40`, borderRadius: 10, padding: "8px 14px", textAlign: isRTL ? "left" : "right" }}>
            <div style={{ fontSize: 12, color: cc.muted, letterSpacing: 1 }}>{t("glucides")}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: cc.accent, fontFamily: "'Syne Mono',monospace", lineHeight: 1.1 }}>{totalCarbs}g</div>
            {selections.length > 0 && <div style={{ fontSize: 12, color: cc.muted }}>{selections.length} {selections.length > 1 ? t("aliments") : t("aliment")}</div>}
          </div>
        </div>
      </div>

      {/* TABS */}
      <TabNav tab={tab} setTab={setTab} selections={selections} className="no-print" colors={cc} theme={theme} journalCount={getAllEntries().length} t={t} />

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "14px 20px 100px" }}>

        {/* === REPAS === */}
        {tab === "repas" && (<>
          <FavoriteMeals
            selections={selections}
            favorites={favorites}
            setFavorites={setFavorites}
            onLoadFavorite={loadFavorite}
            t={t} colors={cc} theme={theme}
          />

          {/* Saisie rapide */}
          <div style={{ ...card, borderColor: `${cc.accent}40`, padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, letterSpacing: 1.5, color: "#22c55e", marginBottom: 6, textTransform: "uppercase" }}>⚖ {t("poidsKg")} ({t("uniteKg")})</div>
                <input type="number" step="0.5" min="20" max="200" placeholder="68" inputMode="decimal" aria-label={t("poids")}
                  value={weight} onChange={e => setWeight(e.target.value)}
                  style={{ ...inp, fontSize: 20, padding: "10px 8px", fontWeight: 700, color: weightOk ? "#22c55e" : cc.text, textAlign: "center", borderRadius: 10 }} />
                {wSugg && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 4, textAlign: "center" }}>TDD ~{wSugg.tdd}U/j · ICR 1U/{wSugg.icr}g · ISF {wSugg.isfMg}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, letterSpacing: 1.5, color: cc.accent, marginBottom: 6, textTransform: "uppercase" }}>🩸 {t("glycemie")} ({t("uniteGL")})</div>
                <input type="number" step="0.1" min="0.1" max="6" placeholder="1.40" inputMode="decimal" aria-label={t("glycemieGL")}
                  value={glycemia} onChange={e => setGlycemia(e.target.value)}
                  style={{ ...inp, fontSize: 20, padding: "10px 8px", fontWeight: 700, color: glycColor(gVal), textAlign: "center", borderRadius: 10 }} />
                {glycOk && <div style={{ fontSize: 12, color: glycColor(gVal), marginTop: 4, textAlign: "center" }}>{glycLabel(gVal)} · {t("ecartCible").toLowerCase()} {gVal > targetGMid ? "+" : ""}{(gVal - targetGMid).toFixed(2)}</div>}
                {glycOutOfBounds && (
                  <div style={{ fontSize: 12, color: cc.red, marginTop: 4, textAlign: "center" }}>{t("glycemieHorsBornes")}</div>
                )}
              </div>
            </div>
            {wSugg && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => setRatio(wSugg.icr)} style={{ flex: 1, padding: "6px", border: `1px solid ${cc.accent}4D`, borderRadius: 8, background: `${cc.accent}0F`, color: isDark ? "#7dd3fc" : cc.accent, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer" }}>
                  ✓ Ratio 1U/{wSugg.icr}g
                </button>
                <button onClick={() => setIsf(wSugg.isfMg)} style={{ flex: 1, padding: "6px", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, background: "rgba(245,158,11,0.06)", color: "#fcd34d", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer" }}>
                  ✓ ISF {wSugg.isfMg}mg/dL
                </button>
              </div>
            )}
          </div>

          {selections.length > 0 && (
            <div style={{ ...card, borderColor: `${cc.accent}4D` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ ...lbl, color: cc.accent, marginBottom: 0 }}>🧰 {t("monRepas")} ({selections.length} {selections.length > 1 ? t("aliments") : t("aliment")})</div>
                <button onClick={resetMeal} style={{ background: "none", border: `1px solid ${cc.border}`, borderRadius: 6, padding: "4px 10px", color: cc.muted, fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace" }}>
                  {t("nouveauRepas")}
                </button>
              </div>
              <div style={{ marginTop: 8 }}>
              {selections.map((s) => (
                <div key={s.food.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${cc.faint}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: isDark ? "#9ab8cc" : '#334155', whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.food.name}</div>
                      <div style={{ fontSize: 12, color: cc.muted, marginTop: 1 }}>{GI_ICON[s.food.gi]} IG {s.food.gi}{s.mult !== 1 && <span style={{ color: cc.accent }}> · {(QTY_PROFILES[s.food.qty] || QTY_PROFILES["plat"]).find(p => Math.abs(p.m - s.mult) < 0.01)?.l || `×${s.mult}`}</span>}</div>
                    </div>
                    <button onClick={() => setExpandedId(expandedId === s.food.id ? null : s.food.id)} style={{ background: expandedId === s.food.id ? `${cc.accent}26` : (isDark ? "#131d2b" : '#f1f5f9'), border: `1px solid ${expandedId === s.food.id ? cc.accent : cc.border}`, borderRadius: 7, color: expandedId === s.food.id ? cc.accent : cc.muted, fontSize: 12, padding: "5px 9px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {(QTY_PROFILES[s.food.qty] || QTY_PROFILES["plat"]).find(p => Math.abs(p.m - s.mult) < 0.01)?.l || `×${s.mult}`} ✎
                    </button>
                    <div style={{ fontSize: 13, color: cc.accent, minWidth: 40, textAlign: isRTL ? "left" : "right", fontWeight: 700 }}>{Math.round(s.food.carbs * s.mult)}g</div>
                    <button onClick={() => toggleFood(s.food)} style={{ background: "none", border: "none", color: cc.muted, cursor: "pointer", fontSize: 18, padding: "0 2px", lineHeight: 1 }}>×</button>
                  </div>
                  {expandedId === s.food.id && <QtyStepper food={s.food} mult={s.mult} onChange={m => updateMult(s.food.id, m)} t={t} />}
                </div>
              ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${cc.border}`, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: cc.muted }}>{t("totalGlucides")}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: cc.accent }}>{totalCarbs}g</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {[{ label: t("indexGlycemique"), val: dominantGI, color: GI_COLOR[dominantGI], icon: GI_ICON[dominantGI] }, { label: t("graisses"), val: dominantFat, color: dominantFat === "élevé" ? cc.yellow : dominantFat === "moyen" ? "#a78bfa" : cc.green, icon: dominantFat === "élevé" ? "🔶" : dominantFat === "moyen" ? "🟣" : "🟢" }].map((it, i) => (
                  <div key={i} style={{ flex: 1, background: isDark ? "#070c12" : '#f8fafc', borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 12, color: cc.muted, marginBottom: 3 }}>{it.label}</div>
                    <div style={{ fontSize: 12, color: it.color, fontWeight: 600 }}>{it.icon} {it.val.charAt(0).toUpperCase() + it.val.slice(1)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Digestion */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={lbl}>{t("vitesseDigestion")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {Object.entries(DIGESTION_PROFILES).map(([key, dp]) => (
                <button key={key} onClick={() => setDigestion(key)} style={{ padding: "10px", border: `1px solid ${digestion === key ? cc.accent : cc.border}`, borderRadius: 10, background: digestion === key ? `${cc.accent}18` : (isDark ? "#070c12" : '#f8fafc'), color: digestion === key ? (isDark ? "#7dd3fc" : cc.accent) : cc.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer", textAlign: isRTL ? "right" : "left", transition: "all 0.15s" }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{dp.icon}</div>
                  <div style={{ fontWeight: digestion === key ? 700 : 400, marginBottom: 2 }}>{dp.label}</div>
                  <div style={{ fontSize: 12, color: digestion === key ? cc.muted : (isDark ? "#2d3f50" : '#94a3b8'), lineHeight: 1.3 }}>{t("picMin")} {dp.peakMin}min · {t("finAction")} {Math.round(dp.tail / 60 * 10) / 10}h</div>
                </button>
              ))}
            </div>
          </div>

          {/* Photo recognition */}
          <PhotoMeal
            allFoods={allFoods}
            toggleFood={toggleFood}
            t={t} colors={cc} theme={theme}
          />

          {/* Food list */}
          <FoodList
            search={search}
            setSearch={setSearch}
            filteredDB={filteredDB}
            selections={selections}
            openCat={openCat}
            setOpenCat={setOpenCat}
            expandedId={expandedId}
            toggleFood={toggleFood}
            updateMult={updateMult}
            inp={inp}
            customFoods={customFoods}
            onDeleteCustomFood={handleDeleteCustomFood}
            recentFoodIds={recentFoodIds}
            allFoods={allFoods}
            t={t} colors={cc} theme={theme} isRTL={isRTL}
          />

          {showAddForm ? (
            <CustomFoodForm
              onSave={handleAddCustomFood}
              onCancel={() => setShowAddForm(false)}
              t={t} colors={cc} theme={theme}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                width: "100%", padding: "11px 14px", marginBottom: 6,
                border: `1px dashed ${cc.accent}4D`, borderRadius: 10,
                background: "transparent", color: cc.muted,
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 12,
                cursor: "pointer", textAlign: "center", transition: "all 0.15s",
              }}
            >
              {t("ajouterAlimentPerso")}
            </button>
          )}
        </>)}

        {/* === RESULTAT === */}
        {tab === "resultat" && (
          <ResultCard
            result={result}
            selections={selections}
            totalCarbs={totalCarbs}
            digestion={digestion}
            isf={isf}
            targetGMid={targetGMid}
            maxDose={maxDose}
            setTab={setTab}
            onSaveJournal={saveToJournal}
            t={t} colors={cc} theme={theme}
          />
        )}

        {/* === JOURNAL === */}
        {tab === "journal" && (
          <JournalTab
            selections={selections}
            totalCarbs={totalCarbs}
            doseCalculated={result?.total}
            glycemia={gVal}
            onExportPdf={handleExportPdf}
          />
        )}

        {/* === PARAMETRES === */}
        {tab === "params" && (
          <ReglagesPanel
            ratio={ratio} setRatio={setRatio}
            isf={isf} setIsf={setIsf}
            targetGMin={targetGMin} setTargetGMin={setTargetGMin}
            targetGMax={targetGMax} setTargetGMax={setTargetGMax}
            targetGMid={targetGMid}
            digestion={digestion} setDigestion={setDigestion}
            maxDose={maxDose} setMaxDose={setMaxDose}
            patientName={patientName} setPatientName={setPatientName}
            theme={theme} toggleTheme={toggleTheme} colors={cc}
            notifEnabled={notifEnabled} setNotifEnabled={setNotifEnabled}
            notifDelay={notifDelay} setNotifDelay={setNotifDelay}
            height={height} setHeight={setHeight}
            age={age} setAge={setAge}
            sex={sex} setSex={setSex}
            imc={imc} bsa={bsa} bmr={bmr}
            locale={locale} setLocale={setLocale}
            t={t} isRTL={isRTL}
          />
        )}
      </div>

      {/* STICKY RESULT BAR (Fix #5) */}
      {tab === "repas" && (
        <div className="no-print" style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "10px 20px 16px", background: `linear-gradient(0deg,${cc.bg} 60%,transparent)`, maxWidth: 520, margin: "0 auto" }}>
          {result ? (
            <button onClick={() => { setTab("resultat"); }} style={{ width: "100%", padding: 15, borderRadius: 12, cursor: "pointer", background: `linear-gradient(135deg,${cc.accent},#0a9e8e)`, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'Syne Mono',monospace", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 900 }}>{result.total}U</span>
              <span>· {result.bolusType === "dual" ? t("bolusDual") : t("bolusStandard")}</span>
            </button>
          ) : (
            <button onClick={() => { if (selections.length > 0 && !glycOk) { /* focus glycemia */ } }} style={{ width: "100%", padding: 15, borderRadius: 12, cursor: "default", background: selections.length > 0 ? (isDark ? "linear-gradient(135deg,#1c3a50,#0d2233)" : 'linear-gradient(135deg,#e0f2f1,#b2dfdb)') : cc.card, border: canCalc ? "none" : `1px solid ${cc.border}`, color: selections.length > 0 ? (isDark ? "#7dd3fc" : cc.accent) : cc.muted, fontSize: 13, fontWeight: 700, fontFamily: "'Syne Mono',monospace" }}>
              {selections.length > 0 ? `${totalCarbs}g ${t("glucidesUnit")} · ${t("saisissezGlycemie")}` : `← ${t("selectionnezAliments")}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
