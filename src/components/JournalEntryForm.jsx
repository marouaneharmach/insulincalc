import { useState } from 'react';
import { C, SPACE, FONT, glycColor } from '../utils/colors.js';

const MEAL_TYPES = [
  { id: "petit-déjeuner", label: "🌅 Petit-déj", short: "Petit-déj" },
  { id: "déjeuner",       label: "☀️ Déjeuner",  short: "Déjeuner" },
  { id: "dîner",          label: "🌙 Dîner",     short: "Dîner" },
  { id: "collation",      label: "🍎 Collation", short: "Collation" },
];

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

  function guessMealType() {
    const h = new Date().getHours();
    if (h < 10) return "petit-déjeuner";
    if (h < 15) return "déjeuner";
    if (h < 19) return "dîner";
    return "collation";
  }

  const handleSubmit = () => {
    const preG = parseFloat(preMealGlycemia);
    const dose = parseFloat(doseInjected);
    if (isNaN(preG) || preG < 0.3 || preG > 6) return;
    if (isNaN(dose) || dose < 0) return;

    const foods = (selections || []).map(s => ({
      foodId: s.food.id,
      name: s.food.name,
      mult: s.mult,
      carbs: Math.round(s.food.carbs * s.mult),
    }));

    const entry = {
      mealType,
      preMealGlycemia: preG,
      foods,
      totalCarbs: totalCarbs || foods.reduce((s, f) => s + f.carbs, 0),
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

        {/* Foods summary */}
        {selections && selections.length > 0 && (
          <div style={{ ...card, padding: "10px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>🍽 Aliments sélectionnés</div>
            {selections.slice(0, 5).map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", color: "#7aa0b8" }}>
                <span>{s.food.name}</span>
                <span style={{ color: C.accent }}>{Math.round(s.food.carbs * s.mult)}g</span>
              </div>
            ))}
            {selections.length > 5 && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                + {selections.length - 5} autre{selections.length - 5 > 1 ? "s" : ""}
              </div>
            )}
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: C.muted }}>Total glucides</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{totalCarbs}g</span>
            </div>
          </div>
        )}

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
