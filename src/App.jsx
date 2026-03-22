import { useState, useMemo } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { round05, calcWeightSuggestions, getOverallFat, getDominantGI, buildSchedule } from './utils/calculations.js';
import { C, GI_ICON, GI_COLOR, glycColor, glycLabel, stripDiacritics } from './utils/colors.js';
import { QTY_PROFILES, DIGESTION_PROFILES, FAT_FACTOR } from './data/constants.js';
import FOOD_DB from './data/foods.js';

import TabNav from './components/TabNav.jsx';
import QtyStepper from './components/QtyStepper.jsx';
import FoodList from './components/FoodList.jsx';
import ResultCard from './components/ResultCard.jsx';
import ParamsPanel from './components/ParamsPanel.jsx';

export default function App() {
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

  const [selData, setSelData] = useLocalStorage("selections", []);

  // Rehydrate selections from stored IDs
  const allFoods = useMemo(() => {
    const map = {};
    for (const foods of Object.values(FOOD_DB)) {
      for (const f of foods) map[f.id] = f;
    }
    return map;
  }, []);

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
  };

  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 12 };
  const lbl = { fontSize: 12, letterSpacing: 2, color: C.muted, textTransform: "uppercase", marginBottom: 8, display: "block" };
  const inp = { width: "100%", background: "#070c12", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "11px 14px", fontSize: 15, fontFamily: "'IBM Plex Mono',monospace", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'IBM Plex Mono',monospace", color: C.text }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        input:focus{border-color:#0ea5e9!important;box-shadow:0 0 0 2px rgba(14,165,233,0.1);}
        .fr:hover{background:rgba(14,165,233,0.04)!important;}
        .cb:hover{color:#7dd3fc!important;}
        .tb:hover{color:#7dd3fc!important;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:#1c2a38;border-radius:99px;}
      `}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(180deg,#0d1117,transparent)", padding: "24px 20px 14px", borderBottom: `1px solid ${C.faint}` }}>
        <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 700, fontFamily: "'Syne Mono',monospace", color: "#e2edf5", letterSpacing: -0.5 }}>InsulinCalc</div>
            <div style={{ fontSize: 12, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginTop: 3 }}>Diab\u00e8te Type 1 {"\u00b7"} Cuisine marocaine</div>
          </div>
          <div style={{ background: C.adim, border: "1px solid rgba(14,165,233,0.25)", borderRadius: 10, padding: "8px 14px", textAlign: "right" }}>
            <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1 }}>GLUCIDES</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.accent, fontFamily: "'Syne Mono',monospace", lineHeight: 1.1 }}>{totalCarbs}g</div>
            {selections.length > 0 && <div style={{ fontSize: 12, color: C.muted }}>{selections.length} aliment{selections.length > 1 ? "s" : ""}</div>}
          </div>
        </div>
      </div>

      {/* TABS */}
      <TabNav tab={tab} setTab={setTab} selections={selections} />

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "14px 20px 100px" }}>

        {/* === REPAS === */}
        {tab === "repas" && (<>
          {/* Saisie rapide : Poids + Glycemie */}
          <div style={{ ...card, borderColor: "rgba(14,165,233,0.25)", padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 10 }}>
              {/* Poids */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, letterSpacing: 1.5, color: "#22c55e", marginBottom: 6, textTransform: "uppercase" }}>{"\u2696"} Poids (kg)</div>
                <input type="number" step="0.5" min="20" max="200" placeholder="68" inputMode="decimal" aria-label="Poids en kg"
                  value={weight} onChange={e => setWeight(e.target.value)}
                  style={{ ...inp, fontSize: 20, padding: "10px 8px", fontWeight: 700, color: weightOk ? "#22c55e" : "#c8d6e5", textAlign: "center", borderRadius: 10 }} />
                {wSugg && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 4, textAlign: "center" }}>TDD ~{wSugg.tdd}U/j {"\u00b7"} ICR 1U/{wSugg.icr}g {"\u00b7"} ISF {wSugg.isfMg}</div>}
              </div>
              {/* Glycemie */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, letterSpacing: 1.5, color: C.accent, marginBottom: 6, textTransform: "uppercase" }}>{"\ud83e\ude78"} Glyc\u00e9mie (g/L)</div>
                <input type="number" step="0.1" min="0.1" max="6" placeholder="1.40" inputMode="decimal" aria-label="Glyc\u00e9mie en g/L"
                  value={glycemia} onChange={e => setGlycemia(e.target.value)}
                  style={{ ...inp, fontSize: 20, padding: "10px 8px", fontWeight: 700, color: glycColor(gVal), textAlign: "center", borderRadius: 10 }} />
                {glycOk && <div style={{ fontSize: 12, color: glycColor(gVal), marginTop: 4, textAlign: "center" }}>{glycLabel(gVal)} {"\u00b7"} \u00e9cart {gVal > targetG ? "+" : ""}{(gVal - targetG).toFixed(2)}</div>}
                {glycOutOfBounds && (
                  <div style={{ fontSize: 12, color: C.red, marginTop: 4, textAlign: "center" }}>
                    Glyc\u00e9mie hors bornes (0.3 \u2014 6.0 g/L)
                  </div>
                )}
              </div>
            </div>
            {/* Boutons appliquer si poids saisi */}
            {wSugg && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => setRatio(wSugg.icr)} style={{ flex: 1, padding: "6px", border: "1px solid rgba(14,165,233,0.3)", borderRadius: 8, background: "rgba(14,165,233,0.06)", color: "#7dd3fc", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer" }}>
                  {"\u2713"} Ratio 1U/{wSugg.icr}g
                </button>
                <button onClick={() => setIsf(wSugg.isfMg)} style={{ flex: 1, padding: "6px", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, background: "rgba(245,158,11,0.06)", color: "#fcd34d", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer" }}>
                  {"\u2713"} ISF {wSugg.isfMg}mg/dL
                </button>
              </div>
            )}
            {/* Alertes glycemie */}
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
            <div style={{ ...card, borderColor: "rgba(14,165,233,0.3)" }}>
              <div style={{ ...lbl, color: C.accent }}>{"\ud83e\uddf0"} Mon repas ({selections.length} aliment{selections.length > 1 ? "s" : ""})</div>
              {selections.map((s, i) => (
                <div key={s.food.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.faint}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#9ab8cc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.food.name}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{GI_ICON[s.food.gi]} IG {s.food.gi}{s.mult !== 1 && <span style={{ color: "#0ea5e9" }}> {"\u00b7"} {(QTY_PROFILES[s.food.qty] || QTY_PROFILES["plat"]).find(p => Math.abs(p.m - s.mult) < 0.01)?.l || `\u00d7${s.mult}`}</span>}</div>
                    </div>
                    <button onClick={() => setExpandedId(expandedId === s.food.id ? null : s.food.id)} style={{ background: expandedId === s.food.id ? "rgba(14,165,233,0.15)" : "#131d2b", border: `1px solid ${expandedId === s.food.id ? "#0ea5e9" : C.border}`, borderRadius: 7, color: expandedId === s.food.id ? C.accent : C.muted, fontSize: 12, padding: "5px 9px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {(QTY_PROFILES[s.food.qty] || QTY_PROFILES["plat"]).find(p => Math.abs(p.m - s.mult) < 0.01)?.l || `\u00d7${s.mult}`} {"\u270e"}
                    </button>
                    <div style={{ fontSize: 13, color: C.accent, minWidth: 40, textAlign: "right", fontWeight: 700 }}>{Math.round(s.food.carbs * s.mult)}g</div>
                    <button onClick={() => toggleFood(s.food)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, padding: "0 2px", lineHeight: 1 }}>{"\u00d7"}</button>
                  </div>
                  {expandedId === s.food.id && <QtyStepper food={s.food} mult={s.mult} onChange={m => updateMult(s.food.id, m)} />}
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: C.muted }}>Total glucides</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{totalCarbs}g</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {[{ label: "INDEX GLYC\u00c9MIQUE", val: dominantGI, color: GI_COLOR[dominantGI], icon: GI_ICON[dominantGI] }, { label: "GRAISSES", val: dominantFat, color: dominantFat === "\u00e9lev\u00e9" ? C.yellow : dominantFat === "moyen" ? "#a78bfa" : C.green, icon: dominantFat === "\u00e9lev\u00e9" ? "\ud83d\udd36" : dominantFat === "moyen" ? "\ud83d\udfe3" : "\ud83d\udfe2" }].map((it, i) => (
                  <div key={i} style={{ flex: 1, background: "#070c12", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>{it.label}</div>
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
                <button key={key} onClick={() => setDigestion(key)} style={{ padding: "10px", border: `1px solid ${digestion === key ? "#0ea5e9" : C.border}`, borderRadius: 10, background: digestion === key ? "rgba(14,165,233,0.12)" : "#070c12", color: digestion === key ? "#7dd3fc" : C.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{dp.icon}</div>
                  <div style={{ fontWeight: digestion === key ? 700 : 400, marginBottom: 2 }}>{dp.label}</div>
                  <div style={{ fontSize: 12, color: digestion === key ? "#4a8fa8" : "#2d3f50", lineHeight: 1.3 }}>Pic {dp.peakMin}min {"\u00b7"} Fin {Math.round(dp.tail / 60 * 10) / 10}h</div>
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
          />
        </>)}

        {/* === SAISIE === */}
        {tab === "saisie" && (<>
          {/* Glycemie */}
          <div style={card}>
            <div style={{ fontSize: 12, letterSpacing: 2, color: C.accent, marginBottom: 14, textTransform: "uppercase" }}>{"\ud83e\ude78"} Glyc\u00e9mie actuelle</div>
            <input type="number" step="0.1" min="0.1" max="6" placeholder="ex : 1.40" inputMode="decimal" aria-label="Glyc\u00e9mie en g/L"
              value={glycemia} onChange={e => setGlycemia(e.target.value)}
              style={{ ...inp, fontSize: 34, padding: 14, fontWeight: 700, color: glycColor(gVal), textAlign: "center", borderRadius: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "#2d3f50" }}>
              <span>min : 0.5</span><span>unit\u00e9 : g/L</span><span>max : 6.0</span>
            </div>
            {glycOutOfBounds && (
              <div style={{ fontSize: 12, color: C.red, marginTop: 4, textAlign: "center" }}>
                Glyc\u00e9mie hors bornes (0.3 \u2014 6.0 g/L)
              </div>
            )}
            {glycOk && (<>
              <div style={{ marginTop: 12 }}>
                <div style={{ background: C.faint, borderRadius: 99, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min((gVal / 5) * 100, 100)}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${C.green},${glycColor(gVal)})`, transition: "all 0.4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 12, color: C.muted }}>
                  <span>0.5</span>
                  <span style={{ color: C.green }}>cible : {targetG.toFixed(1)} g/L</span>
                  <span>5.0</span>
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: `${glycColor(gVal)}18`, border: `1px solid ${glycColor(gVal)}44`, textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>STATUT</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: glycColor(gVal) }}>{glycLabel(gVal)}</div>
                </div>
                <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "#070c12", border: `1px solid ${C.faint}`, textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>\u00c9CART / CIBLE</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: gVal > targetG ? C.red : gVal < targetG ? C.yellow : C.green }}>
                    {gVal > targetG ? "+" : ""}{(gVal - targetG).toFixed(2)} g/L
                  </div>
                </div>
              </div>
              {/* Alerte visuelle si hors zone */}
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
              style={{ ...inp, fontSize: 34, padding: 14, fontWeight: 700, color: weightOk ? "#22c55e" : "#c8d6e5", textAlign: "center", borderRadius: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "#2d3f50" }}>
              <span>min : 20 kg</span><span>unit\u00e9 : kg</span><span>max : 200 kg</span>
            </div>
            {wSugg && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#22c55e", letterSpacing: 1, marginBottom: 8 }}>DOSES SUGG\u00c9R\u00c9ES POUR {weightKg} KG</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {[
                    { label: "TDD total/jour", val: `~${wSugg.tdd} U/j`, color: "#7dd3fc", note: "0.5 U \u00d7 kg" },
                    { label: "Basale / jour", val: `~${wSugg.basal} U/j`, color: "#a78bfa", note: "~50% TDD" },
                    { label: "Ratio ICR", val: `1U/${wSugg.icr}g`, color: C.accent, note: "R\u00e8gle des 500" },
                    { label: "ISF correction", val: `${wSugg.isfMg}mg/dL`, color: C.yellow, note: "R\u00e8gle des 1700" },
                  ].map((it, i) => (
                    <div key={i} style={{ background: "#070c12", borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>{it.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: it.color }}>{it.val}</div>
                      <div style={{ fontSize: 12, color: "#2d3f50", marginTop: 2 }}>{it.note}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button onClick={() => setRatio(wSugg.icr)} style={{ padding: "10px", border: "1px solid rgba(14,165,233,0.4)", borderRadius: 10, background: "rgba(14,165,233,0.08)", color: "#7dd3fc", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer" }}>
                    {"\u2713"} Appliquer ratio<br /><strong>1 U / {wSugg.icr}g</strong>
                  </button>
                  <button onClick={() => setIsf(wSugg.isfMg)} style={{ padding: "10px", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 10, background: "rgba(245,158,11,0.08)", color: "#fcd34d", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer" }}>
                    {"\u2713"} Appliquer ISF<br /><strong>{wSugg.isfMg} mg/dL</strong>
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: "#2d3f50", padding: "7px 10px", background: "rgba(239,68,68,0.04)", borderRadius: 7, borderLeft: "2px solid rgba(239,68,68,0.2)" }}>
                  {"\u2695\ufe0f"} Valeurs estimatives \u2014 \u00e0 valider avec votre endocrinologue.
                </div>
              </div>
            )}
          </div>

          {/* Zones de reference */}
          <div style={{ ...card, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, letterSpacing: 2, color: C.muted, marginBottom: 10, textTransform: "uppercase" }}>Zones glyc\u00e9miques (g/L)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
              {[
                { zone: "< 0.7", label: "Hypo", color: C.red },
                { zone: "0.7\u20131.0", label: "Bas", color: "#f97316" },
                { zone: "1.0\u20131.8", label: "\u2713 Cible", color: C.green },
                { zone: "1.8\u20132.0", label: "\u00c9lev\u00e9", color: C.yellow },
                { zone: "2.0\u20132.5", label: "Hyper", color: "#f97316" },
                { zone: "2.5\u20133.0", label: "S\u00e9v\u00e8re", color: C.red },
                { zone: "> 3.0", label: "Urgence", color: "#dc2626" },
              ].map((z, i) => {
                const isActive = glycOk && (
                  (i === 0 && gVal < 0.7) || (i === 1 && gVal >= 0.7 && gVal < 1.0) || (i === 2 && gVal >= 1.0 && gVal <= 1.8) || (i === 3 && gVal > 1.8 && gVal <= 2.0) || (i === 4 && gVal > 2.0 && gVal <= 2.5) || (i === 5 && gVal > 2.5 && gVal <= 3.0) || (i === 6 && gVal > 3.0)
                );
                return (
                  <div key={i} style={{ padding: "8px 4px", borderRadius: 8, textAlign: "center", background: isActive ? `${z.color}22` : "#070c12", border: `1px solid ${isActive ? z.color : C.faint}`, transition: "all 0.3s" }}>
                    <div style={{ fontSize: 12, color: z.color, fontWeight: isActive ? 700 : 400, marginBottom: 2 }}>{z.zone}</div>
                    <div style={{ fontSize: 12, color: isActive ? z.color : "#2d3f50" }}>{z.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bouton calculer */}
          <button onClick={calculate} aria-label="Lancer le calcul de dose" style={{ width: "100%", padding: 16, borderRadius: 12, cursor: canCalc ? "pointer" : "not-allowed", background: canCalc ? "linear-gradient(135deg,#0ea5e9,#0284c7)" : C.card, border: canCalc ? "none" : `1px solid ${C.border}`, color: canCalc ? "#fff" : C.muted, fontSize: 14, fontWeight: 700, fontFamily: "'Syne Mono',monospace", marginBottom: 4 }}>
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

        {/* === PARAMETRES === */}
        {tab === "params" && (
          <ParamsPanel
            ratio={ratio}
            setRatio={setRatio}
            isf={isf}
            setIsf={setIsf}
            targetG={targetG}
            setTargetG={setTargetG}
            digestion={digestion}
            setDigestion={setDigestion}
            maxDose={maxDose}
            setMaxDose={setMaxDose}
          />
        )}
      </div>

      {/* FLOATING CTA */}
      {tab === "repas" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "10px 20px 16px", background: "linear-gradient(0deg,#07090f 60%,transparent)", maxWidth: 520, margin: "0 auto" }}>
          <button onClick={() => { if (canCalc) { calculate(); } else if (selections.length > 0) { setTab("saisie"); } }} aria-label="Lancer le calcul de dose" style={{ width: "100%", padding: 15, borderRadius: 12, cursor: "pointer", background: canCalc ? "linear-gradient(135deg,#0ea5e9,#0284c7)" : selections.length > 0 ? "linear-gradient(135deg,#1c3a50,#0d2233)" : C.card, border: canCalc ? "none" : `1px solid ${C.border}`, color: canCalc ? "#fff" : selections.length > 0 ? "#7dd3fc" : C.muted, fontSize: 13, fontWeight: 700, fontFamily: "'Syne Mono',monospace" }}>
            {canCalc ? `\u26a1 Calculer le calendrier \u2014 ${totalCarbs}g glucides` : selections.length > 0 ? `\u2192 Saisir glyc\u00e9mie + poids (${totalCarbs}g s\u00e9lectionn\u00e9s)` : "\u2190 S\u00e9lectionner des aliments"}
          </button>
        </div>
      )}
    </div>
  );
}
