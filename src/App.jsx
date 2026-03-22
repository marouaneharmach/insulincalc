import { useState, useMemo, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useTheme } from './hooks/useTheme.js';
import { useI18n } from './i18n/useI18n.js';
import { round05, calcWeightSuggestions, getOverallFat, getDominantGI, buildSchedule, calcIMC, calcBSA, calcBMR } from './utils/calculations.js';
import { SPACE, FONT, GI_ICON, GI_COLOR, glycColor, glycLabel, stripDiacritics } from './utils/colors.js';
import { QTY_PROFILES, DIGESTION_PROFILES, FAT_FACTOR } from './data/constants.js';
import FOOD_DB from './data/foods.js';
import { schedulePostMealReminder } from './utils/notifications.js';
import { generateJournalPdf } from './utils/exportPdf.js';

import TabNav from './components/TabNav.jsx';
import QtyStepper from './components/QtyStepper.jsx';
import FoodList from './components/FoodList.jsx';
import ResultCard from './components/ResultCard.jsx';
import ReglagesPanel from './components/ReglagesPanel.jsx';
import FavoriteMeals from './components/FavoriteMeals.jsx';
import CustomFoodForm from './components/CustomFoodForm.jsx';
import Onboarding from './components/Onboarding.jsx';

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

  // Journal
  const [journal, setJournal] = useLocalStorage("journal", []);

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

  // Recent foods from journal (Fix #7)
  const recentFoodIds = useMemo(() => {
    const ids = [];
    for (const entry of journal) {
      if (entry.alimentIds) {
        for (const id of entry.alimentIds) {
          if (!ids.includes(id)) ids.push(id);
          if (ids.length >= 5) break;
        }
      }
      if (ids.length >= 5) break;
    }
    return ids;
  }, [journal]);

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
    return { total, bolusType, warnings, schedule, bolusRepas: +bolusRepas.toFixed(1), correction: +correction.toFixed(1), fatBonus: +fatBonus.toFixed(1) };
  }, [canCalc, totalCarbs, ratio, gVal, targetGMid, isf, dominantFat, dominantGI, digestion, t]);

  // Save to journal — explicit via bouton Enregistrer (accepts actual dose)
  const saveToJournal = useCallback((doseActual) => {
    if (!result) return;
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      dateDisplay: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      repas: dominantGI,
      glycPre: gVal.toFixed(2),
      glycPost: '',
      doseSuggested: result.total,
      doseActual: doseActual != null ? doseActual : result.total,
      aliments: selections.map(s => s.food.name).join(', '),
      alimentIds: selections.map(s => s.food.id),
    };
    setJournal(prev => {
      // Don't add duplicate if same foods + glyc in last 2 min
      if (prev.length > 0 && Date.now() - prev[0].id < 120000) return prev;
      return [entry, ...prev].slice(0, 200);
    });

    if (notifEnabled) {
      schedulePostMealReminder(notifDelay);
    }
  }, [result, dominantGI, gVal, selections, notifEnabled, notifDelay, setJournal]);

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

  const handleExportPdf = () => {
    const tirEntries = journal.filter(e => {
      const v = parseFloat(e.glycPre);
      return !isNaN(v) && v >= targetGMin && v <= targetGMax;
    });
    const glycValues = journal.map(e => parseFloat(e.glycPre)).filter(v => !isNaN(v));
    const moyenne = glycValues.length > 0 ? (glycValues.reduce((a, b) => a + b, 0) / glycValues.length).toFixed(2) : null;
    const tir = glycValues.length > 0 ? Math.round((tirEntries.length / glycValues.length) * 100) : null;
    const hba1c = moyenne ? ((parseFloat(moyenne) * 100 + 46.7) / 28.7).toFixed(1) : null;
    const stats = { moyenne, tir, hba1c, count: journal.length };
    generateJournalPdf(journal, t("toutesEntrees"), stats, patientName);
  };

  const updateJournalDoseActual = (entryId, dose) => {
    setJournal(prev => prev.map(e => e.id === entryId ? { ...e, doseActual: dose } : e));
  };

  const updateJournalGlycPost = (entryId, glycPost) => {
    setJournal(prev => prev.map(e => e.id === entryId ? { ...e, glycPost: glycPost } : e));
  };

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
              <div style={{ fontSize: 13, color: cc.accent, marginBottom: 4 }}>{t("bonjour")} {patientName} 👋</div>
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
      <TabNav tab={tab} setTab={setTab} selections={selections} className="no-print" colors={cc} theme={theme} journal={journal} t={t} />

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
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, letterSpacing: 2, color: cc.accent, textTransform: 'uppercase' }}>
                📖 {t("journal")} ({journal.length} {journal.length > 1 ? t("entrees") : t("entree")})
              </div>
              {journal.length > 0 && (
                <button onClick={handleExportPdf} style={{
                  padding: '8px 14px', borderRadius: 8,
                  border: `1px solid ${cc.accent}40`, background: `${cc.accent}12`,
                  color: cc.accent, fontSize: 12, fontFamily: "'IBM Plex Mono',monospace",
                  cursor: 'pointer', fontWeight: 600,
                }}>
                  {t("exporterPdf")}
                </button>
              )}
            </div>

            {/* STATS SUMMARY + CHART */}
            {journal.length >= 2 && (() => {
              const glycVals = journal.map(e => parseFloat(e.glycPre)).filter(v => !isNaN(v));
              const doseVals = journal.map(e => e.doseActual || e.doseSuggested || e.dose).filter(v => v != null && !isNaN(v));
              const avg = glycVals.length > 0 ? (glycVals.reduce((a, b) => a + b, 0) / glycVals.length) : 0;
              const inRange = glycVals.filter(v => v >= targetGMin && v <= targetGMax).length;
              const tirPct = glycVals.length > 0 ? Math.round((inRange / glycVals.length) * 100) : 0;
              const avgDose = doseVals.length > 0 ? (doseVals.reduce((a, b) => a + Number(b), 0) / doseVals.length) : 0;

              // Chart data: last 30 entries reversed (chronological)
              const chartEntries = journal.slice(0, 30).reverse();
              const hasChart = chartEntries.length >= 2;

              return (
                <div style={{ ...card, borderColor: `${cc.accent}30` }}>
                  <div style={{ fontSize: 12, letterSpacing: 2, color: cc.accent, textTransform: 'uppercase', marginBottom: 10 }}>
                    📊 {t("resumeEvolution")}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div style={{ background: isDark ? '#070c12' : '#f1f5f9', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: cc.muted, marginBottom: 4, textTransform: 'uppercase' }}>{t("moyenne")}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: glycColor(avg), fontFamily: "'Syne Mono',monospace" }}>{avg > 0 ? avg.toFixed(2) : '—'}</div>
                      <div style={{ fontSize: 10, color: cc.muted }}>g/L</div>
                    </div>
                    <div style={{ background: isDark ? '#070c12' : '#f1f5f9', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: cc.muted, marginBottom: 4, textTransform: 'uppercase' }}>{t("enCible")}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: tirPct >= 70 ? '#22c55e' : tirPct >= 50 ? '#f59e0b' : '#ef4444', fontFamily: "'Syne Mono',monospace" }}>{glycVals.length > 0 ? `${tirPct}%` : '—'}</div>
                      <div style={{ fontSize: 10, color: cc.muted }}>{targetGMin.toFixed(1)}–{targetGMax.toFixed(1)}</div>
                    </div>
                    <div style={{ background: isDark ? '#070c12' : '#f1f5f9', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: cc.muted, marginBottom: 4, textTransform: 'uppercase' }}>{t("doseMoyenne")}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: cc.accent, fontFamily: "'Syne Mono',monospace" }}>{avgDose > 0 ? avgDose.toFixed(1) : '—'}</div>
                      <div style={{ fontSize: 10, color: cc.muted }}>U</div>
                    </div>
                  </div>

                  {/* Interactive Evolution Chart */}
                  {hasChart && (() => {
                    const w = 320, h = 160, padL = 32, padR = 8, padT = 16, padB = 28;
                    const chartW = w - padL - padR;
                    const chartH = h - padT - padB;

                    // Glycemia data
                    const glycPrePts = chartEntries.map(e => parseFloat(e.glycPre)).map(v => isNaN(v) ? null : v);
                    const glycPostPts = chartEntries.map(e => e.glycPost ? parseFloat(e.glycPost) : null).map(v => isNaN(v) ? null : v);
                    const allGlyc = [...glycPrePts, ...glycPostPts].filter(v => v != null);
                    const minG = Math.min(0.4, ...allGlyc);
                    const maxG = Math.max(2.5, ...allGlyc);

                    // Dose data (secondary axis)
                    const dosePts = chartEntries.map(e => {
                      const d = e.doseActual != null ? e.doseActual : (e.doseSuggested || e.dose);
                      return d != null && !isNaN(Number(d)) ? Number(d) : null;
                    });
                    const allDose = dosePts.filter(v => v != null);
                    const maxD = allDose.length > 0 ? Math.max(5, ...allDose) : 10;

                    const xStep = chartEntries.length > 1 ? chartW / (chartEntries.length - 1) : chartW;
                    const yG = (v) => padT + chartH - ((v - minG) / (maxG - minG)) * chartH;
                    const yD = (v) => padT + chartH - (v / maxD) * chartH;

                    // Build paths
                    const buildPath = (pts, yFn) => {
                      let d = '';
                      pts.forEach((v, i) => {
                        if (v == null) return;
                        const x = padL + i * xStep;
                        const y = yFn(v);
                        d += d === '' ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`;
                      });
                      return d;
                    };

                    const pathPre = buildPath(glycPrePts, yG);
                    const pathPost = buildPath(glycPostPts, yG);

                    // Date labels (show first, middle, last)
                    const dateLabels = chartEntries.map(e => {
                      const d = e.dateDisplay || e.date || '';
                      return d.substring(0, 5); // DD/MM
                    });

                    const yTargetMin = yG(targetGMin);
                    const yTargetMax = yG(targetGMax);

                    return (
                      <div style={{ marginTop: 8 }}>
                        {/* Legend */}
                        <div style={{ display: 'flex', gap: 12, marginBottom: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 3, background: cc.accent, borderRadius: 2, display: 'inline-block' }}></span>
                            <span style={{ color: cc.muted }}>{t("glycPre")}</span>
                          </span>
                          <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 3, background: '#f59e0b', borderRadius: 2, display: 'inline-block' }}></span>
                            <span style={{ color: cc.muted }}>{t("glycPost")}</span>
                          </span>
                          <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 3, background: '#a78bfa', borderRadius: 2, display: 'inline-block' }}></span>
                            <span style={{ color: cc.muted }}>{t("dosesChart")}</span>
                          </span>
                          <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 6, background: 'rgba(34,197,94,0.15)', borderRadius: 1, display: 'inline-block' }}></span>
                            <span style={{ color: cc.muted }}>{t("cibleChart")}</span>
                          </span>
                        </div>
                        <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
                          {/* Target range band */}
                          <rect x={padL} y={Math.min(yTargetMin, yTargetMax)} width={chartW} height={Math.abs(yTargetMin - yTargetMax)} fill="rgba(34,197,94,0.1)" rx={3} />
                          <line x1={padL} x2={padL + chartW} y1={yTargetMin} y2={yTargetMin} stroke="rgba(34,197,94,0.25)" strokeDasharray="4 3" strokeWidth={1} />
                          <line x1={padL} x2={padL + chartW} y1={yTargetMax} y2={yTargetMax} stroke="rgba(34,197,94,0.25)" strokeDasharray="4 3" strokeWidth={1} />

                          {/* Y-axis labels glycemia */}
                          <text x={padL - 4} y={yG(targetGMin) + 3} textAnchor="end" fill={cc.muted} fontSize={8}>{targetGMin.toFixed(1)}</text>
                          <text x={padL - 4} y={yG(targetGMax) + 3} textAnchor="end" fill={cc.muted} fontSize={8}>{targetGMax.toFixed(1)}</text>
                          <text x={padL - 4} y={yG(maxG) + 3} textAnchor="end" fill={cc.muted} fontSize={8}>{maxG.toFixed(1)}</text>

                          {/* Dose bars (background) */}
                          {dosePts.map((v, i) => v != null && (
                            <rect key={`d${i}`} x={padL + i * xStep - 3} y={yD(v)} width={6} height={padT + chartH - yD(v)} fill="rgba(167,139,250,0.18)" rx={2} />
                          ))}

                          {/* Glyc pré line */}
                          {pathPre && <path d={pathPre} fill="none" stroke={cc.accent} strokeWidth={2} strokeLinejoin="round" />}
                          {/* Glyc post line */}
                          {pathPost && <path d={pathPost} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" strokeLinejoin="round" />}

                          {/* Data points - glyc pré */}
                          {glycPrePts.map((v, i) => v != null && (
                            <circle key={`gp${i}`} cx={padL + i * xStep} cy={yG(v)} r={3.5} fill={glycColor(v)} stroke={isDark ? '#0A1928' : '#fff'} strokeWidth={1.5} />
                          ))}
                          {/* Data points - glyc post */}
                          {glycPostPts.map((v, i) => v != null && (
                            <circle key={`gpo${i}`} cx={padL + i * xStep} cy={yG(v)} r={2.5} fill="#f59e0b" stroke={isDark ? '#0A1928' : '#fff'} strokeWidth={1} />
                          ))}

                          {/* X-axis date labels */}
                          {chartEntries.length <= 10 ? (
                            chartEntries.map((_, i) => (
                              <text key={`xl${i}`} x={padL + i * xStep} y={h - 4} textAnchor="middle" fill={cc.muted} fontSize={7}>{dateLabels[i]}</text>
                            ))
                          ) : (
                            [0, Math.floor(chartEntries.length / 2), chartEntries.length - 1].map(i => (
                              <text key={`xl${i}`} x={padL + i * xStep} y={h - 4} textAnchor="middle" fill={cc.muted} fontSize={7}>{dateLabels[i]}</text>
                            ))
                          )}
                        </svg>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {journal.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📓</div>
                <div style={{ fontSize: 13, color: cc.muted }}>{t("aucuneEntree")}</div>
                <div style={{ fontSize: 12, color: cc.muted, marginTop: 4, opacity: 0.6 }}>{t("calculsAutoSave")}</div>
              </div>
            ) : (
              journal.map((e, i) => {
                const glycPreVal = parseFloat(e.glycPre);
                const glycPostVal = parseFloat(e.glycPost);
                const doseVal = e.doseActual != null ? e.doseActual : (e.doseSuggested || e.dose);
                const hasGlycPost = e.glycPost && !isNaN(glycPostVal);
                const delta = hasGlycPost ? (glycPostVal - glycPreVal) : null;
                return (
                <div key={e.id || i} style={{ ...card, padding: '12px 16px' }}>
                  {/* Header: date + dose */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: cc.muted }}>{e.dateDisplay || e.date}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: cc.accent, fontFamily: "'IBM Plex Mono',monospace" }}>{doseVal}U</span>
                  </div>

                  {/* Glycémie pré + post côte à côte */}
                  <div style={{ display: 'grid', gridTemplateColumns: hasGlycPost ? '1fr auto 1fr' : '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    <div style={{ background: isDark ? '#070c12' : '#f1f5f9', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: cc.muted, textTransform: 'uppercase', marginBottom: 2 }}>{t("glycPre")}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: glycColor(glycPreVal), fontFamily: "'Syne Mono',monospace" }}>{e.glycPre}</div>
                    </div>
                    {hasGlycPost && (
                      <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: delta <= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                        {delta <= 0 ? '↘' : '↗'} {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                      </div>
                    )}
                    {hasGlycPost ? (
                      <div style={{ background: isDark ? '#070c12' : '#f1f5f9', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: cc.muted, textTransform: 'uppercase', marginBottom: 2 }}>{t("glycPost")}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: glycColor(glycPostVal), fontFamily: "'Syne Mono',monospace" }}>{e.glycPost}</div>
                      </div>
                    ) : (
                      <button onClick={() => {
                        const val = prompt(t("saisirGlycPost") + " (g/L) :", '');
                        if (val !== null && !isNaN(parseFloat(val))) {
                          updateJournalGlycPost(e.id, parseFloat(val).toFixed(2));
                        }
                      }} style={{
                        background: isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.04)',
                        border: `1px dashed ${cc.accent}50`, borderRadius: 8, padding: '6px 10px',
                        textAlign: 'center', cursor: 'pointer', color: cc.accent, fontSize: 11,
                        fontFamily: "'IBM Plex Mono',monospace",
                      }}>
                        <div style={{ fontSize: 9, textTransform: 'uppercase', marginBottom: 2, opacity: 0.7 }}>{t("glycPost")}</div>
                        <div>+ {t("ajouter")}</div>
                      </button>
                    )}
                  </div>

                  {/* Dose: suggérée vs effective */}
                  <div style={{ fontSize: 11, color: cc.muted, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{t("doseSuggeree")} : {e.doseSuggested || e.dose}U</span>
                    <span>·</span>
                    {e.doseActual != null ? (
                      <span>{t("doseEffective")} : <span style={{ color: cc.accent, fontWeight: 600 }}>{e.doseActual}U</span></span>
                    ) : (
                      <button onClick={() => {
                        const dose = prompt(t("doseEffective") + " (U) :", String(e.doseSuggested || e.dose || ''));
                        if (dose !== null && !isNaN(parseFloat(dose))) {
                          updateJournalDoseActual(e.id, parseFloat(dose));
                        }
                      }} style={{ background: `${cc.accent}12`, border: `1px solid ${cc.accent}40`, borderRadius: 4, padding: '2px 8px', color: cc.accent, fontSize: 11, cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace" }}>
                        {t("saisirDoseReelle")}
                      </button>
                    )}
                  </div>

                  {/* Aliments */}
                  <div style={{ fontSize: 11, color: cc.muted, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.aliments || t("pasAliments")}
                  </div>
                </div>
                );
              })
            )}

            {/* Disclaimer en bas du journal */}
            <div style={{ ...card, marginTop: 8, borderColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)', background: isDark ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.02)' }}>
              <div style={{ fontSize: 11, color: isDark ? '#fca5a5' : '#b91c1c', lineHeight: 1.6 }}>
                ⚕️ {t("disclaimerFull")}
              </div>
              <div style={{ marginTop: 8, padding: '8px 12px', background: isDark ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.04)', borderRadius: 8, border: `1px solid ${cc.accent}30`, textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: cc.accent, fontWeight: 600 }}>📞 {t("contactMedecin")}</span>
              </div>
            </div>
          </div>
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
