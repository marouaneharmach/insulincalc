import { useState, useCallback } from 'react';
import { SPACE, FONT } from '../utils/colors.js';
import { QTY_PROFILES, DIGESTION_PROFILES } from '../data/constants.js';
import DosagePlan from './DosagePlan.jsx';
import PostMealCorrector from './PostMealCorrector.jsx';

export default function ResultCard({ result, selections, totalCarbs, digestion, isf, targetGMid, maxDose, setTab, onSaveJournal, t, colors, theme }) {
  const cc = colors || {};
  const isDark = theme === 'dark' || !theme;
  const card = { background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 14, padding: SPACE.xl, marginBottom: SPACE.md };
  const lbl = { fontSize: FONT.xs, letterSpacing: 2, color: cc.muted, textTransform: "uppercase", marginBottom: SPACE.sm, display: "block" };

  // Dose réelle modifiable avant enregistrement
  const [actualDose, setActualDose] = useState(result ? String(result.total) : '');
  const [saved, setSaved] = useState(false);
  const [dosagePlan, setDosagePlan] = useState(null);

  const handlePlanChange = useCallback((plan) => {
    setDosagePlan(plan);
    // Update actualDose to match sum of actual doses from plan
    const totalActual = plan.reduce((sum, s) => sum + (s.actualDose != null ? s.actualDose : 0), 0);
    setActualDose(String(totalActual));
  }, [setActualDose]);

  const handleSave = () => {
    if (!result || !onSaveJournal) return;
    const dose = parseFloat(actualDose);
    // Pass dosagePlan along with the actual dose
    // eslint-disable-next-line no-unused-vars
    const planForSave = dosagePlan ? dosagePlan.map(({ color, icon, ...rest }) => rest) : undefined;
    onSaveJournal(isNaN(dose) ? result.total : dose, planForSave);
    setSaved(true);
  };

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

      {/* Dosage Plan (replaces static timeline — Fix #12) */}
      <div style={{ ...card, borderColor: `${cc.accent}20` }}>
        <div style={{ ...lbl, color: cc.accent }}>{t("calendrierInjections")}</div>
        <div style={{ marginBottom: 10, padding: "6px 10px", background: `${cc.accent}08`, borderRadius: 8, fontSize: 11, color: cc.muted, display: "flex", gap: 6, alignItems: "center" }}>
          <span>{DIGESTION_PROFILES[digestion].icon}</span>
          <span>{t("digestionLabel")} <strong style={{ color: cc.accent }}>{DIGESTION_PROFILES[digestion].label}</strong> · {t("picMin")} {DIGESTION_PROFILES[digestion].peakMin}min · {t("finAction")} {Math.round(DIGESTION_PROFILES[digestion].tail / 60 * 10) / 10}h</span>
        </div>
        <DosagePlan
          schedule={result.schedule}
          totalDose={result.total}
          bolusType={result.bolusType}
          onPlanChange={handlePlanChange}
          t={t}
          colors={cc}
          theme={theme}
        />
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

      {/* Bloc enregistrement explicite */}
      <div style={{ ...card, borderColor: saved ? 'rgba(34,197,94,0.4)' : `${cc.accent}30`, background: saved ? (isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.04)') : (isDark ? 'rgba(14,165,233,0.04)' : 'rgba(14,165,233,0.02)') }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: saved ? '#22c55e' : cc.accent, marginBottom: 12, textTransform: 'uppercase' }}>
          {saved ? `✅ ${t("enregistre")}` : `💾 ${t("enregistrerDonnees")}`}
        </div>
        {!saved ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: cc.muted, display: 'block', marginBottom: 4 }}>{t("doseReellePrise")}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={actualDose}
                  onChange={e => setActualDose(e.target.value)}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10,
                    background: isDark ? '#0a1520' : '#f8fafc',
                    border: `1px solid ${cc.border}`,
                    color: cc.text, fontSize: 18, fontWeight: 700,
                    fontFamily: "'Syne Mono',monospace", textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: 14, color: cc.muted, fontWeight: 600 }}>U</span>
              </div>
              <div style={{ fontSize: 10, color: cc.muted, marginTop: 4 }}>
                {t("doseSuggereePar")} : {result.total}U — {t("modifierSiBesoin")}
              </div>
            </div>
            <button onClick={handleSave} style={{
              width: '100%', padding: 14, borderRadius: 12, cursor: 'pointer',
              background: `linear-gradient(135deg,${cc.accent},#0a9e8e)`,
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
              fontFamily: "'Syne Mono',monospace",
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            }}>
              💾 {t("enregistrerDonnees")}
            </button>
          </>
        ) : (
          <div style={{ fontSize: 12, color: cc.muted, lineHeight: 1.6 }}>
            {t("donneesSauvegardees")} · {t("glycPostRappel")}
          </div>
        )}
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
