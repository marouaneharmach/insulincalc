import { useState, useMemo } from 'react';
import { C, SPACE, FONT, glycColor } from '../utils/colors.js';
import FOOD_DB from '../data/foods.js';

const MEAL_TYPES = [
  { id: "petit-déjeuner", label: "🌅 Petit-déj", short: "Petit-déj" },
  { id: "déjeuner",       label: "☀️ Déjeuner",  short: "Déjeuner" },
  { id: "dîner",          label: "🌙 Dîner",     short: "Dîner" },
  { id: "collation",      label: "🍎 Collation", short: "Collation" },
];

// Flatten food database into a searchable array (computed once)
const ALL_FOODS = Object.values(FOOD_DB).flat();

export default function JournalEntryForm({ onSave, onCancel, selections, totalCarbs, doseCalculated, glycemia, editEntry }) {
  const [mealType, setMealType] = useState(editEntry?.mealType || guessMealType());
  const [preMealGlycemia, setPreMealGlycemia] = useState(
    editEntry?.preMealGlycemia?.toString() || glycemia || ""
  );
  const [doseInjected, setDoseInjected] = useState(
    editEntry?.doseInjected?.toString() || doseCalculated?.toString() || ""
  );
  const [notes, setNotes] = useState(editEntry?.notes || "");
  const [postMealGlycemia, setPostMealGlycemia] = useState(
    editEntry?.postMealGlycemia?.toString() || ""
  );
  const [postMealTime, setPostMealTime] = useState(
    editEntry?.postMealTime?.toString() || "120"
  );
  const [showPostMeal, setShowPostMeal] = useState(
    editEntry?.postMealGlycemia != null
  );

  // Editable food list: use editEntry foods when editing, selections when creating
  const initialFoods = () => {
    if (editEntry?.foods?.length) {
      return editEntry.foods.map(f => ({
        foodId: f.foodId,
        name: f.name,
        mult: f.mult || 1,
        carbs: f.carbs || 0,
        unit: f.unit || '',
        gi: f.gi || '',
        fat: f.fat || '',
      }));
    }
    if (selections?.length) {
      return selections.map(s => ({
        foodId: s.food.id,
        name: s.food.name,
        mult: s.mult,
        carbs: Math.round(s.food.carbs * s.mult),
        unit: s.food.unit || '',
        gi: s.food.gi || '',
        fat: s.food.fat || '',
      }));
    }
    return [];
  };

  const [foods, setFoods] = useState(initialFoods);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Compute totalCarbs from current foods
  const computedTotalCarbs = useMemo(
    () => foods.reduce((sum, f) => sum + (f.carbs || 0), 0),
    [foods]
  );

  // Search results filtered by query
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return ALL_FOODS
      .filter(f => f.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery]);

  function guessMealType() {
    const h = new Date().getHours();
    if (h < 10) return "petit-déjeuner";
    if (h < 15) return "déjeuner";
    if (h < 19) return "dîner";
    return "collation";
  }

  function addFood(food) {
    setFoods(prev => [...prev, {
      foodId: food.id,
      name: food.name,
      mult: 1,
      carbs: food.carbs,
      unit: food.unit || '',
      gi: food.gi || '',
      fat: food.fat || '',
    }]);
    setSearchQuery('');
    setShowSearch(false);
  }

  function removeFood(index) {
    setFoods(prev => prev.filter((_, i) => i !== index));
  }

  function updateMult(index, newMult) {
    setFoods(prev => prev.map((f, i) => {
      if (i !== index) return f;
      const baseFoodFromDb = ALL_FOODS.find(db => db.id === f.foodId);
      const baseCarbs = baseFoodFromDb ? baseFoodFromDb.carbs : (f.mult ? f.carbs / f.mult : f.carbs);
      return {
        ...f,
        mult: newMult,
        carbs: Math.round(baseCarbs * newMult),
      };
    }));
  }

  const handleSubmit = () => {
    const preG = parseFloat(preMealGlycemia);
    const dose = parseFloat(doseInjected);
    if (isNaN(preG) || preG < 0.3 || preG > 6) return;
    if (isNaN(dose) || dose < 0) return;

    const entry = {
      mealType,
      preMealGlycemia: preG,
      foods,
      totalCarbs: computedTotalCarbs,
      doseCalculated: doseCalculated || 0,
      doseInjected: dose,
      postMealGlycemia: showPostMeal && postMealGlycemia ? parseFloat(postMealGlycemia) : null,
      postMealTime: showPostMeal && postMealTime ? parseInt(postMealTime) : null,
      correction: null,
      notes: notes.trim(),
    };

    if (editEntry) entry.id = editEntry.id;
    if (editEntry) entry.date = editEntry.date;

    onSave(entry);
  };

  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: SPACE.xl, marginBottom: SPACE.md };
  const inp = {
    width: "100%", background: "#070c12", border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text, padding: "11px 14px", fontSize: FONT.md,
    fontFamily: "'IBM Plex Mono',monospace", outline: "none", boxSizing: "border-box",
  };
  const lbl = { fontSize: FONT.xs, letterSpacing: 2, color: C.muted, textTransform: "uppercase", marginBottom: 6, display: "block" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}
    onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
        background: C.bg, borderRadius: "20px 20px 0 0", padding: "20px 20px 32px",
        borderTop: `2px solid ${C.accent}`,
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: FONT.lg, fontWeight: 700, color: "#e2edf5" }}>
            {editEntry ? "✏️ Modifier l'entrée" : "📝 Nouvelle entrée"}
          </div>
          <button onClick={onCancel} style={{
            background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer", padding: "4px 8px",
          }}>×</button>
        </div>

        {/* Meal type pills */}
        <div style={{ marginBottom: 14 }}>
          <span style={lbl}>Type de repas</span>
          <div style={{ display: "flex", gap: 6 }}>
            {MEAL_TYPES.map(mt => (
              <button key={mt.id} onClick={() => setMealType(mt.id)} style={{
                flex: 1, padding: "8px 4px", border: `1px solid ${mealType === mt.id ? C.accent : C.border}`,
                borderRadius: 8, background: mealType === mt.id ? "rgba(14,165,233,0.12)" : "#070c12",
                color: mealType === mt.id ? "#7dd3fc" : C.muted,
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer",
                transition: "all 0.15s",
              }}>
                {mt.short}
              </button>
            ))}
          </div>
        </div>

        {/* Pre-meal glycemia */}
        <div style={{ marginBottom: 14 }}>
          <span style={lbl}>🩸 Glycémie pré-repas (g/L)</span>
          <input type="number" step="0.1" min="0.3" max="6" placeholder="1.40" inputMode="decimal"
            value={preMealGlycemia} onChange={e => setPreMealGlycemia(e.target.value)}
            style={{
              ...inp, fontSize: 22, fontWeight: 700, textAlign: "center",
              color: glycColor(parseFloat(preMealGlycemia)),
            }}
          />
        </div>

        {/* Editable foods section */}
        <div style={{ ...card, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.muted }}>🍽 Aliments</span>
            <button
              onClick={() => setShowSearch(!showSearch)}
              style={{
                background: "none", border: `1px solid rgba(14,165,233,0.3)`,
                borderRadius: 6, color: C.accent, fontSize: 11, cursor: "pointer",
                padding: "2px 8px", fontFamily: "'IBM Plex Mono',monospace",
              }}
            >
              + Ajouter
            </button>
          </div>

          {/* Food search */}
          {showSearch && (
            <div style={{ marginBottom: 8, position: "relative" }}>
              <input
                type="text"
                placeholder="Rechercher un aliment..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  ...inp, fontSize: 12, padding: "8px 10px",
                  borderColor: C.accent,
                }}
              />
              {searchResults.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                  background: "#0d1520", border: `1px solid ${C.border}`,
                  borderRadius: 8, maxHeight: 180, overflowY: "auto",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}>
                  {searchResults.map(food => (
                    <button
                      key={food.id}
                      onClick={() => addFood(food)}
                      style={{
                        width: "100%", display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "8px 10px", border: "none",
                        background: "transparent", color: "#7aa0b8", fontSize: 11,
                        cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace",
                        borderBottom: `1px solid ${C.border}`,
                        textAlign: "left",
                      }}
                      onMouseOver={e => e.currentTarget.style.background = "rgba(14,165,233,0.08)"}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}
                    >
                      <span style={{ flex: 1 }}>{food.name}</span>
                      <span style={{ color: C.accent, marginLeft: 8, whiteSpace: "nowrap" }}>{food.carbs}g</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Food list */}
          {foods.length === 0 ? (
            <div style={{ fontSize: 11, color: C.muted, padding: "8px 0", textAlign: "center", fontStyle: "italic" }}>
              Aucun aliment ajouté
            </div>
          ) : (
            foods.map((f, i) => (
              <div key={`${f.foodId}-${i}`} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontSize: 11, padding: "4px 0", color: "#7aa0b8",
                borderBottom: i < foods.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none",
              }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.name}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                  <span style={{ fontSize: 10, color: C.muted }}>×</span>
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={f.mult}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) updateMult(i, val);
                    }}
                    style={{
                      width: 42, background: "#070c12", border: `1px solid ${C.border}`,
                      borderRadius: 4, color: C.text, padding: "2px 4px", fontSize: 11,
                      fontFamily: "'IBM Plex Mono',monospace", textAlign: "center", outline: "none",
                    }}
                  />
                  <span style={{ color: C.accent, minWidth: 32, textAlign: "right" }}>{f.carbs}g</span>
                  <button
                    onClick={() => removeFood(i)}
                    style={{
                      background: "none", border: "none", color: "#ef4444",
                      fontSize: 14, cursor: "pointer", padding: "0 2px", lineHeight: 1,
                    }}
                    title="Retirer"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Total carbs */}
          {foods.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: C.muted }}>Total glucides</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{computedTotalCarbs}g</span>
            </div>
          )}
        </div>

        {/* Doses */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <span style={lbl}>💊 Dose calculée</span>
            <div style={{
              ...inp, textAlign: "center", fontSize: 18, fontWeight: 700, color: C.accent,
              background: "rgba(14,165,233,0.06)", cursor: "default",
            }}>
              {doseCalculated || "—"} U
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <span style={lbl}>💉 Dose injectée</span>
            <input type="number" step="0.5" min="0" max="100" placeholder="0" inputMode="decimal"
              value={doseInjected} onChange={e => setDoseInjected(e.target.value)}
              style={{ ...inp, textAlign: "center", fontSize: 18, fontWeight: 700, color: "#22c55e" }}
            />
          </div>
        </div>

        {/* Post-meal section */}
        {!showPostMeal ? (
          <button onClick={() => setShowPostMeal(true)} style={{
            width: "100%", padding: "10px 14px", marginBottom: 14,
            border: `1px dashed rgba(14,165,233,0.3)`, borderRadius: 10,
            background: "transparent", color: C.muted,
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer",
          }}>
            + Ajouter mesure post-repas
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <span style={lbl}>📊 Glycémie post (g/L)</span>
              <input type="number" step="0.1" min="0.3" max="6" placeholder="1.80" inputMode="decimal"
                value={postMealGlycemia} onChange={e => setPostMealGlycemia(e.target.value)}
                style={{
                  ...inp, textAlign: "center", fontSize: 16, fontWeight: 700,
                  color: glycColor(parseFloat(postMealGlycemia)),
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <span style={lbl}>⏱ Délai (min)</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[60, 90, 120, 180].map(m => (
                  <button key={m} onClick={() => setPostMealTime(m.toString())} style={{
                    flex: 1, padding: "8px 2px", fontSize: 11,
                    border: `1px solid ${postMealTime === m.toString() ? C.accent : C.border}`,
                    borderRadius: 6, cursor: "pointer",
                    background: postMealTime === m.toString() ? "rgba(14,165,233,0.12)" : "#070c12",
                    color: postMealTime === m.toString() ? "#7dd3fc" : C.muted,
                    fontFamily: "'IBM Plex Mono',monospace",
                  }}>
                    {m >= 60 ? `${m / 60}h` : `${m}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 18 }}>
          <span style={lbl}>📋 Notes (optionnel)</span>
          <textarea rows={2} placeholder="Ex: sport avant, stress, maladie..."
            value={notes} onChange={e => setNotes(e.target.value)}
            style={{ ...inp, resize: "vertical", minHeight: 44 }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 14, borderRadius: 10,
            border: `1px solid ${C.border}`, background: "transparent",
            color: C.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, cursor: "pointer",
          }}>
            Annuler
          </button>
          <button onClick={handleSubmit} style={{
            flex: 2, padding: 14, borderRadius: 10,
            border: "none", background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
            color: "#fff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            {editEntry ? "✓ Mettre à jour" : "✓ Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
