import { C, GI_COLOR } from '../utils/colors.js';
import QtyStepper from './QtyStepper.jsx';

const GI_BADGE_LABEL = { faible: "IG Bas", moyen: "IG Moy", "élevé": "IG Haut" };

export default function FoodCategory({ cat, foods, selections, openCat, setOpenCat, search, expandedId, toggleFood, updateMult }) {
  const isOpen = openCat === cat || !!search.trim();
  const selCount = foods.filter(f => selections.find(s => s.food.id === f.id)).length;

  return (
    <div style={{ marginBottom: 6 }}>
      <button className="cb" onClick={() => setOpenCat(isOpen && !search ? null : cat)} style={{
        width: "100%",
        background: C.card,
        border: `1px solid ${selCount > 0 ? "rgba(12,186,166,0.35)" : C.border}`,
        borderRadius: isOpen ? "10px 10px 0 0" : 10,
        padding: "12px 14px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: isOpen ? C.accentLight : C.muted,
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 12,
        cursor: "pointer",
        transition: "color 0.15s",
      }}>
        <span>
          {cat}
          <span style={{ fontSize: 12, color: "#2d3f50", marginLeft: 6 }}>({foods.length})</span>
          {selCount > 0 && (
            <span style={{ marginLeft: 8, background: C.accent, color: "#fff", borderRadius: 99, fontSize: 12, padding: "1px 6px" }}>{selCount}</span>
          )}
        </span>
        <span style={{ fontSize: 12, color: C.muted }}>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div style={{ background: "#070c14", border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
          {foods.map((food, i) => {
            const sel = selections.find(s => s.food.id === food.id);
            const isExp = expandedId === food.id && sel;
            const giColor = GI_COLOR[food.gi] || C.muted;

            return (
              <div key={food.id}>
                <div
                  className="fr"
                  onClick={() => toggleFood(food)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 14px",
                    cursor: "pointer",
                    borderBottom: (!isExp && i < foods.length - 1) ? `1px solid ${C.faint}` : "none",
                    background: sel ? "rgba(12,186,166,0.06)" : "transparent",
                    transition: "background 0.12s",
                    minHeight: 52,
                  }}
                >
                  {/* Radio circle */}
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    flexShrink: 0,
                    border: `2px solid ${sel ? C.accent : C.border}`,
                    background: sel ? C.accent : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {sel && (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />
                    )}
                  </div>

                  {/* Food info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      color: sel ? C.accentLight : "#8aa8bd",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: sel ? 600 : 400,
                    }}>
                      {food.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#2d3f50", marginTop: 2 }}>
                      {food.unit}
                      {food.note && <span style={{ color: "#1a3040" }}> · {food.note}</span>}
                    </div>
                  </div>

                  {/* IG Badge pill */}
                  <div style={{
                    padding: "3px 8px",
                    borderRadius: 99,
                    background: `${giColor}18`,
                    border: `1px solid ${giColor}44`,
                    fontSize: 10,
                    fontWeight: 600,
                    color: giColor,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}>
                    {GI_BADGE_LABEL[food.gi] || food.gi}
                  </div>

                  {/* Carbs value - big */}
                  <div style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: sel ? C.accent : "#4a6070",
                    minWidth: 48,
                    textAlign: "right",
                    flexShrink: 0,
                    fontFamily: "'Syne Mono',monospace",
                  }}>
                    {food.carbs}g
                  </div>
                </div>

                {isExp && (
                  <div style={{
                    padding: "0 14px 12px",
                    background: "rgba(12,186,166,0.03)",
                    borderBottom: i < foods.length - 1 ? `1px solid ${C.faint}` : "none",
                  }}>
                    <QtyStepper food={food} mult={sel.mult} onChange={m => updateMult(food.id, m)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
