import { useState } from 'react';
import { C } from '../utils/colors.js';

export default function CustomFoodForm({ onSave, onCancel, t, colors, theme }) {
  const cc = colors || C;
  const isDark = theme === 'dark' || !theme;
  const [name, setName] = useState('');
  const [carbs, setCarbs] = useState('');
  const [unit, setUnit] = useState('');
  const [fat, setFat] = useState('faible');
  const [gi, setGi] = useState('moyen');
  const [note, setNote] = useState('');

  const canSave = name.trim() && carbs && !isNaN(parseFloat(carbs));

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: 'custom_' + Date.now(),
      name: name.trim(),
      carbs: parseFloat(carbs),
      unit: unit.trim() || '1 portion',
      fat,
      gi,
      note: note.trim(),
      qty: 'plat',
    });
  };

  const inp = {
    width: "100%", background: isDark ? "#070c12" : '#f8fafc',
    border: `1px solid ${cc.border}`, borderRadius: 8, color: cc.text,
    padding: "11px 14px", fontSize: 14, fontFamily: "'IBM Plex Mono',monospace",
    outline: "none", boxSizing: "border-box",
  };
  const lbl = { fontSize: 11, letterSpacing: 1.5, color: cc.muted, textTransform: "uppercase", marginBottom: 6, display: "block" };

  return (
    <div style={{ background: cc.card, border: `1px solid ${cc.accent}40`, borderRadius: 14, padding: 18, marginBottom: 12 }}>
      <div style={{ fontSize: 12, letterSpacing: 2, color: cc.accent, marginBottom: 14, textTransform: "uppercase" }}>
        ✨ {t ? t("nouvelAliment") : "Nouvel aliment personnalisé"}
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>{t ? t("nomAliment") : "Nom"}</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Tajine maison" style={inp} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={lbl}>{t ? t("glucidesParPortion") : "Glucides (g)"}</label>
          <input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} placeholder="30" inputMode="decimal" style={{ ...inp, textAlign: "center" }} />
        </div>
        <div>
          <label style={lbl}>{t ? t("portionde") : "Portion"}</label>
          <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="1 portion · 200g" style={inp} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={lbl}>{t ? t("matieresGrasses") : "Graisses"}</label>
          <div style={{ display: "flex", gap: 3 }}>
            {["faible", "moyen", "élevé"].map(v => (
              <button key={v} onClick={() => setFat(v)} style={{
                flex: 1, padding: "8px 4px", border: `1px solid ${fat === v ? cc.accent : cc.border}`,
                borderRadius: 6, background: fat === v ? `${cc.accent}18` : 'transparent',
                color: fat === v ? cc.accent : cc.muted, fontSize: 10, cursor: "pointer",
                fontFamily: "'IBM Plex Mono',monospace",
              }}>{v}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={lbl}>{t ? t("indexGI") : "Index glycémique"}</label>
          <div style={{ display: "flex", gap: 3 }}>
            {["faible", "moyen", "élevé"].map(v => (
              <button key={v} onClick={() => setGi(v)} style={{
                flex: 1, padding: "8px 4px", border: `1px solid ${gi === v ? cc.accent : cc.border}`,
                borderRadius: 6, background: gi === v ? `${cc.accent}18` : 'transparent',
                color: gi === v ? cc.accent : cc.muted, fontSize: 10, cursor: "pointer",
                fontFamily: "'IBM Plex Mono',monospace",
              }}>{v}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>{t ? t("note") : "Note"}</label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optionnel" style={inp} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: 12, border: `1px solid ${cc.border}`, borderRadius: 10, background: "transparent", color: cc.muted, fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace" }}>
          {t ? t("annuler") : "Annuler"}
        </button>
        <button onClick={handleSave} disabled={!canSave} style={{ flex: 2, padding: 12, border: "none", borderRadius: 10, background: canSave ? `linear-gradient(135deg,${cc.accent},#0a9e8e)` : cc.card, color: canSave ? "#fff" : cc.muted, fontSize: 12, fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "'IBM Plex Mono',monospace" }}>
          {t ? t("enregistrer") : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
