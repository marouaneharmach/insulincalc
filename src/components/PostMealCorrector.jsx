import { useState } from 'react';
import { calcIOB, calcPostMealCorrection } from '../utils/calculations.js';
import { glycColor, C } from '../utils/colors.js';
import { DIGESTION_PROFILES } from '../data/constants.js';

export default function PostMealCorrector({ initialDose, isf, targetG, digestionKey, t, colors, theme }) {
  const cc = colors || C;
  const isDark = theme === 'dark' || !theme;
  const [pmGlycemia, setPmGlycemia] = useState("");
  const [pmTime, setPmTime] = useState("90");
  const dp = DIGESTION_PROFILES[digestionKey];
  const timeOptions = [
    { v: "60", l: "1h" },
    { v: "90", l: "1h30" },
    { v: "120", l: "2h" },
    { v: "180", l: "3h" },
    { v: "240", l: "4h" },
  ];

  const pmG = parseFloat(pmGlycemia);
  const tMin = parseInt(pmTime);
  const iob = calcIOB(initialDose, tMin, dp.tail);

  const corr = !isNaN(pmG) && pmG > 0
    ? calcPostMealCorrection(pmG, targetG, isf, iob)
    : null;

  const tl = t || ((k) => k);

  return (
    <div style={{ background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 14, padding: 18, marginBottom: 12 }}>
      <div style={{ fontSize: 12, letterSpacing: 2, color: cc.accent, marginBottom: 14, textTransform: "uppercase" }}>🩸 {tl("correcteurPostRepas")}</div>

      {/* Time selector */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: cc.muted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>Temps écoulé</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {timeOptions.map(opt => (
            <button key={opt.v} onClick={() => setPmTime(opt.v)} style={{ flex: 1, minWidth: 50, padding: "8px 4px", border: `1px solid ${pmTime === opt.v ? cc.accent : cc.border}`, borderRadius: 8, background: pmTime === opt.v ? `${cc.accent}20` : (isDark ? "#070c12" : "#f8fafc"), color: pmTime === opt.v ? cc.accent : cc.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer", fontWeight: pmTime === opt.v ? 700 : 400 }}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Glycemia input */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: cc.muted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>{tl("glycemiePostRepas")} (g/L)</div>
        <input type="number" step="0.1" min="0.1" max="6" placeholder="ex : 2.10" value={pmGlycemia} onChange={e => setPmGlycemia(e.target.value)}
          style={{ width: "100%", background: isDark ? "#070c12" : "#f8fafc", border: `1px solid ${cc.border}`, borderRadius: 8, color: pmG ? glycColor(pmG) : cc.text, padding: "12px 14px", fontSize: 22, fontFamily: "'IBM Plex Mono',monospace", outline: "none", boxSizing: "border-box", fontWeight: 700, textAlign: "center" }} />
      </div>

      {/* IOB display */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, background: isDark ? "#070c12" : "#f1f5f9", borderRadius: 8, padding: "8px 10px", border: `1px solid ${isDark ? "#0f161e" : "#e2e8f0"}` }}>
          <div style={{ fontSize: 10, color: cc.muted, letterSpacing: 1, marginBottom: 3 }}>{tl("insulineRestante")}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#a78bfa" }}>{iob} U</div>
          <div style={{ fontSize: 11, color: cc.muted, marginTop: 2 }}>à {tMin} min</div>
        </div>
        <div style={{ flex: 1, background: isDark ? "#070c12" : "#f1f5f9", borderRadius: 8, padding: "8px 10px", border: `1px solid ${isDark ? "#0f161e" : "#e2e8f0"}` }}>
          <div style={{ fontSize: 10, color: cc.muted, letterSpacing: 1, marginBottom: 3 }}>{tl("cible")}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: cc.green }}>{targetG.toFixed(1)} g/L</div>
        </div>
      </div>

      {/* Result */}
      {corr && (() => {
        if (corr.status === "ok_low" && pmG < 0.8) return (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.5)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: cc.red, marginBottom: 6 }}>🚨 HYPOGLYCÉMIE — Agir immédiatement</div>
            <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.7 }}>
              Glycémie critique : <strong>{pmG.toFixed(1)} g/L</strong><br />
              → Prendre 15g de sucres rapides<br />
              → Contrôler à nouveau dans 15 minutes<br />
              → Ne pas injecter d'insuline
            </div>
          </div>
        );

        if (corr.status === "ok_low") return (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: cc.green, marginBottom: 6 }}>✅ Aucune correction nécessaire</div>
            <div style={{ fontSize: 11, color: isDark ? "#3d6b4a" : "#166534", lineHeight: 1.6 }}>
              Glycémie à <strong>{pmG.toFixed(1)} g/L</strong> — dans la cible ({targetG.toFixed(1)} g/L)<br />
              IOB : {iob} U · Pas d'injection supplémentaire.
            </div>
          </div>
        );

        if (corr.status === "urgent_override") return (
          <div role="alert" style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(220,38,38,0.15)", border: "2px solid rgba(220,38,38,0.6)" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#dc2626", marginBottom: 8, textTransform: "uppercase" }}>🏥 URGENCE — Correction immédiate</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 900, fontFamily: "'Syne Mono',monospace", color: "#dc2626", lineHeight: 1 }}>{corr.units}</span>
              <span style={{ fontSize: 16, color: cc.muted }}>{tl("unites")}</span>
            </div>
            <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.7 }}>
              Glycémie : <strong style={{ color: "#dc2626" }}>{pmG.toFixed(1)} g/L</strong> — seuil critique ≥ 3.0 g/L<br />
              Correction brute : {corr.rawUnits} U · IOB : {iob} U<br />
              → Contrôler dans 45 min. Consultez votre médecin si ≥ 3.0 g/L persiste.
            </div>
          </div>
        );

        if (corr.status === "high_override") return (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.5)" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: cc.red, marginBottom: 8, textTransform: "uppercase" }}>🚨 Hyperglycémie sévère — Injection recommandée</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 900, fontFamily: "'Syne Mono',monospace", color: cc.red, lineHeight: 1 }}>{corr.units}</span>
              <span style={{ fontSize: 16, color: cc.muted }}>{tl("unites")}</span>
            </div>
            <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.7 }}>
              Glycémie : <strong>{pmG.toFixed(1)} g/L</strong> — 2.5–3.0 g/L<br />
              Correction brute : {corr.rawUnits} U · IOB : {iob} U<br />
              → Contrôler dans 45–60 min.
            </div>
          </div>
        );

        if (corr.status === "warn_override") return (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.5)" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#f97316", marginBottom: 8, textTransform: "uppercase" }}>⚠️ Hyperglycémie — Injection recommandée</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 900, fontFamily: "'Syne Mono',monospace", color: "#f97316", lineHeight: 1 }}>{corr.units}</span>
              <span style={{ fontSize: 16, color: cc.muted }}>{tl("unites")}</span>
            </div>
            <div style={{ fontSize: 11, color: "#fdba74", lineHeight: 1.7 }}>
              Glycémie : <strong>{pmG.toFixed(1)} g/L</strong> — au-dessus de 2.0 g/L<br />
              Correction brute : {corr.rawUnits} U · IOB : {iob} U<br />
              → Contrôler dans 1h.
            </div>
          </div>
        );

        // Normal correction
        return (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: `${glycColor(pmG)}12`, border: `1px solid ${glycColor(pmG)}44` }}>
            <div style={{ fontSize: 12, color: cc.muted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{tl("correctionSuggeree")}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Syne Mono',monospace", color: glycColor(pmG), lineHeight: 1 }}>{corr.units}</span>
              <span style={{ fontSize: 16, color: cc.muted }}>{tl("unites")}</span>
            </div>
            <div style={{ background: isDark ? "#070c12" : "#f1f5f9", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
              {[
                { label: "Glycémie mesurée", val: `${pmG.toFixed(1)} g/L` },
                { label: "Cible", val: `${targetG.toFixed(1)} g/L` },
                { label: "Écart", val: `+${corr.ecartGL} g/L` },
                { label: "Correction brute", val: `${corr.rawUnits} U` },
                { label: `IOB déduit (${tMin}min)`, val: `−${corr.iob} U` },
                { label: "Correction nette", val: `${corr.units} U`, bold: true },
              ].map((row, i, arr) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", color: row.bold ? glycColor(pmG) : cc.muted, fontWeight: row.bold ? 700 : 400, borderTop: i === arr.length - 1 ? `1px solid ${cc.border}` : "none", marginTop: i === arr.length - 1 ? 4 : 0, paddingTop: i === arr.length - 1 ? 7 : 3 }}>
                  <span>{row.label}</span><span>{row.val}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: cc.muted, padding: "6px 10px", borderRadius: 7, borderLeft: `2px solid ${glycColor(pmG)}44` }}>
              ⚕️ Vérifiez toujours avec votre médecin avant de corriger.
            </div>
          </div>
        );
      })()}
    </div>
  );
}
