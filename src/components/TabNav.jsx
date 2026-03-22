import { C } from '../utils/colors.js';

export default function TabNav({ tab, setTab, selections, className }) {
  return (
    <div className={className} style={{ maxWidth: 520, margin: "10px auto 0", padding: "0 20px" }}>
      <div style={{ display: "flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3 }}>
        {[{ id: "repas", label: "\ud83c\udf7d Repas", badge: selections.length }, { id: "saisie", label: "\ud83e\ude78 Saisie" }, { id: "resultat", label: "\u26a1 R\u00e9sultat" }, { id: "params", label: "\u2699 Params" }].map(t => (
          <button key={t.id} className="tb" aria-label={`Onglet ${t.label}`} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "9px 2px", border: "none", borderRadius: 8, background: tab === t.id ? "#131d2b" : "transparent", color: tab === t.id ? C.accent : C.muted, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, cursor: "pointer", position: "relative", transition: "all 0.15s" }}>
            {t.label}
            {t.badge > 0 && <span style={{ position: "absolute", top: 4, right: 8, background: C.accent, color: "#fff", borderRadius: 99, fontSize: 12, padding: "1px 5px", fontWeight: 700 }}>{"\u2713"}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
