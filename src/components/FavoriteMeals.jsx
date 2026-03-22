import { C } from '../utils/colors.js';

const MAX_FAVORITES = 20;

export default function FavoriteMeals({ selections, favorites, setFavorites, onLoadFavorite }) {
  const atLimit = favorites.length >= MAX_FAVORITES;

  const saveFavorite = () => {
    if (selections.length === 0) return;
    if (atLimit) return;
    const name = window.prompt("Nom du repas favori :");
    if (!name || !name.trim()) return;
    const newFav = {
      id: "fav_" + Date.now(),
      name: name.trim(),
      items: selections.map(s => ({ foodId: s.food.id, mult: s.mult })),
      createdAt: new Date().toISOString(),
    };
    setFavorites(prev => [newFav, ...prev]);
  };

  const deleteFavorite = (id) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

  const card = {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  };

  const lbl = {
    fontSize: 12,
    letterSpacing: 2,
    color: C.muted,
    textTransform: "uppercase",
    marginBottom: 8,
    display: "block",
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: favorites.length > 0 ? 10 : 0 }}>
        <span style={{ ...lbl, marginBottom: 0 }}>Mes repas</span>
        {selections.length > 0 && (
          <button
            onClick={saveFavorite}
            disabled={atLimit}
            title={atLimit ? `Limite de ${MAX_FAVORITES} favoris atteinte` : "Sauvegarder ce repas"}
            style={{
              padding: "6px 12px",
              border: `1px solid ${atLimit ? C.border : "rgba(14,165,233,0.4)"}`,
              borderRadius: 8,
              background: atLimit ? "transparent" : "rgba(14,165,233,0.08)",
              color: atLimit ? C.muted : C.accent,
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 12,
              cursor: atLimit ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              opacity: atLimit ? 0.5 : 1,
            }}
          >
            + Sauvegarder ce repas
          </button>
        )}
      </div>

      {atLimit && (
        <div style={{
          fontSize: 12,
          color: C.yellow,
          background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 8,
          padding: "6px 10px",
          marginBottom: favorites.length > 0 ? 10 : 0,
        }}>
          Limite de {MAX_FAVORITES} favoris atteinte. Supprimez un repas pour en ajouter un nouveau.
        </div>
      )}

      {favorites.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "10px 0" }}>
          Aucun repas sauvegardé
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {favorites.map(fav => (
            <div
              key={fav.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: C.faint,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fav.name}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {fav.items.length} aliment{fav.items.length > 1 ? "s" : ""}
                  {" · "}
                  {new Date(fav.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                </div>
              </div>
              <button
                onClick={() => onLoadFavorite(fav)}
                style={{
                  padding: "5px 10px",
                  border: `1px solid rgba(14,165,233,0.3)`,
                  borderRadius: 7,
                  background: "rgba(14,165,233,0.06)",
                  color: "#7dd3fc",
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Charger
              </button>
              <button
                onClick={() => deleteFavorite(fav.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: C.muted,
                  cursor: "pointer",
                  fontSize: 18,
                  padding: "0 2px",
                  lineHeight: 1,
                }}
                title="Supprimer ce favori"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
