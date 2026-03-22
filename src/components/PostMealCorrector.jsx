import { useState } from 'react';
import { calcIOB, calcPostMealCorrection } from '../utils/calculations.js';
import { glycColor, C } from '../utils/colors.js';
import { DIGESTION_PROFILES } from '../data/constants.js';

export default function PostMealCorrector({ initialDose, isf, targetG, digestionKey }) {
  const [pmGlycemia, setPmGlycemia] = useState("");
  const [pmTime, setPmTime] = useState("90");
  const dp = DIGESTION_PROFILES[digestionKey];
  const timeOptions = [
    { v: "60", l: "1h apr\u00e8s" },
    { v: "90", l: "1h30 apr\u00e8s" },
    { v: "120", l: "2h apr\u00e8s" },
    { v: "180", l: "3h apr\u00e8s" },
    { v: "240", l: "4h apr\u00e8s" },
  ];

  const pmG = parseFloat(pmGlycemia);
  const tMin = parseInt(pmTime);
  const iob = calcIOB(initialDose, tMin, dp.tail);

  const corr = !isNaN(pmG) && pmG > 0
    ? calcPostMealCorrection(pmG, targetG, isf, iob)
    : null;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 12 }}>
      <div style={{ fontSize: 12, letterSpacing: 2, color: C.accent, marginBottom: 14, textTransform: "uppercase" }}>{"\ud83e\ude78"} Calculateur post-repas</div>
      <div style={{ fontSize: 11, color: "#3d5a73", marginBottom: 14 }}>Saisissez votre glyc\u00e9mie mesur\u00e9e apr\u00e8s le repas pour obtenir la dose de correction \u00e9ventuelle.</div>

      {/* Time selector */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>Temps \u00e9coul\u00e9 depuis le repas</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {timeOptions.map(opt => (
            <button key={opt.v} onClick={() => setPmTime(opt.v)} style={{ flex: 1, minWidth: 50, padding: "8px 4px", border: `1px solid ${pmTime === opt.v ? "#0ea5e9" : C.border}`, borderRadius: 8, background: pmTime === opt.v ? "rgba(14,165,233,0.15)" : "#070c12", color: pmTime === opt.v ? "#7dd3fc" : C.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer", fontWeight: pmTime === opt.v ? 700 : 400, transition: "all 0.12s" }}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Glycemia input */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>Glyc\u00e9mie mesur\u00e9e (g/L)</div>
        <input type="number" step="0.1" min="0.1" max="6" placeholder="ex : 2.10" value={pmGlycemia} onChange={e => setPmGlycemia(e.target.value)}
          style={{ width: "100%", background: "#070c12", border: `1px solid ${C.border}`, borderRadius: 8, color: pmG ? glycColor(pmG) : "#c8d6e5", padding: "12px 14px", fontSize: 22, fontFamily: "'IBM Plex Mono',monospace", outline: "none", boxSizing: "border-box", fontWeight: 700, textAlign: "center" }} />
      </div>

      {/* IOB display */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, background: "#070c12", borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.faint}` }}>
          <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>INSULINE ENCORE ACTIVE (IOB)</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#a78bfa" }}>{iob} U</div>
          <div style={{ fontSize: 12, color: "#2d3f50", marginTop: 2 }}>\u00e0 {tMin} min apr\u00e8s injection</div>
        </div>
        <div style={{ flex: 1, background: "#070c12", borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.faint}` }}>
          <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1, marginBottom: 3 }}>CIBLE</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>{targetG.toFixed(1)} g/L</div>
          <div style={{ fontSize: 12, color: "#2d3f50", marginTop: 2 }}>glyc\u00e9mie souhait\u00e9e</div>
        </div>
      </div>

      {/* Result */}
      {corr && (() => {
        // HYPOGLYCEMIE
        if (corr.status === "ok_low" && pmG < 0.8) return (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.5)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.red, marginBottom: 6 }}>{"\ud83d\udea8"} HYPOGLYC\u00c9MIE \u2014 Agir imm\u00e9diatement</div>
            <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.7 }}>
              Glyc\u00e9mie critique : <strong>{pmG.toFixed(1)} g/L</strong><br />
              {"\u2192"} Prendre 15g de sucres rapides (3 sucres, 150ml jus d'orange)<br />
              {"\u2192"} Contr\u00f4ler \u00e0 nouveau dans 15 minutes<br />
              {"\u2192"} Ne pas injecter d'insuline
            </div>
          </div>
        );

        // ZONE CIBLE ou LEGEREMENT BAS
        if (corr.status === "ok_low") return (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 6 }}>{"\u2705"} Aucune correction n\u00e9cessaire</div>
            <div style={{ fontSize: 11, color: "#3d6b4a", lineHeight: 1.6 }}>
              Glyc\u00e9mie \u00e0 <strong>{pmG.toFixed(1)} g/L</strong> \u2014 en dessous ou dans la cible ({targetG.toFixed(1)} g/L)<br />
              IOB encore actif : {iob} U<br />
              Pas d'injection suppl\u00e9mentaire.
            </div>
          </div>
        );

        // URGENCE — glycemie >= 3.0 g/L malgre IOB
        if (corr.status === "urgent_override") return (
          <div role="alert" style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(220,38,38,0.15)", border: "2px solid rgba(220,38,38,0.6)" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#dc2626", marginBottom: 8, textTransform: "uppercase" }}>{"\ud83c\udfe5"} URGENCE \u2014 Correction imm\u00e9diate obligatoire</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 900, fontFamily: "'Syne Mono',monospace", color: "#dc2626", lineHeight: 1 }}>{corr.units}</span>
              <span style={{ fontSize: 16, color: C.muted }}>unit\u00e9s \u00e0 injecter</span>
            </div>
            <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.7, marginBottom: 8 }}>
              Glyc\u00e9mie : <strong style={{ color: "#dc2626" }}>{pmG.toFixed(1)} g/L</strong> \u2014 seuil critique {"\u2265"} 3.0 g/L<br />
              Correction brute : {corr.rawUnits} U {"\u00b7"} IOB estim\u00e9 : {iob} U<br />
              <strong>Dose de s\u00e9curit\u00e9 appliqu\u00e9e : 50% du brut malgr\u00e9 l'IOB</strong><br />
              {"\u2192"} Contr\u00f4ler dans 45 min. Si pas de baisse {"\u2192"} re-corriger.
            </div>
            <div style={{ padding: "8px 10px", background: "rgba(220,38,38,0.1)", borderRadius: 7, fontSize: 12, color: "#fca5a5", borderLeft: "2px solid rgba(220,38,38,0.5)" }}>
              {"\ud83c\udfe5"} Consultez imm\u00e9diatement votre m\u00e9decin ou urgences si la glyc\u00e9mie persiste au-dessus de 3.0 g/L.
            </div>
          </div>
        );

        // HYPERGLYCEMIE SEVERE — glycemie 2.5-3.0 g/L, injection malgre IOB
        if (corr.status === "high_override") return (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.5)" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: C.red, marginBottom: 8, textTransform: "uppercase" }}>{"\ud83d\udea8"} Hyperglyc\u00e9mie s\u00e9v\u00e8re \u2014 Injection recommand\u00e9e</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 900, fontFamily: "'Syne Mono',monospace", color: C.red, lineHeight: 1 }}>{corr.units}</span>
              <span style={{ fontSize: 16, color: C.muted }}>unit\u00e9s \u00e0 injecter</span>
            </div>
            <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.7, marginBottom: 8 }}>
              Glyc\u00e9mie : <strong style={{ color: C.red }}>{pmG.toFixed(1)} g/L</strong> \u2014 seuil s\u00e9v\u00e8re 2.5\u20133.0 g/L<br />
              Correction brute : {corr.rawUnits} U {"\u00b7"} IOB estim\u00e9 : {iob} U<br />
              <strong>Dose de s\u00e9curit\u00e9 : 40% du brut malgr\u00e9 l'IOB</strong><br />
              {"\u2192"} Contr\u00f4ler dans 45\u201360 min.
            </div>
            <div style={{ padding: "8px 10px", background: "rgba(239,68,68,0.08)", borderRadius: 7, fontSize: 12, color: "#fca5a5", borderLeft: "2px solid rgba(239,68,68,0.4)" }}>
              Si la glyc\u00e9mie ne baisse pas dans 1h {"\u2192"} consulter votre m\u00e9decin.
            </div>
          </div>
        );

        // HYPERGLYCEMIE — glycemie 2.0-2.5 g/L, injection malgre IOB
        if (corr.status === "warn_override") return (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.5)" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#f97316", marginBottom: 8, textTransform: "uppercase" }}>{"\u26a0\ufe0f"} Hyperglyc\u00e9mie \u2014 Injection recommand\u00e9e</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 900, fontFamily: "'Syne Mono',monospace", color: "#f97316", lineHeight: 1 }}>{corr.units}</span>
              <span style={{ fontSize: 16, color: C.muted }}>unit\u00e9s \u00e0 injecter</span>
            </div>
            <div style={{ fontSize: 11, color: "#fdba74", lineHeight: 1.7, marginBottom: 8 }}>
              Glyc\u00e9mie : <strong>{pmG.toFixed(1)} g/L</strong> \u2014 au-dessus de 2.0 g/L<br />
              Correction brute : {corr.rawUnits} U {"\u00b7"} IOB estim\u00e9 : {iob} U<br />
              <strong>Dose prudente : 30% du brut malgr\u00e9 l'IOB</strong><br />
              {"\u2192"} Contr\u00f4ler dans 1h. Si pas de baisse significative {"\u2192"} re-corriger.
            </div>
            <div style={{ padding: "8px 10px", background: "rgba(249,115,22,0.08)", borderRadius: 7, fontSize: 12, color: "#fdba74", borderLeft: "2px solid rgba(249,115,22,0.4)" }}>
              {"\u2695\ufe0f"} \u00c0 2.0+ g/L, une correction s'impose m\u00eame avec de l'insuline encore active.
            </div>
          </div>
        );

        // CORRECTION NORMALE
        return (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: `${glycColor(pmG)}12`, border: `1px solid ${glycColor(pmG)}44` }}>
            <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>Dose de correction recommand\u00e9e</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Syne Mono',monospace", color: glycColor(pmG), lineHeight: 1 }}>{corr.units}</span>
              <span style={{ fontSize: 16, color: C.muted }}>unit\u00e9s</span>
            </div>
            {/* Calculation detail */}
            <div style={{ background: "#070c12", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#2d3f50", letterSpacing: 1, marginBottom: 6 }}>D\u00c9TAIL DU CALCUL</div>
              {[
                { label: `Glyc\u00e9mie mesur\u00e9e`, val: `${pmG.toFixed(1)} g/L` },
                { label: `Cible`, val: `${targetG.toFixed(1)} g/L` },
                { label: `\u00c9cart`, val: `+${corr.ecartGL} g/L (+${Math.round(corr.ecartGL * 100)} mg/dL)` },
                { label: `Correction brute`, val: `${corr.rawUnits} U` },
                { label: `IOB d\u00e9duit (${tMin}min)`, val: `\u2212${corr.iob} U` },
                { label: `Correction nette`, val: `${corr.units} U`, bold: true },
              ].map((row, i, arr) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", color: row.bold ? glycColor(pmG) : "#4a6070", fontWeight: row.bold ? 700 : 400, borderTop: i === arr.length - 1 ? "1px solid #1c2a38" : "none", marginTop: i === arr.length - 1 ? 4 : 0, paddingTop: i === arr.length - 1 ? 7 : 3 }}>
                  <span>{row.label}</span><span>{row.val}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#2d3f50", padding: "6px 10px", background: "rgba(0,0,0,0.15)", borderRadius: 7, borderLeft: `2px solid ${glycColor(pmG)}44` }}>
              {"\u2695\ufe0f"} V\u00e9rifiez toujours avec votre m\u00e9decin avant de corriger.
            </div>
          </div>
        );
      })()}
    </div>
  );
}
