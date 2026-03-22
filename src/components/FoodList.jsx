import { C, GI_COLOR } from '../utils/colors.js';
import FoodCategory from './FoodCategory.jsx';
import QtyStepper from './QtyStepper.jsx';

const GI_BADGE_LABEL = { faible: "IG Bas", moyen: "IG Moy", "élevé": "IG Haut" };

export default function FoodList({ search, setSearch, filteredDB, selections, openCat, setOpenCat, expandedId, toggleFood, updateMult, inp, customFoods, onDeleteCustomFood }) {
  const MY_CAT = "⭐ Mes aliments";
  const filteredCustom = customFoods && customFoods.length > 0
    ? (search.trim()
        ? customFoods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || (f.note && f.note.toLowerCase().includes(search.toLowerCase())))
        : customFoods)
    : [];

  const showMyFoods = filteredCustom.length > 0;
  const isOpen = openCat === MY_CAT || !!search.trim();

  return (
    <>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input type="text" placeholder={"🔍  Rechercher un aliment ou un plat..."} aria-label="Rechercher un aliment" value={search} onChange={e => setSearch(e.target.value)} style={inp} />
        {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>{"×"}</button>}
      </div>

      {/* Mes aliments (custom) */}
      {(showMyFoods || (!search.trim() && customFoods && customFoods.length > 0)) && (
        <div style={{ marginBottom: 6 }}>
          <button
            className="cb"
            onClick={() => setOpenCat(isOpen && !search ? null : MY_CAT)}
            style={{
              width: "100%",
              background: C.card,
              border: `1px solid ${(filteredCustom.some(f => selections.find(s => s.food.id === f.id))) ? "rgba(12,186,166,0.35)" : "rgba(12,186,166,0.2)"}`,
              borderRadius: isOpen ? "10px 10px 0 0" : 10,
              padding: "12px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: isOpen ? C.accentLight : "#5a8fa8",
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 12,
              cursor: "pointer",
              transition: "color 0.15s",
            }}
          >
            <span>
              {MY_CAT}
              <span style={{ fontSize: 12, color: "#2d3f50", marginLeft: 6 }}>({filteredCustom.length})</span>
              {filteredCustom.filter(f => selections.find(s => s.food.id === f.id)).length > 0 && (
                <span style={{ marginLeft: 8, background: C.accent, color: "#fff", borderRadius: 99, fontSize: 12, padding: "1px 6px" }}>
                  {filteredCustom.filter(f => selections.find(s => s.food.id === f.id)).length}
                </span>
              )}
            </span>
            <span style={{ fontSize: 12, color: C.muted }}>{isOpen ? "▲" : "▼"}</span>
          </button>

          {isOpen && (
            <div style={{ background: "#070c14", border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
              {filteredCustom.map((food, i) => {
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
                        borderBottom: (!isExp && i < filteredCustom.length - 1) ? `1px solid ${C.faint}` : "none",
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
                          {food.unit}{food.note ? <span style={{ color: "#1a3040" }}> · {food.note}</span> : ""}
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

                      {/* Delete button */}
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteCustomFood && onDeleteCustomFood(food.id); }}
                        title="Supprimer cet aliment"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: 16,
                          padding: "0 2px",
                          lineHeight: 1,
                          opacity: 0.6,
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                    {isExp && (
                      <div style={{ padding: "0 14px 12px", background: "rgba(12,186,166,0.03)", borderBottom: i < filteredCustom.length - 1 ? `1px solid ${C.faint}` : "none" }}>
                        <QtyStepper food={food} mult={sel.mult} onChange={m => updateMult(food.id, m)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Standard FOOD_DB categories */}
      {Object.entries(filteredDB).map(([cat, foods]) => (
        <FoodCategory
          key={cat}
          cat={cat}
          foods={foods}
          selections={selections}
          openCat={openCat}
          setOpenCat={setOpenCat}
          search={search}
          expandedId={expandedId}
          toggleFood={toggleFood}
          updateMult={updateMult}
        />
      ))}
    </>
  );
}
