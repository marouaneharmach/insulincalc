import { useEffect } from 'react';
import { SPACE, FONT } from '../utils/colors.js';
import { QTY_PROFILES, DIGESTION_PROFILES } from '../data/constants.js';
import InjectionStep from './InjectionStep.jsx';
import PostMealCorrector from './PostMealCorrector.jsx';

export default function ResultCard({ result, selections, totalCarbs, digestion, isf, targetGMid, maxDose, setTab, onSaveJournal, t, colors, theme }) {
  const cc = colors || {};
  const isDark = theme === 'dark' || !theme;
  const card = { background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 14, padding: SPACE.xl, marginBottom: SPACE.md };
  const lbl = { fontSize: FONT.xs, letterSpacing: 2, color: cc.muted, textTransform: "uppercase", marginBottom: SPACE.sm, display: "block" };

  // Auto-save to journal when result is shown
  useEffect(() => {
    if (result && onSaveJournal) onSaveJournal();
  }, []);

  if (!result) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>⚡</div>
        <div style={{ color: cc.muted, fontSize: 13, lineHeight: 1.7 }}>{t("selectionnezAliments")}</div>
        <button onClick={() => setTab("repas")} style={{ marginTop: 18, background: cc.adim, border: `1px solid ${cc.accent}35`, color: cc.accent, borderRadius: 8, padding: "10px 20px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer" }}>→ {t("tabRepas")}</button>
      </div>
    );
  }

  return (
    <>
      {/* Total */}
      <div style={{ ...card, borderColor: `${cc.accent}30`, background: isDark ? "linear-gradient(135deg,#0d1117,#0a1520)" : "linear-gradient(135deg,#f0fdfa,#e0f2f1)" }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: cc.accent, marginBottom: 10, textTransform: "uppercase" }}>{t("doseTotale")}</div>
        {result.total > maxDose && (
          <div role="alert" style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.5)", marginBottom: 12, fontSize: 12, color: "#fca5a5", fontWeight: 700 }}>
            ⚠️ {t("doseInhabituelle", { dose: result.total, max: maxDose })}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, fontFamily: "'Syne Mono',monospace", background: `linear-gradient(135deg,${isDark ? '#7dd3fc' : cc.accent},${cc.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{result.total}</div>
          <div style={{ color: cc.muted, fontSize: 18, marginBottom: 10 }}>{t("unitesTotales")}</div>
        </div>
        <div style={{ display: "inline-block", marginBottom: 14, background: result.bolusType === "dual" ? "rgba(245,158,11,0.12)" : `${cc.accent}18`, border: `1px solid ${result.bolusType === "dual" ? "rgba(245,158,11,0.4)" : `${cc.accent}35`}`, color: result.bolusType === "dual" ? (cc.yellow || "#f59e0b") : cc.accent, borderRadius: 99, padding: "4px 14px", fontSize: 11 }}>
          {result.bolusType === "dual" ? t("bolusDual") : t("bolusStandard")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: t("repas"), val: `${result.bolusRepas} U`, color: cc.accent },
            { label: t("correction"), val: result.correction > 0 ? `+${result.correction} U` : "—", color: result.correction > 0 ? (cc.yellow || "#f59e0b") : cc.muted },
            { label: t("graisses"), val: result.fatBonus > 0 ? `+${result.fatBonus} U` : "—", color: result.fatBonus > 0 ? "#a78bfa" : cc.muted },
          ].map((it, i) => (
            <div key={i} style={{ background: isDark ? "#070c12" : '#f1f5f9', borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: cc.muted, marginBottom: 3 }}>{it.label.toUpperCase()}</div>
              <div style={{ fontSize: 14, color: it.color, fontWeight: 700 }}>{it.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline (Fix #12) */}
      <div style={{ ...card, borderColor: `${cc.accent}20` }}>
        <div style={{ ...lbl, color: cc.accent }}>{t("calendrierInjections")}</div>
        <div style={{ marginBottom: 10, padding: "6px 10px", background: `${cc.accent}08`, borderRadius: 8, fontSize: 11, color: cc.muted, display: "flex", gap: 6, alignItems: "center" }}>
          <span>{DIGESTION_PROFILES[digestion].icon}</span>
          <span>{t("digestionLabel")} <strong style={{ color: cc.accent }}>{DIGESTION_PROFILES[digestion].label}</strong> · {t("picMin")} {DIGESTION_PROFILES[digestion].peakMin}min · {t("finAction")} {Math.round(DIGESTION_PROFILES[digestion].tail / 60 * 10) / 10}h</span>
        </div>
        <div style={{ padding: "4px 0" }}>
          {result.schedule.map((step, i) => (
            <InjectionStep key={i} step={step} index={i} total={result.schedule.length} />
          ))}
        </div>
      </div>

      {/* Post-meal corrector */}
      <PostMealCorrector initialDose={result.total} isf={isf} targetG={targetGMid} digestionKey={digestion} t={t} colors={cc} theme={theme} />

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div style={card}>
          {result.warnings.map((w, i) => (
            <div key={i} style={{ borderRadius: 8, padding: "9px 12px", marginBottom: i < result.warnings.length - 1 ? 8 : 0, fontSize: 11, background: w.t === "w" ? "rgba(239,68,68,0.08)" : w.t === "c" ? "rgba(245,158,11,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${w.t === "w" ? "rgba(239,68,68,0.3)" : w.t === "c" ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.3)"}`, color: w.t === "w" ? "#fca5a5" : w.t === "c" ? "#fcd34d" : "#86efac" }}>
              {w.t === "w" ? "⚠️" : w.t === "c" ? "🔔" : "✅"} {w.txt}
            </div>
          ))}
        </div>
      )}

      {/* Meal recap */}
      <div style={card}>
        <div style={lbl}>{t("recapitulatif")}</div>
        {selections.map((s, i) => {
          const profile = QTY_PROFILES[s.food.qty] || QTY_PROFILES["plat"];
          const qLabel = profile.find(p => Math.abs(p.m - s.mult) < 0.01)?.l || `×${s.mult}`;
          return (<div key={s.food.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "6px 0", borderBottom: i < selections.length - 1 ? `1px solid ${isDark ? "#0f161e" : "#edf2f7"}` : "none" }}><span style={{ color: isDark ? "#7aa0b8" : "#475569" }}>{s.food.name} <span style={{ color: cc.muted }}>{qLabel}</span></span><span style={{ color: cc.accent }}>{Math.round(s.food.carbs * s.mult)}g</span></div>);
        })}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${cc.border}`, marginTop: 4, fontWeight: 700 }}>
          <span style={{ color: cc.muted, fontSize: 12 }}>{t("total")}</span>
          <span style={{ color: cc.accent, fontSize: 14 }}>{totalCarbs}g {t("glucidesUnit")}</span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: cc.muted, padding: "10px 14px", background: `${cc.accent}06`, borderRadius: 10, borderLeft: `2px solid ${cc.accent}` }}>
        {t("disclaimerMedical")}
      </div>

      <button className="no-print" onClick={() => window.print()} style={{width:"100%",padding:14,borderRadius:10,cursor:"pointer",background:cc.adim || `${cc.accent}12`,border:`1px solid ${cc.accent}44`,color:cc.accent,fontFamily:"'IBM Plex Mono',monospace",fontSize:13,marginTop:12}}>
        {t("imprimerExporter")}
      </button>
    </>
  );
}
