import { C, GI_ICON, GI_COLOR } from '../utils/colors.js';
import QtyStepper from './QtyStepper.jsx';

export default function FoodCategory({ cat, foods, selections, openCat, setOpenCat, search, expandedId, toggleFood, updateMult }) {
  const isOpen = openCat === cat || !!search.trim();
  const selCount = foods.filter(f => selections.find(s => s.food.id === f.id)).length;
  return (
    <div style={{ marginBottom: 6 }}>
      <button className="cb" onClick={() => setOpenCat(isOpen && !search ? null : cat)} style={{ width: "100%", background: C.card, border: `1px solid ${selCount > 0 ? "rgba(14,165,233,0.35)" : C.border}`, borderRadius: isOpen ? "10px 10px 0 0" : 10, padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", color: isOpen ? "#7dd3fc" : C.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer", transition: "color 0.15s" }}>
        <span>{cat}<span style={{ fontSize: 12, color: "#2d3f50", marginLeft: 6 }}>({foods.length})</span>{selCount > 0 && <span style={{ marginLeft: 8, background: C.accent, color: "#fff", borderRadius: 99, fontSize: 12, padding: "1px 6px" }}>{selCount}</span>}</span>
        <span style={{ fontSize: 12, color: C.muted }}>{isOpen ? "\u25b2" : "\u25bc"}</span>
      </button>
      {isOpen && (
        <div style={{ background: "#070c12", border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
          <div style={{ display: "flex", padding: "5px 14px", borderBottom: `1px solid ${C.faint}` }}>
            <div style={{ flex: 1, fontSize: 12, color: "#2d3f50", letterSpacing: 1 }}>ALIMENT {"\u00b7"} PORTION DE BASE</div>
            <div style={{ fontSize: 12, color: "#2d3f50", letterSpacing: 1, minWidth: 80, textAlign: "right" }}>IG {"\u00b7"} GLUCIDES</div>
          </div>
          {foods.map((food, i) => {
            const sel = selections.find(s => s.food.id === food.id);
            const isExp = expandedId === food.id && sel;
            return (
              <div key={food.id}>
                <div className="fr" onClick={() => toggleFood(food)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: (!isExp && i < foods.length - 1) ? `1px solid ${C.faint}` : "none", background: sel ? "rgba(14,165,233,0.06)" : "transparent", transition: "background 0.12s" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${sel ? C.accent : C.border}`, background: sel ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", transition: "all 0.12s" }}>{sel ? "\u2713" : ""}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: sel ? "#7dd3fc" : "#8aa8bd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{food.name}</div>
                    <div style={{ fontSize: 12, color: "#2d3f50", marginTop: 1 }}>{food.unit}{food.note ? <span style={{ color: "#1a3040" }}> {"\u00b7"} {food.note}</span> : ""}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12 }}>{GI_ICON[food.gi]} <span style={{ fontSize: 12, color: GI_COLOR[food.gi] }}>{food.gi}</span></div>
                    <div style={{ fontSize: 13, color: sel ? C.accent : "#4a6070", fontWeight: sel ? 700 : 400 }}>{food.carbs}g</div>
                  </div>
                </div>
                {isExp && <div style={{ padding: "0 14px 12px", background: "rgba(14,165,233,0.03)", borderBottom: i < foods.length - 1 ? `1px solid ${C.faint}` : "none" }}><QtyStepper food={food} mult={sel.mult} onChange={m => updateMult(food.id, m)} /></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
