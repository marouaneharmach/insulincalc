import { useState, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useTheme } from './hooks/useTheme.js';
import { round05, calcWeightSuggestions, getOverallFat, getDominantGI, buildSchedule } from './utils/calculations.js';
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
  // ─── Theme ───
  const { theme, colors: cc, toggleTheme } = useTheme();

  // ─── Onboarding ───
  const [onboarded, setOnboarded] = useLocalStorage("onboarded", false);

  // ─── Core state ───
  const [tab, setTab] = useState("repas");
  const [glycemia, setGlycemia] = useLocalStorage("glycemia", "");
  const [search, setSearch] = useState("");
  const [openCat, setOpenCat] = useState("\ud83e\udd58 Tajines");
  const [expandedId, setExpandedId] = useState(null);
  const [ratio, setRatio] = useLocalStorage("ratio", 10);
  const [isf, setIsf] = useLocalStorage("isf", 50);
  const [targetG, setTargetG] = useLocalStorage("targetG", 1.2);
  const [digestion, setDigestion] = useLocalStorage("digestion", "normal");
  const [weight, setWeight] = useLocalStorage("weight", "");
  const [result, setResult] = useState(null);
  const [maxDose, setMaxDose] = useLocalStorage("maxDose", 20);

  // ─── Settings: Profile, Notifications ───
  const [patientName, setPatientName] = useLocalStorage("patientName", "");
  const [notifEnabled, setNotifEnabled] = useLocalStorage("notifEnabled", false);
  const [notifDelay, setNotifDelay] = useLocalStorage("notifDelay", 120);

  // ─── Journal ───
  const [journal, setJournal] = useLocalStorage("journal", []);

  const [selData, setSelData] = useLocalStorage("selections", []);
  const [favorites, setFavorites] = useLocalStorage("favorites", []);
  const [customFoods, setCustomFoods] = useLocalStorage("custom_foods", []);
  const [showAddForm, setShowAddForm] = useState(false);

  // Rehydrate selections from stored IDs (includes custom foods)
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

  const setSelections = (updater) => {
    setSelectionsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setSelData(next.map(s => ({ foodId: s.food.id, mult: s.mult })));
      return next;
    });
  };

  const weightKg = parseFloat(weight);
  const weightOk = !isNaN(weightKg) && weightKg >= 20 && weightKg <= 200;
  const wSugg = weightOk ? calcWeightSuggestions(weightKg) : null;

  const filteredDB = useMemo(() => {
    if (!search.trim()) return FOOD_DB;
    const q = stripDiacritics(search.toLowerCase());
    const out = {};
    for (const [cat, foods] of Object.entries(FOOD_DB)) {
      const f = foods.filter(fd =>
        stripDiacritics(fd.name.toLowerCase()).includes(q) ||
        (fd.note && stripDiacritics(fd.note.toLowerCase()).includes(q))
      );
      if (f.length) out[cat] = f;
    }
    return out;
  }, [search]);

  const totalCarbs = useMemo(() => Math.round(selections.reduce((s, sel) => s + sel.food.carbs * sel.mult, 0)), [selections]);
  const dominantFat = useMemo(() => getOverallFat(selections), [selections]);
  const dominantGI = useMemo(() => getDominantGI(selections), [selections]);

  const gVal = parseFloat(glycemia);
  const glycOk = !isNaN(gVal) && gVal >= 0.3 && gVal <= 6.0;
  const glycOutOfBounds = glycemia !== "" && !isNaN(gVal) && (gVal < 0.3 || gVal > 6.0);
  const canCalc = glycOk && totalCarbs > 0;

  const toggleFood = food => {
    setSelections(prev => {
      const ex = prev.find(s => s.food.id === food.id);
      if (ex) { setExpandedId(null); return prev.filter(s => s.food.id !== food.id); }
      const profile = QTY_PROFILES[food.qty] || QTY_PROFILES["plat"];
      const defaultM = profile.find(s => Math.abs(s.m - 1) < 0.01)?.m || profile[Math.floor(profile.length / 2)].m;
      setExpandedId(food.id);
      return [...prev, { food, mult: defaultM }];
    });
  };
  const updateMult = (id, mult) => {
    const clamped = Math.max(0.25, Math.min(mult, 10));
    setSelections(prev => prev.map(s => s.food.id === id ? { ...s, mult: clamped } : s));
  };

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

  const calculate = () => {
    if (!canCalc) return;
    const bolusRepas = totalCarbs / ratio;
    const ecart = gVal - targetG;
    const correction = ecart > 0 ? (ecart * 10) / isf : 0;
    const fatBonus = (totalCarbs / ratio) * FAT_FACTOR[dominantFat];
    const total = round05(bolusRepas + correction + fatBonus);
    const hasFat = dominantFat === "\u00e9lev\u00e9" || dominantFat === "moyen";
    const bolusType = hasFat ? "dual" : "standard";
    const schedule = buildSchedule(totalCarbs, bolusRepas, correction, fatBonus, gVal, targetG, digestion, bolusType, dominantGI);
    const warnings = [];
    if (gVal < 1.0) warnings.push({ t: "w", txt: "Glyc\u00e9mie basse \u2192 adapter le d\u00e9lai" });
    if (gVal > 2.0) warnings.push({ t: "w", txt: "Glyc\u00e9mie \u00e9lev\u00e9e \u2192 contr\u00f4ler dans 2h" });
    if (bolusType === "dual") warnings.push({ t: "i", txt: "Repas gras \u2192 bolus en 2 phases" });
    if (dominantGI === "\u00e9lev\u00e9") warnings.push({ t: "c", txt: "IG \u00e9lev\u00e9 \u2192 pic glyc\u00e9mique rapide (30\u201345 min)" });
    if (total > 20) warnings.push({ t: "w", txt: "Dose \u00e9lev\u00e9e \u2192 consultez votre m\u00e9decin" });
    setResult({ total, bolusType, warnings, schedule, bolusRepas: +bolusRepas.toFixed(1), correction: +correction.toFixed(1), fatBonus: +fatBonus.toFixed(1) });
    setTab("resultat");

    // Schedule post-meal notification if enabled
    if (notifEnabled) {
      schedulePostMealReminder(notifDelay);
    }

    // Save to journal
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      repas: dominantGI,
      glycPre: gVal.toFixed(2),
      glycPost: '',
      dose: total,
      aliments: selections.map(s => s.food.name).join(', '),
    };
    setJournal(prev => [entry, ...prev].slice(0, 200));
  };

  // ─── Onboarding handler ───
  const handleOnboardingComplete = ({ weight: w, icr, isf: isfVal, targetG: tg }) => {
    setWeight(String(w));
    setRatio(icr);
    setIsf(isfVal);
    setTargetG(tg);
    setOnboarded(true);
  };

  // ─── Export PDF handler ───
  const handleExportPdf = () => {
    const tirEntries = journal.filter(e => {
      const v = parseFloat(e.glycPre);
      return !isNaN(v) && v >= 1.0 && v <= 1.8;
    });
    const glycValues = journal.map(e => parseFloat(e.glycPre)).filter(v => !isNaN(v));
    const moyenne = glycValues.length > 0 ? (glycValues.reduce((a, b) => a + b, 0) / glycValues.length).toFixed(2) : null;
    const tir = glycValues.length > 0 ? Math.round((tirEntries.length / glycValues.length) * 100) : null;
    const hba1c = moyenne ? ((parseFloat(moyenne) * 100 + 46.7) / 28.7).toFixed(1) : null;
    const stats = { moyenne, tir, hba1c, count: journal.length };
    generateJournalPdf(journal, 'Toutes les entr\u00e9es', stats, patientName);
  };

  // ─── Show onboarding if not done ───
  if (!onboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const isDark = theme === 'dark';
  const card = { background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 14, padding: SPACE.xl, marginBottom: SPACE.md };
  const lbl = { fontSize: FONT.xs, letterSpacing: 2, color: cc.muted, textTransform: "uppercase", marginBottom: SPACE.sm, display: "block" };
  const inp = { width: "100%", background: isDark ? "#070c12" : '#f8fafc', border: `1px solid ${cc.border}`, borderRadius: 8, color: cc.text, padding: "11px 14px", fontSize: FONT.md, fontFamily: "'IBM Plex Mono',monospace", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: cc.bg, fontFamily: "'IBM Plex Mono',monospace", color: cc.text }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        input:focus{border-color:${cc.accent}!important;box-shadow:0 0 0 2px ${cc.accent}22;}
        .fr:hover{background:${cc.accent}08!important;}
        .cb:hover{color:${isDark ? '#7dd3fc' : cc.accent}!important;}
        .tb:hover{color:${isDark ? '#7dd3fc' : cc.accent}!important;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:${cc.border};border-radius:99px;}
      `}</style>

      {/* HEADER */}
      <div style={{ background: isDark ? "linear-gradient(180deg,#0d1117,transparent)" : 'linear-gradient(180deg,#fff,transparent)', padding: "24px 20px 14px", borderBottom: `1px solid ${cc.faint}` }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 700, fontFamily: "'Syne Mono',monospace", color: isDark ? "#e2edf5" : '#1a202c', letterSpacing: -0.5 }}>InsulinCalc</div>
            <div style={{ fontSize: 12, color: cc.muted, letterSpacing: 2, textTransform: "uppercase", marginTop: 3 }}>Diab\u00e8te Type 1 {"\u00b7"} Cuisine marocaine</div>
          </div>
          <div style={{ background: cc.adim, border: `1px solid ${cc.accent}40`, borderRadius: 10, padding: "8px 14px", textAlign: "right" }}>
            <div style={{ fontSize: 12, color: cc.muted, letterSpacing: 1 }}>GLUCIDES</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: cc.accent, fontFamily: "'Syne Mono',monospace", lineHeight: 1.1 }}>{totalCarbs}g</div>
            {selections.length > 0 && <div style={{ fontSize: 12, color: cc.muted }}>{selections.length} aliment{selections.length > 1 ? "s" : ""}</div>}
          </div>
        </div>
      </div>

      {/* TABS */}
      <TabNav tab={tab} setTab={setTab} selections={selections} className="no-print" colors={cc} theme={theme} journal={journal} />

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "14px 20px 100px" }}>

        {/* === REPAS === */}
        {tab === "repas" && (<>
          <FavoriteMeals
            selections={selections}
            favorites={favorites}
            setFavorites={setFavorites}
            onLoadFavorite={loadFavorite}
          />

          {/* Saisie rapide : Poids + Glycemie */}
          <div style={{ ...card, borderColor: `${cc.accent}40`, padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, letterSpacing: 1.5, color: "#22c55e", marginBottom: 6, textTransform: "uppercase" }}>{"\u2696"} Poids (kg)</div>
                <input type="number" step="0.5" min="20" max="200" placeholder="68" inputMode="decimal" aria-label="Poids en kg"
                  value={weight} onChange={e => setWeight(e.target.value)}
                  style={{ ...inp, fontSize: 20, padding: "10px 8px", fontWeight: 700, color: weightOk ? "#22c55e" : cc.text, textAlign: "center", borderRadius: 10 }} />
                {wSugg && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 4, textAlign: "center" }}>TDD ~{wSugg.tdd}U/j {"\u00b7"} ICR 1U/{wSugg.icr}g {"\u00b7"} ISF {wSugg.isfMg}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, letterSpacing: 1.5, color: cc.accent, marginBottom: 6, textTransform: "uppercase" }}>{"\ud83e\ude78"} Glyc\u00e9mie (g/L)</div>
                <input type="number" step="0.1" min="0.1" max="6" placeholder="1.40" inputMode="decimal" aria-label="Glyc\u00e9mie en g/L"
                  value={glycemia} onChange={e => setGlycemia(e.target.value)}
                  style={{ ...inp, fontSize: 20, padding: "10px 8px", fontWeight: 700, color: glycColor(gVal), textAlign: "center", borderRadius: 10 }} />
                {glycOk && <div style={{ fontSize: 12, color: glycColor(gVal), marginTop: 4, textAlign: "center" }}>{glycLabel(gVal)} {"\u00b7"} \u00e9cart {gVal > targetG ? "+" : ""}{(gVal - targetG).toFixed(2)}</div>}
                {glycOutOfBounds && (
                  <div style={{ fontSize: 12, color: cc.red, marginTop: 4, textAlign: "center" }}>
                    Glyc\u00e9mie hors bornes (0.3 \u2014 6.0 g/L)
                  </div>
                )}
              </div>
            </div>
            {wSugg && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => setRatio(wSugg.icr)} style={{ flex: 1, padding: "6px", border: `1px solid ${cc.accent}4D`, borderRadius: 8, background: `${cc.accent}0F`, color: isDark ? "#7dd3fc" : cc.accent, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer" }}>
                  {"\u2713"} Ratio 1U/{wSugg.icr}g
                </button>
                <button onClick={() => setIsf(wSugg.isfMg)} style={{ flex: 1, padding: "6px", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, background: "rgba(245,158,11,0.06)", color: "#fcd34d", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer" }}>
                  {"\u2713"} ISF {wSugg.isfMg}mg/dL
                </button>
              </div>
            )}
            {glycOk && gVal > 2.0 && (
              <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: gVal > 3.0 ? "rgba(220,38,38,0.15)" : gVal > 2.5 ? "rgba(239,68,68,0.12)" : "rgba(249,115,22,0.1)", border: `1px solid ${gVal > 3.0 ? "rgba(220,38,38,0.5)" : gVal > 2.5 ? "rgba(239,68,68,0.4)" : "rgba(249,115,22,0.3)"}`, fontSize: 12, color: gVal > 2.5 ? "#fca5a5" : "#fdba74" }}>
                {gVal > 3.0 ? "\ud83c\udfe5" : "\ud83d\udea8"} Glyc\u00e9mie {gVal.toFixed(1)} g/L \u2014 {gVal > 3.0 ? "URGENCE M\u00c9DICALE" : "correction n\u00e9cessaire"}
              </div>
            )}
            {glycOk && gVal < 0.8 && (
              <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", fontSize: 12, color: "#fca5a5" }}>
                {"\ud83d\udea8"} Hypoglyc\u00e9mie \u2014 Prendre du sucre imm\u00e9diatement
              </div>
            )}
          </div>

          {selections.length > 0 && (
            <div style={{ ...card, borderColor: `${cc.accent}4D` }}>
              <div style={{ ...lbl, color: cc.accent }}>{"\ud83e\uddf0"} Mon repas ({selections.length} aliment{selections.length > 1 ? "s" : ""})</div>
              {selections.map((s) => (
                <div key={s.food.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${cc.faint}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: isDark ? "#9ab8cc" : '#334155', whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.food.name}</div>
                      <div style={{ fontSize: 12, color: cc.muted, marginTop: 1 }}>{GI_ICON[s.food.gi]} IG {s.food.gi}{s.mult !== 1 && <span style={{ color: cc.accent }}> {"\u00b7"} {(QTY_PROFILES[s.food.qty] || QTY_PROFILES["plat"]).find(p => Math.abs(p.m - s.mult) < 0.01)?.l || `\u00d7${s.mult}`}</span>}</div>
                    </div>
                    <button onClick={() => setExpandedId(expandedId === s.food.id ? null : s.food.id)} style={{ background: expandedId === s.food.id ? `${cc.accent}26` : (isDark ? "#131d2b" : '#f1f5f9'), border: `1px solid ${expandedId === s.food.id ? cc.accent : cc.border}`, borderRadius: 7, color: expandedId === s.food.id ? cc.accent : cc.muted, fontSize: 12, padding: "5px 9px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {(QTY_PROFILES[s.food.qty] || QTY_PROFILES["plat"]).find(p => Math.abs(p.m - s.mult) < 0.01)?.l || `\u00d7${s.mult}`} {"\u270e"}
                    </button>
                    <div style={{ fontSize: 13, color: cc.accent, minWidth: 40, textAlign: "right", fontWeight: 700 }}>{Math.round(s.food.carbs * s.mult)}g</div>
                    <button onClick={() => toggleFood(s.food)} style={{ background: "none", border: "none", color: cc.muted, cursor: "pointer", fontSize: 18, padding: "0 2px", lineHeight: 1 }}>{"\u00d7"}</button>
                  </div>
                  {expandedId === s.food.id && <QtyStepper food={s.food} mult={s.mult} onChange={m => updateMult(s.food.id, m)} />}
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${cc.border}`, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: cc.muted }}>Total glucides</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: cc.accent }}>{totalCarbs}g</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {[{ label: "INDEX GLYC\u00c9MIQUE", val: dominantGI, color: GI_COLOR[dominantGI], icon: GI_ICON[dominantGI] }, { label: "GRAISSES", val: dominantFat, color: dominantFat === "\u00e9lev\u00e9" ? cc.yellow : dominantFat === "moyen" ? "#a78bfa" : cc.green, icon: dominantFat === "\u00e9lev\u00e9" ? "\ud83d\udd36" : dominantFat === "moyen" ? "\ud83d\udfe3" : "\ud83d\udfe2" }].map((it, i) => (
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
            <div style={lbl}>Vitesse de digestion estim\u00e9e</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {Object.entries(DIGESTION_PROFILES).map(([key, dp]) => (
                <button key={key} onClick={() => setDigestion(key)} style={{ padding: "10px", border: `1px solid ${digestion === key ? cc.accent : cc.border}`, borderRadius: 10, background: digestion === key ? `${cc.accent}18` : (isDark ? "#070c12" : '#f8fafc'), color: digestion === key ? (isDark ? "#7dd3fc" : cc.accent) : cc.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{dp.icon}</div>
                  <div style={{ fontWeight: digestion === key ? 700 : 400, marginBottom: 2 }}>{dp.label}</div>
                  <div style={{ fontSize: 12, color: digestion === key ? cc.muted : (isDark ? "#2d3f50" : '#94a3b8'), lineHeight: 1.3 }}>Pic {dp.peakMin}min {"\u00b7"} Fin {Math.round(dp.tail / 60 * 10) / 10}h</div>
                </button>
              ))}
            </div>
          </div>

          {/* Search + food list */}
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
          />

          {showAddForm ? (
            <CustomFoodForm
              onSave={handleAddCustomFood}
              onCancel={() => setShowAddForm(false)}
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
              + Ajouter un aliment personnalis\u00e9
            </button>
          )}
        </>)}

        {/* === SAISIE === */}
        {tab === "saisie" && (<>
          <div style={card}>
            <div style={{ fontSize: 12, letterSpacing: 2, color: cc.accent, marginBottom: 14, textTransform: "uppercase" }}>{"\ud83e\ude78"} Glyc\u00e9mie actuelle</div>
            <input type="number" step="0.1" min="0.1" max="6" placeholder="ex : 1.40" inputMode="decimal" aria-label="Glyc\u00e9mie en g/L"
              value={glycemia} onChange={e => setGlycemia(e.target.value)}
              style={{ ...inp, fontSize: 34, padding: 14, fontWeight: 700, color: glycColor(gVal), textAlign: "center", borderRadius: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: cc.muted }}>
              <span>min : 0.5</span><span>unit\u00e9 : g/L</span><span>max : 6.0</span>
            </div>
            {glycOutOfBounds && (
              <div style={{ fontSize: 12, color: cc.red, marginTop: 4, textAlign: "center" }}>
                Glyc\u00e9mie hors bornes (0.3 \u2014 6.0 g/L)
              </div>
            )}
            {glycOk && (<>
              <div style={{ marginTop: 12 }}>
                <div style={{ background: cc.faint, borderRadius: 99, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min((gVal / 5) * 100, 100)}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${cc.green},${glycColor(gVal)})`, transition: "all 0.4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 12, color: cc.muted }}>
                  <span>0.5</span>
                  <span style={{ color: cc.green }}>cible : {targetG.toFixed(1)} g/L</span>
                  <span>5.0</span>
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: `${glycColor(gVal)}18`, border: `1px solid ${glycColor(gVal)}44`, textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: cc.muted, marginBottom: 3 }}>STATUT</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: glycColor(gVal) }}>{glycLabel(gVal)}</div>
                </div>
                <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: isDark ? "#070c12" : '#f8fafc', border: `1px solid ${cc.faint}`, textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: cc.muted, marginBottom: 3 }}>\u00c9CART / CIBLE</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: gVal > targetG ? cc.red : gVal < targetG ? cc.yellow : cc.green }}>
                    {gVal > targetG ? "+" : ""}{(gVal - targetG).toFixed(2)} g/L
                  </div>
                </div>
              </div>
              {gVal > 2.0 && gVal <= 2.5 && (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.4)", fontSize: 11, color: "#fdba74" }}>
                  {"\u26a0\ufe0f"} Glyc\u00e9mie {gVal.toFixed(1)} g/L \u2014 hyperglyc\u00e9mie. Correction n\u00e9cessaire.
                </div>
              )}
              {gVal > 2.5 && gVal <= 3.0 && (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.5)", fontSize: 11, color: "#fca5a5" }}>
                  {"\ud83d\udea8"} Glyc\u00e9mie {gVal.toFixed(1)} g/L \u2014 hyperglyc\u00e9mie s\u00e9v\u00e8re. Correction urgente + contr\u00f4le dans 1h.
                </div>
              )}
              {gVal > 3.0 && (
                <div role="alert" style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(220,38,38,0.15)", border: "2px solid rgba(220,38,38,0.6)", fontSize: 12, color: "#fca5a5", fontWeight: 700 }}>
                  {"\ud83c\udfe5"} Glyc\u00e9mie {gVal.toFixed(1)} g/L \u2014 URGENCE M\u00c9DICALE. Correction imm\u00e9diate + consultez votre m\u00e9decin / urgences si elle persiste.
                </div>
              )}
              {gVal < 0.8 && (
                <div role="alert" style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", fontSize: 11, color: "#fca5a5" }}>
                  {"\ud83d\udea8"} Glyc\u00e9mie &lt; 0.8 g/L \u2014 hypoglyc\u00e9mie. Prendre du sucre imm\u00e9diatement.
                </div>
              )}
            </>)}
          </div>

          {/* Poids */}
          <div style={card}>
            <div style={{ fontSize: 12, letterSpacing: 2, color: "#22c55e", marginBottom: 14, textTransform: "uppercase" }}>{"\u2696"} Poids corporel</div>
            <input type="number" step="0.5" min="20" max="200" placeholder="ex : 68" inputMode="decimal" aria-label="Poids en kg"
              value={weight} onChange={e => setWeight(e.target.value)}
              style={{ ...inp, fontSize: 34, padding: 14, fontWeight: 700, color: weightOk ? "#22c55e" : cc.text, textAlign: "center", borderRadius: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: cc.muted }}>
              <span>min : 20 kg</span><span>unit\u00e9 : kg</span><span>max : 200 kg</span>
            </div>
            {wSugg && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#22c55e", letterSpacing: 1, marginBottom: 8 }}>DOSES SUGG\u00c9R\u00c9ES POUR {weightKg} KG</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {[
                    { label: "TDD total/jour", val: `~${wSugg.tdd} U/j`, color: isDark ? "#7dd3fc" : '#0c4a6e', note: "0.5 U \u00d7 kg" },
                    { label: "Basale / jour", val: `~${wSugg.basal} U/j`, color: "#a78bfa", note: "~50% TDD" },
                    { label: "Ratio ICR", val: `1U/${wSugg.icr}g`, color: cc.accent, note: "R\u00e8gle des 500" },
                    { label: "ISF correction", val: `${wSugg.isfMg}mg/dL`, color: cc.yellow, note: "R\u00e8gle des 1700" },
                  ].map((it, i) => (
                    <div key={i} style={{ background: isDark ? "#070c12" : '#f8fafc', borderRadius: 10, padding: "10px 12px", border: `1px solid ${cc.border}` }}>
                      <div style={{ fontSize: 12, color: cc.muted, marginBottom: 3 }}>{it.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: it.color }}>{it.val}</div>
                      <div style={{ fontSize: 12, color: cc.muted, marginTop: 2, opacity: 0.6 }}>{it.note}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button onClick={() => setRatio(wSugg.icr)} style={{ padding: "10px", border: `1px solid ${cc.accent}66`, borderRadius: 10, background: `${cc.accent}14`, color: isDark ? "#7dd3fc" : cc.accent, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer" }}>
                    {"\u2713"} Appliquer ratio<br /><strong>1 U / {wSugg.icr}g</strong>
                  </button>
                  <button onClick={() => setIsf(wSugg.isfMg)} style={{ padding: "10px", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 10, background: "rgba(245,158,11,0.08)", color: "#fcd34d", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer" }}>
                    {"\u2713"} Appliquer ISF<br /><strong>{wSugg.isfMg} mg/dL</strong>
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: cc.muted, padding: "7px 10px", background: "rgba(239,68,68,0.04)", borderRadius: 7, borderLeft: "2px solid rgba(239,68,68,0.2)" }}>
                  {"\u2695\ufe0f"} Valeurs estimatives \u2014 \u00e0 valider avec votre endocrinologue.
                </div>
              </div>
            )}
          </div>

          {/* Zones de reference */}
          <div style={{ ...card, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, letterSpacing: 2, color: cc.muted, marginBottom: 10, textTransform: "uppercase" }}>Zones glyc\u00e9miques (g/L)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
              {[
                { zone: "< 0.7", label: "Hypo", color: cc.red },
                { zone: "0.7\u20131.0", label: "Bas", color: "#f97316" },
                { zone: "1.0\u20131.8", label: "\u2713 Cible", color: cc.green },
                { zone: "1.8\u20132.0", label: "\u00c9lev\u00e9", color: cc.yellow },
                { zone: "2.0\u20132.5", label: "Hyper", color: "#f97316" },
                { zone: "2.5\u20133.0", label: "S\u00e9v\u00e8re", color: cc.red },
                { zone: "> 3.0", label: "Urgence", color: "#dc2626" },
              ].map((z, i) => {
                const isActive = glycOk && (
                  (i === 0 && gVal < 0.7) || (i === 1 && gVal >= 0.7 && gVal < 1.0) || (i === 2 && gVal >= 1.0 && gVal <= 1.8) || (i === 3 && gVal > 1.8 && gVal <= 2.0) || (i === 4 && gVal > 2.0 && gVal <= 2.5) || (i === 5 && gVal > 2.5 && gVal <= 3.0) || (i === 6 && gVal > 3.0)
                );
                return (
                  <div key={i} style={{ padding: "8px 4px", borderRadius: 8, textAlign: "center", background: isActive ? `${z.color}22` : (isDark ? "#070c12" : '#f8fafc'), border: `1px solid ${isActive ? z.color : cc.faint}`, transition: "all 0.3s" }}>
                    <div style={{ fontSize: 12, color: z.color, fontWeight: isActive ? 700 : 400, marginBottom: 2 }}>{z.zone}</div>
                    <div style={{ fontSize: 12, color: isActive ? z.color : cc.muted }}>{z.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={calculate} aria-label="Lancer le calcul de dose" style={{ width: "100%", padding: 16, borderRadius: 12, cursor: canCalc ? "pointer" : "not-allowed", background: canCalc ? `linear-gradient(135deg,${cc.accent},#0a9e8e)` : cc.card, border: canCalc ? "none" : `1px solid ${cc.border}`, color: canCalc ? "#fff" : cc.muted, fontSize: 14, fontWeight: 700, fontFamily: "'Syne Mono',monospace", marginBottom: 4 }}>
            {canCalc
              ? `\u26a1 Calculer \u2014 ${totalCarbs}g glucides \u00b7 glyc\u00e9mie ${gVal.toFixed(1)} g/L`
              : `\u26a0 ${!glycOk && !selections.length ? "Saisissez glyc\u00e9mie + s\u00e9lectionnez des aliments" : !glycOk ? "Saisissez votre glyc\u00e9mie" : "S\u00e9lectionnez des aliments (onglet Repas)"}`
            }
          </button>
        </>)}

        {/* === RESULTAT === */}
        {tab === "resultat" && (
          <ResultCard
            result={result}
            selections={selections}
            totalCarbs={totalCarbs}
            digestion={digestion}
            isf={isf}
            targetG={targetG}
            maxDose={maxDose}
            setTab={setTab}
          />
        )}

        {/* === JOURNAL === */}
        {tab === "journal" && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, letterSpacing: 2, color: cc.accent, textTransform: 'uppercase' }}>
                {"\ud83d\udcd6"} Journal ({journal.length} entr\u00e9e{journal.length > 1 ? 's' : ''})
              </div>
              {journal.length > 0 && (
                <button onClick={handleExportPdf} style={{
                  padding: '8px 14px', borderRadius: 8,
                  border: `1px solid ${cc.accent}40`, background: `${cc.accent}12`,
                  color: cc.accent, fontSize: 12, fontFamily: "'IBM Plex Mono',monospace",
                  cursor: 'pointer', fontWeight: 600,
                }}>
                  {"\ud83d\udcc4"} Exporter PDF
                </button>
              )}
            </div>
            {journal.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{"\ud83d\udcd3"}</div>
                <div style={{ fontSize: 13, color: cc.muted }}>Aucune entr\u00e9e dans le journal</div>
                <div style={{ fontSize: 12, color: cc.muted, marginTop: 4, opacity: 0.6 }}>
                  Les calculs effectu\u00e9s s'enregistrent automatiquement ici
                </div>
              </div>
            ) : (
              journal.map((e, i) => (
                <div key={e.id || i} style={{ ...card, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: cc.muted }}>{e.date}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: cc.accent, fontFamily: "'IBM Plex Mono',monospace" }}>{e.dose}U</span>
                  </div>
                  <div style={{ fontSize: 12, color: cc.text, marginBottom: 4 }}>
                    Glyc. pr\u00e9 : <span style={{ color: glycColor(parseFloat(e.glycPre)), fontWeight: 600 }}>{e.glycPre} g/L</span>
                    {e.glycPost && <> {"\u2192"} post : <span style={{ color: glycColor(parseFloat(e.glycPost)), fontWeight: 600 }}>{e.glycPost} g/L</span></>}
                  </div>
                  <div style={{ fontSize: 11, color: cc.muted, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.aliments || 'Pas d\'aliments enregistr\u00e9s'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* === PARAMETRES === */}
        {tab === "params" && (
          <ReglagesPanel
            ratio={ratio} setRatio={setRatio}
            isf={isf} setIsf={setIsf}
            targetG={targetG} setTargetG={setTargetG}
            digestion={digestion} setDigestion={setDigestion}
            maxDose={maxDose} setMaxDose={setMaxDose}
            patientName={patientName} setPatientName={setPatientName}
            theme={theme} toggleTheme={toggleTheme} colors={cc}
            notifEnabled={notifEnabled} setNotifEnabled={setNotifEnabled}
            notifDelay={notifDelay} setNotifDelay={setNotifDelay}
          />
        )}
      </div>

      {/* FLOATING CTA */}
      {tab === "repas" && (
        <div className="no-print" style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "10px 20px 16px", background: `linear-gradient(0deg,${cc.bg} 60%,transparent)`, maxWidth: 520, margin: "0 auto" }}>
          <button onClick={() => { if (canCalc) { calculate(); } else if (selections.length > 0) { setTab("saisie"); } }} aria-label="Lancer le calcul de dose" style={{ width: "100%", padding: 15, borderRadius: 12, cursor: "pointer", background: canCalc ? `linear-gradient(135deg,${cc.accent},#0a9e8e)` : selections.length > 0 ? (isDark ? "linear-gradient(135deg,#1c3a50,#0d2233)" : 'linear-gradient(135deg,#e0f2f1,#b2dfdb)') : cc.card, border: canCalc ? "none" : `1px solid ${cc.border}`, color: canCalc ? "#fff" : selections.length > 0 ? (isDark ? "#7dd3fc" : cc.accent) : cc.muted, fontSize: 13, fontWeight: 700, fontFamily: "'Syne Mono',monospace" }}>
            {canCalc ? `\u26a1 Calculer le calendrier \u2014 ${totalCarbs}g glucides` : selections.length > 0 ? `\u2192 Saisir glyc\u00e9mie + poids (${totalCarbs}g s\u00e9lectionn\u00e9s)` : "\u2190 S\u00e9lectionner des aliments"}
          </button>
        </div>
      )}
    </div>
  );
}
