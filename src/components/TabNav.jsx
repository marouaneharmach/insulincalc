import { C } from '../utils/colors.js';

export default function TabNav({ tab, setTab, selections, className, colors, theme, journal, journalCount: journalCountProp, t }) {
  const cc = colors || C;
  const isDark = theme === 'dark' || !theme;
  const journalCount = journalCountProp != null ? journalCountProp : (journal ? journal.length : 0);

  return (
    <div className={className} style={{ maxWidth: 520, margin: "10px auto 0", padding: "0 20px" }}>
      <div style={{ display: "flex", background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 10, padding: 3 }}>
        {[
          { id: "accueil", label: t ? t("tabAccueil") || "🏠 Accueil" : "🏠 Accueil" },
          { id: "repas", label: t ? t("tabRepas") : "🍽 Repas", badge: selections.length },
          { id: "resultat", label: t ? t("tabResultat") : "⚡ Résultat" },
          { id: "journal", label: t ? t("tabJournal") : "📋 Journal", badge: journalCount > 0 ? journalCount : 0 },
          { id: "params", label: t ? t("tabParams") : "⚙ Réglages" },
        ].map(tb => (
          <button key={tb.id} className="tb" aria-label={`Onglet ${tb.label}`} onClick={() => setTab(tb.id)} style={{
            flex: 1, padding: "9px 2px", border: "none", borderRadius: 8,
            background: tab === tb.id ? (isDark ? "#0d1f30" : '#e2e8f0') : "transparent",
            color: tab === tb.id ? cc.accent : cc.muted,
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
            cursor: "pointer", position: "relative", transition: "all 0.15s",
          }}>
            {tb.label}
            {tb.badge > 0 && <span style={{ position: "absolute", top: 3, right: 2, background: cc.accent, color: "#fff", borderRadius: 99, fontSize: 10, padding: "0px 4px", fontWeight: 700, lineHeight: '16px' }}>{tb.badge > 99 ? '99+' : tb.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}