import { C, SPACE, FONT } from '../utils/colors.js';
import { QTY_PROFILES, DIGESTION_PROFILES } from '../data/constants.js';
import InjectionStep from './InjectionStep.jsx';
import PostMealCorrector from './PostMealCorrector.jsx';

export default function ResultCard({ result, selections, totalCarbs, digestion, isf, targetG, maxDose, setTab }) {
  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: SPACE.xl, marginBottom: SPACE.md };
  const lbl = { fontSize: FONT.xs, letterSpacing: 2, color: C.muted, textTransform: "uppercase", marginBottom: SPACE.sm, display: "block" };

  if (!result) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>{"\u26a1"}</div>
        <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>S\u00e9lectionnez vos aliments,<br />saisissez votre glyc\u00e9mie,<br />puis lancez le calcul</div>
        <button onClick={() => setTab("repas")} style={{ marginTop: 18, background: C.adim, border: "1px solid rgba(14,165,233,0.3)", color: C.accent, borderRadius: 8, padding: "10px 20px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer" }}>{"\u2192"} S\u00e9lectionner les aliments</button>
      </div>
    );
  }

  return (
    <>
      {/* Total */}
      <div style={{ ...card, borderColor: "rgba(14,165,233,0.3)", background: "linear-gradient(135deg,#0d1117,#0a1520)" }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: C.accent, marginBottom: 10, textTransform: "uppercase" }}>Dose totale calcul\u00e9e</div>
        {result.total > maxDose && (
          <div role="alert" style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.5)", marginBottom: 12, fontSize: 12, color: "#fca5a5", fontWeight: 700 }}>
            {"\u26a0\ufe0f"} Dose inhabituellement \u00e9lev\u00e9e ({result.total} U &gt; seuil {maxDose} U) \u2014 V\u00e9rifiez vos param\u00e8tres ou consultez votre m\u00e9decin.
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, fontFamily: "'Syne Mono',monospace", background: "linear-gradient(135deg,#7dd3fc,#0ea5e9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{result.total}</div>
          <div style={{ color: C.muted, fontSize: 18, marginBottom: 10 }}>unit\u00e9s totales</div>
        </div>
        <div style={{ display: "inline-block", marginBottom: 14, background: result.bolusType === "dual" ? "rgba(245,158,11,0.12)" : "rgba(14,165,233,0.12)", border: `1px solid ${result.bolusType === "dual" ? "rgba(245,158,11,0.4)" : "rgba(14,165,233,0.35)"}`, color: result.bolusType === "dual" ? C.yellow : C.accent, borderRadius: 99, padding: "4px 14px", fontSize: 11 }}>
          {result.bolusType === "dual" ? "\u26a1 Bolus DUAL \u2014 2 injections" : "\ud83d\udc89 Bolus STANDARD \u2014 1 injection"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[{ label: "Repas", val: `${result.bolusRepas} U`, color: C.accent }, { label: "Correction", val: result.correction > 0 ? `+${result.correction} U` : "\u2014", color: result.correction > 0 ? C.yellow : "#2d3f50" }, { label: "Graisses", val: result.fatBonus > 0 ? `+${result.fatBonus} U` : "\u2014", color: result.fatBonus > 0 ? "#a78bfa" : "#2d3f50" }].map((it, i) => (
            <div key={i} style={{ background: "#070c12", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>{it.label.toUpperCase()}</div>
              <div style={{ fontSize: 14, color: it.color, fontWeight: 700 }}>{it.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ ...card, borderColor: "rgba(14,165,233,0.2)" }}>
        <div style={{ ...lbl, color: C.accent }}>{"\ud83d\udcc5"} Calendrier d'injections</div>
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(14,165,233,0.05)", borderRadius: 8, fontSize: 12, color: C.muted, display: "flex", gap: 6, alignItems: "center" }}>
          <span>{DIGESTION_PROFILES[digestion].icon}</span>
          <span>Digestion <strong style={{ color: C.accent }}>{DIGESTION_PROFILES[digestion].label}</strong> {"\u00b7"} Pic {DIGESTION_PROFILES[digestion].peakMin}min {"\u00b7"} Fin d'action {Math.round(DIGESTION_PROFILES[digestion].tail / 60 * 10) / 10}h</span>
        </div>
        <div style={{ padding: "4px 0" }}>
          {result.schedule.map((step, i) => (
            <InjectionStep key={i} step={step} index={i} total={result.schedule.length} />
          ))}
        </div>
      </div>

      {/* Post-meal corrector */}
      <PostMealCorrector
        initialDose={result.total}
        isf={isf}
        targetG={targetG}
        digestionKey={digestion}
      />

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div style={card}>
          {result.warnings.map((w, i) => (
            <div key={i} style={{ borderRadius: 8, padding: "9px 12px", marginBottom: i < result.warnings.length - 1 ? 8 : 0, fontSize: 11, background: w.t === "w" ? "rgba(239,68,68,0.08)" : w.t === "c" ? "rgba(245,158,11,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${w.t === "w" ? "rgba(239,68,68,0.3)" : w.t === "c" ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.3)"}`, color: w.t === "w" ? "#fca5a5" : w.t === "c" ? "#fcd34d" : "#86efac" }}>
              {w.t === "w" ? "\u26a0\ufe0f" : w.t === "c" ? "\ud83d\udd14" : "\u2705"} {w.txt}
            </div>
          ))}
        </div>
      )}

      {/* Meal recap */}
      <div style={card}>
        <div style={lbl}>R\u00e9capitulatif du repas</div>
        {selections.map((s, i) => {
          const profile = QTY_PROFILES[s.food.qty] || QTY_PROFILES["plat"];
          const qLabel = profile.find(p => Math.abs(p.m - s.mult) < 0.01)?.l || `\u00d7${s.mult}`;
          return (<div key={s.food.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "6px 0", borderBottom: i < selections.length - 1 ? `1px solid ${C.faint}` : "none" }}><span style={{ color: "#7aa0b8" }}>{s.food.name} <span style={{ color: "#3d5a73" }}>{qLabel}</span></span><span style={{ color: C.accent }}>{Math.round(s.food.carbs * s.mult)}g</span></div>);
        })}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${C.border}`, marginTop: 4, fontWeight: 700 }}>
          <span style={{ color: C.muted, fontSize: 12 }}>Total</span>
          <span style={{ color: C.accent, fontSize: 14 }}>{totalCarbs}g glucides</span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#2d3f50", padding: "10px 14px", background: "rgba(14,165,233,0.03)", borderRadius: 10, borderLeft: `2px solid ${C.accent}` }}>
        {"\u2695\ufe0f"} Ces calculs sont indicatifs. Ne modifiez jamais votre traitement sans l'accord de votre endocrinologue.
      </div>

      <button className="no-print" onClick={() => window.print()} style={{width:"100%",padding:14,borderRadius:10,cursor:"pointer",background:C.adim,border:`1px solid ${C.accent}44`,color:C.accent,fontFamily:"'IBM Plex Mono',monospace",fontSize:13,marginTop:12}}>
        🖨 Imprimer / Exporter
      </button>
    </>
  );
}
