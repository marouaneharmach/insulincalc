import { useState } from 'react';

export default function FavoriteMeals({ selections, favorites, setFavorites, onLoadFavorite, t, colors, theme }) {
  const cc = colors || {};
  const isDark = theme === 'dark' || !theme;
  const [name, setName] = useState('');
  const [showSave, setShowSave] = useState(false);

  const handleSave = () => {
    if (!name.trim() || selections.length === 0) return;
    const fav = {
      id: Date.now(),
      name: name.trim(),
      items: selections.map(s => ({ foodId: s.food.id, mult: s.mult })),
      totalCarbs: Math.round(selections.reduce((a, s) => a + s.food.carbs * s.mult, 0)),
    };
    setFavorites(prev => [fav, ...prev]);
    setName('');
    setShowSave(false);
  };

  if (favorites.length === 0 && selections.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Save current meal */}
      {selections.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {showSave ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t ? t("nomDuRepas") : "Nom du repas"} style={{ flex: 1, background: isDark ? '#070c12' : '#f8fafc', border: `1px solid ${cc.border}`, borderRadius: 8, color: cc.text, padding: '9px 12px', fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", outline: 'none' }} />
              <button onClick={handleSave} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: name.trim() ? cc.accent : (cc.card || '#1a2d42'), color: name.trim() ? '#fff' : cc.muted, fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", cursor: name.trim() ? 'pointer' : 'default' }}>✓</button>
              <button onClick={() => setShowSave(false)} style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${cc.border}`, background: 'transparent', color: cc.muted, fontSize: 12, cursor: 'pointer' }}>×</button>
            </div>
          ) : (
            <button onClick={() => setShowSave(true)} style={{ width: '100%', padding: '9px 14px', borderRadius: 8, border: `1px dashed ${cc.accent}40`, background: 'transparent', color: cc.muted, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer' }}>
              {t ? t("enregistrerRepas") : "💾 Enregistrer ce repas"}
            </button>
          )}
        </div>
      )}

      {/* Show favorites */}
      {favorites.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: cc.muted, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>
            {t ? t("repasFavoris") : "⭐ Repas favoris"}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {favorites.map(fav => (
              <div key={fav.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: `1px solid ${cc.border}`, background: isDark ? '#0d1117' : '#f8fafc' }}>
                <button onClick={() => onLoadFavorite(fav)} style={{ background: 'none', border: 'none', color: isDark ? '#8aa8bd' : '#334155', fontSize: 11, cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", padding: 0 }}>
                  {fav.name} <span style={{ color: cc.accent, fontWeight: 700 }}>{fav.totalCarbs}g</span>
                </button>
                <button onClick={() => setFavorites(prev => prev.filter(f => f.id !== fav.id))} style={{ background: 'none', border: 'none', color: cc.muted, fontSize: 14, cursor: 'pointer', padding: '0 2px', opacity: 0.5 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
