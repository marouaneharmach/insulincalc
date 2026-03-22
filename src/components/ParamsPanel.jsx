import { DIGESTION_PROFILES } from '../data/constants.js';
import { C } from '../utils/colors.js';

export default function ParamsPanel({ ratio, setRatio, isf, setIsf, targetG, setTargetG, digestion, setDigestion, maxDose, setMaxDose }) {
  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 12 };
  const lbl = { fontSize: 12, letterSpacing: 2, color: C.muted, textTransform: "uppercase", marginBottom: 8, display: "block" };

  return (
    <div>
      {/* MANUAL PARAMS */}
      <div style={card}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: C.accent, marginBottom: 14, textTransform: "uppercase" }}>Param\u00e8tres manuels</div>

        {[{ label: "Ratio insuline / glucides (ICR)", val: ratio, set: setRatio, min: 5, max: 25, step: 1, display: `1 U / ${ratio}g`, note: `1 unit\u00e9 couvre ${ratio}g de glucides`, color: C.accent }, { label: "Facteur de correction (ISF)", val: isf, set: setIsf, min: 20, max: 100, step: 5, display: `${isf} mg/dL`, note: `1 unit\u00e9 baisse de ${isf} mg/dL (${(isf / 100).toFixed(2)} g/L)`, color: "#a78bfa" }].map((p, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <label style={lbl}>{p.label}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="range" min={p.min} max={p.max} step={p.step} value={p.val} onChange={e => p.set(Number(e.target.value))} style={{ flex: 1, accentColor: p.color }} />
              <div style={{ background: "#070c12", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", color: p.color, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, minWidth: 90, textAlign: "center" }}>{p.display}</div>
            </div>
            <div style={{ color: "#2d3f50", fontSize: 12, marginTop: 4 }}>{p.note}</div>
          </div>
        ))}

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Glyc\u00e9mie cible</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="range" min={1.0} max={1.8} step={0.1} value={targetG} onChange={e => setTargetG(Number(e.target.value))} style={{ flex: 1, accentColor: C.green }} />
            <div style={{ background: "#070c12", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "6px 12px", color: C.green, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, minWidth: 90, textAlign: "center", fontWeight: 700 }}>{targetG.toFixed(1)} g/L</div>
          </div>
          <div style={{ marginTop: 10, position: "relative", height: 6, background: "#1c2a38", borderRadius: 99 }}>
            <div style={{ position: "absolute", left: 0, width: "25%", height: "100%", borderRadius: "99px 0 0 99px", background: "rgba(239,68,68,0.3)" }} />
            <div style={{ position: "absolute", left: "25%", width: "50%", height: "100%", background: "rgba(34,197,94,0.25)" }} />
            <div style={{ position: "absolute", left: "75%", right: 0, height: "100%", borderRadius: "0 99px 99px 0", background: "rgba(245,158,11,0.3)" }} />
            <div style={{ position: "absolute", top: -4, left: `${Math.min(Math.max(((targetG - 1.0) / 0.8) * 50 + 25, 0), 100)}%`, width: 14, height: 14, borderRadius: "50%", background: C.green, border: "2px solid #07090f", transform: "translateX(-50%)", transition: "left 0.3s" }} />
          </div>
          <div style={{ fontSize: 12, color: C.green, marginTop: 6, fontWeight: 700 }}>Votre cible : {targetG.toFixed(1)} g/L</div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Vitesse de digestion par d\u00e9faut</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {Object.entries(DIGESTION_PROFILES).map(([key, dp]) => (
              <button key={key} onClick={() => setDigestion(key)} style={{ padding: "10px", border: `1px solid ${digestion === key ? C.accent : C.border}`, borderRadius: 10, background: digestion === key ? C.adim : "#070c14", color: digestion === key ? C.accentLight || "#5EECD5" : C.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{dp.icon}</div>
                <div style={{ fontWeight: digestion === key ? 700 : 400, marginBottom: 2 }}>{dp.label}</div>
                <div style={{ fontSize: 12, color: digestion === key ? "#4a8fa8" : "#2d3f50" }}>Pic {dp.peakMin}min {"\u00b7"} Fin {Math.round(dp.tail / 60 * 10) / 10}h</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: C.red, marginBottom: 14, textTransform: "uppercase" }}>S\u00e9curit\u00e9</div>
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Seuil d'alerte dose maximale</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="range" min={5} max={50} step={1} value={maxDose} onChange={e => setMaxDose(Number(e.target.value))} style={{ flex: 1, accentColor: C.red }} />
            <div style={{ background: "#070c12", border: `1px solid ${C.red}44`, borderRadius: 8, padding: "6px 12px", color: C.red, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, minWidth: 90, textAlign: "center", fontWeight: 700 }}>{maxDose} U</div>
          </div>
          <div style={{ color: "#2d3f50", fontSize: 12, marginTop: 4 }}>Affiche un avertissement si la dose d\u00e9passe ce seuil</div>
        </div>
      </div>
    </div>
  );
}
