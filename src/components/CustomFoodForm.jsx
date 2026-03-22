import { useState } from 'react';
import { C } from '../utils/colors.js';
import { QTY_PROFILES } from '../data/constants.js';

const QTY_KEYS = Object.keys(QTY_PROFILES);

const GI_OPTIONS = ["faible", "moyen", "élevé"];
const FAT_OPTIONS = ["aucun", "faible", "moyen", "élevé"];

export default function CustomFoodForm({ onSave, onCancel }) {
  const [name, setName] = useState("");
  const [carbs, setCarbs] = useState("");
  const [gi, setGi] = useState("moyen");
  const [fat, setFat] = useState("faible");
  const [unit, setUnit] = useState("");
  const [qty, setQty] = useState("plat");
  const [note, setNote] = useState("");

  const inp = {
    width: "100%",
    background: "#070c12",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    padding: "10px 12px",
    fontSize: 13,
    fontFamily: "'IBM Plex Mono',monospace",
    outline: "none",
    boxSizing: "border-box",
  };

  const sel = {
    ...inp,
    cursor: "pointer",
  };

  const lbl = {
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.muted,
    textTransform: "uppercase",
    display: "block",
    marginBottom: 5,
  };

  const canSave = name.trim() && carbs !== "" && !isNaN(parseFloat(carbs)) && parseFloat(carbs) >= 0;

  const handleSave = () => {
    if (!canSave) return;
    const food = {
      id: "custom_" + Date.now(),
      name: name.trim(),
      carbs: parseFloat(carbs),
      gi,
      fat,
      unit: unit.trim() || "1 portion",
      qty,
      note: note.trim(),
    };
    onSave(food);
  };

  return (
    <div style={{
      background: C.card,
      border: `1px solid rgba(14,165,233,0.35)`,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, color: "#7dd3fc", fontWeight: 700, marginBottom: 14, letterSpacing: 0.5 }}>
        + Nouvel aliment personnalisé
      </div>

      {/* Name */}
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Nom de l'aliment *</label>
        <input
          type="text"
          placeholder="ex : Mkila, Pastilla..."
          value={name}
          onChange={e => setName(e.target.value)}
          style={inp}
          autoFocus
        />
      </div>

      {/* Carbs + Unit on same row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: "0 0 110px" }}>
          <label style={lbl}>Glucides (g) *</label>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="ex : 35"
            inputMode="decimal"
            value={carbs}
            onChange={e => setCarbs(e.target.value)}
            style={{ ...inp, textAlign: "center" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Unité / portion</label>
          <input
            type="text"
            placeholder="ex : 1 portion · 100g"
            value={unit}
            onChange={e => setUnit(e.target.value)}
            style={inp}
          />
        </div>
      </div>

      {/* GI + Fat selectors */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Index glycémique</label>
          <select value={gi} onChange={e => setGi(e.target.value)} style={sel}>
            {GI_OPTIONS.map(v => (
              <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Graisses</label>
          <select value={fat} onChange={e => setFat(e.target.value)} style={sel}>
            {FAT_OPTIONS.map(v => (
              <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Qty profile */}
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Profil de quantité</label>
        <select value={qty} onChange={e => setQty(e.target.value)} style={sel}>
          {QTY_KEYS.map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      {/* Note */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Note (optionnel)</label>
        <input
          type="text"
          placeholder="ex : Riche en fibres, recette maison..."
          value={note}
          onChange={e => setNote(e.target.value)}
          style={inp}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            flex: 1,
            padding: "10px",
            border: `1px solid ${canSave ? "rgba(14,165,233,0.5)" : C.border}`,
            borderRadius: 8,
            background: canSave ? "rgba(14,165,233,0.12)" : "#070c12",
            color: canSave ? "#7dd3fc" : C.muted,
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 13,
            fontWeight: 700,
            cursor: canSave ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          Sauvegarder
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: "10px",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            background: "#070c12",
            color: C.muted,
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
