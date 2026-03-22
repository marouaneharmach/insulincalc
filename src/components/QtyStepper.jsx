import { QTY_PROFILES } from '../data/constants.js';
import { C } from '../utils/colors.js';

export default function QtyStepper({ food, mult, onChange }) {
  const profile = QTY_PROFILES[food.qty] || QTY_PROFILES["plat"];
  const ai = profile.findIndex(s => Math.abs(s.m - mult) < 0.01);
  const rc = Math.round(food.carbs * mult);
  return (
    <div style={{ background: "#070c12", border: "1px solid #1c2a38", borderRadius: 12, padding: "12px 14px", marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div><span style={{ fontSize: 12, color: "#4a6070", letterSpacing: 1 }}>QUANTIT\u00c9 \u00b7 </span><span style={{ fontSize: 12, color: "#7dd3fc", fontWeight: 700 }}>{ai >= 0 ? profile[ai].l : `\u00d7${mult}`}</span><span style={{ fontSize: 12, color: "#4a6070" }}> \u00b7 {food.unit}</span></div>
        <div><span style={{ fontSize: 12, color: "#4a6070" }}>glucides : </span><span style={{ fontSize: 16, color: "#0ea5e9", fontWeight: 700 }}>{rc}g</span></div>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {profile.map((step, i) => { const isA = i === ai; return (<button key={i} onClick={() => onChange(step.m)} style={{ flex: 1, minWidth: 36, padding: "9px 3px", border: `1px solid ${isA ? "#0ea5e9" : "#1c2a38"}`, borderRadius: 8, background: isA ? "rgba(14,165,233,0.2)" : "#0d1117", color: isA ? "#7dd3fc" : "#2d3f50", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer", fontWeight: isA ? 700 : 400, transition: "all 0.12s" }}>{step.l}</button>); })}
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ background: "#1c2a38", borderRadius: 99, height: 4, overflow: "hidden" }}><div style={{ width: `${Math.min((mult / 3) * 100, 100)}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#0ea5e9,#38bdf8)", transition: "width 0.25s" }} /></div>
        <div style={{ fontSize: 12, color: "#2d3f50", marginTop: 4 }}>{food.unit} \u00d7 {mult} = <strong style={{ color: "#3d7fa0" }}>{rc}g</strong> glucides{food.note ? <span style={{ color: "#1a3040" }}> \u00b7 {food.note}</span> : ""}</div>
      </div>
    </div>
  );
}
