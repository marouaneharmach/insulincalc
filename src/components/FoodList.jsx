import { memo } from 'react';
import { C, GI_COLOR } from '../utils/colors.js';
import FoodCategory from './FoodCategory.jsx';
import QtyStepper from './QtyStepper.jsx';

const FoodList = memo(function FoodList({ search, setSearch, filteredDB, selections, openCat, setOpenCat, expandedId, toggleFood, updateMult, inp, customFoods, onDeleteCustomFood, recentFoodIds, allFoods, t, colors, theme }) {
  const GI_BADGE_LABEL = { faible: t ? t("igBas") : "IG Bas", moyen: t ? t("igMoy") : "IG Moy", "élevé": t ? t("igHaut") : "IG Haut" };
  const cc = colors || C;
  const isDark = theme === 'dark' || !theme;
  const MY_CAT = t ? t("mesAliments") : "⭐ Mes aliments";

  const filteredCustom = customFoods && customFoods.length > 0
    ? (search.trim()
        ? customFoods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || (f.note && f.note.toLowerCase().includes(search.toLowerCase())))
        : customFoods)
    : [];

  const showMyFoods = filteredCustom.length > 0;
  const isMyOpen = openCat === MY_CAT || !!search.trim();

  // Recent foods (Fix #7)
  const recentFoods = (recentFoodIds || [])
    .map(id => allFoods ? allFoods[id] : null)
    .filter(f => f && (!search.trim() || f.name.toLowerCase().includes(search.toLowerCase())));

  return (
    <>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input type="text" placeholder={t ? t("rechercherAliment") : "🔍  Rechercher..."} aria-label="Rechercher" value={search} onChange={e => setSearch(e.target.value)} style={inp} />
        {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: cc.muted, cursor: "pointer", fontSize: 18 }}>×</button>}
      </div>

      {/* Récents (Fix #7) */}
      {recentFoods.length > 0 && !search.trim() && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: cc.muted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6, paddingLeft: 4 }}>
            {t ? t("recents") : "🕐 Récents"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {recentFoods.slice(0, 5).map(food => {
              const sel = selections.find(s => s.food.id === food.id);
              return (
                <button key={food.id} onClick={() => toggleFood(food)} style={{
                  padding: "6px 10px", borderRadius: 8,
                  border: `1px solid ${sel ? cc.accent : cc.border}`,
                  background: sel ? `${cc.accent}18` : (isDark ? "#0d1117" : "#f8fafc"),
                  color: sel ? cc.accent : cc.muted,
                  fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  {food.name} <span style={{ color: cc.accent, fontWeight: 700, marginLeft: 4 }}>{food.carbs}g</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom foods */}
      {(showMyFoods || (!search.trim() && customFoods && customFoods.length > 0)) && (
        <div style={{ marginBottom: 6 }}>
          <button className="cb" onClick={() => setOpenCat(isMyOpen && !search ? null : MY_CAT)} style={{
            width: "100%", background: cc.card,
            border: `1px solid ${(filteredCustom.some(f => selections.find(s => s.food.id === f.id))) ? "rgba(12,186,166,0.35)" : "rgba(12,186,166,0.2)"}`,
            borderRadius: isMyOpen ? "10px 10px 0 0" : 10, padding: "12px 14px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            color: isMyOpen ? (cc.accentLight || cc.accent) : cc.muted,
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer",
          }}>
            <span>{MY_CAT} <span style={{ fontSize: 12, color: cc.muted, marginLeft: 6 }}>({filteredCustom.length})</span></span>
            <span style={{ fontSize: 12, color: cc.muted }}>{isMyOpen ? "▲" : "▼"}</span>
          </button>
          {isMyOpen && (
            <div style={{ background: isDark ? "#070c14" : "#f8fafc", border: `1px solid ${cc.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
              {filteredCustom.map((food, i) => {
                const sel = selections.find(s => s.food.id === food.id);
                const isExp = expandedId === food.id && sel;
                const giColor = GI_COLOR[food.gi] || cc.muted;
                return (
                  <div key={food.id}>
                    <div className="fr" onClick={(e) => { e.preventDefault(); toggleFood(food); }} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
                      cursor: "pointer", borderBottom: (!isExp && i < filteredCustom.length - 1) ? `1px solid ${isDark ? "#0f161e" : "#edf2f7"}` : "none",
                      background: sel ? "rgba(12,186,166,0.06)" : "transparent", minHeight: 52,
                    }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `2px solid ${sel ? cc.accent : cc.border}`, background: sel ? cc.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {sel && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: sel ? (cc.accentLight || cc.accent) : (isDark ? "#8aa8bd" : "#334155"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: sel ? 600 : 400 }}>{food.name}</div>
                        <div style={{ fontSize: 11, color: cc.muted, marginTop: 2 }}>{food.unit}</div>
                      </div>
                      <div style={{ padding: "3px 8px", borderRadius: 99, background: `${giColor}18`, border: `1px solid ${giColor}44`, fontSize: 10, fontWeight: 600, color: giColor }}>{GI_BADGE_LABEL[food.gi] || food.gi}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: sel ? cc.accent : (isDark ? "#4a6070" : "#718096"), minWidth: 48, textAlign: "right", fontFamily: "'Syne Mono',monospace" }}>{food.carbs}g</div>
                      <button onClick={e => { e.stopPropagation(); onDeleteCustomFood && onDeleteCustomFood(food.id); }} title={t ? t("supprimer") : "Supprimer"} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: "0 2px", opacity: 0.6 }}>×</button>
                    </div>
                    {isExp && (
                      <div style={{ padding: "0 14px 12px", background: "rgba(12,186,166,0.03)" }}>
                        <QtyStepper food={food} mult={sel.mult} onChange={m => updateMult(food.id, m)} t={t} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Standard categories */}
      {Object.entries(filteredDB).map(([cat, foods]) => (
        <FoodCategory
          key={cat} cat={cat} foods={foods}
          selections={selections} openCat={openCat} setOpenCat={setOpenCat}
          search={search} expandedId={expandedId}
          toggleFood={toggleFood} updateMult={updateMult}
          colors={cc} theme={theme} t={t}
        />
      ))}
    </>
  );
});

export default FoodList;
