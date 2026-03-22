export const C = {
  bg: "#07090f", card: "#0d1117", border: "#1c2a38", accent: "#0ea5e9",
  adim: "rgba(14,165,233,0.12)", text: "#c8d6e5", muted: "#4a6070",
  faint: "#0f161e", green: "#22c55e", yellow: "#f59e0b", red: "#ef4444",
};

export const GI_ICON = { faible: "\u{1F7E2}", moyen: "\u{1F7E1}", "\u00e9lev\u00e9": "\u{1F534}" };
export const GI_COLOR = { faible: "#22c55e", moyen: "#f59e0b", "\u00e9lev\u00e9": "#ef4444" };

export function glycColor(v) {
  if (!v || isNaN(v)) return "#2d3f50";
  if (v < 0.7) return "#ef4444";
  if (v < 1.0) return "#f97316";
  if (v <= 1.8) return "#22c55e";
  if (v <= 2.0) return "#f59e0b";
  if (v <= 2.5) return "#f97316";
  if (v <= 3.0) return "#ef4444";
  return "#dc2626";
}

export function glycLabel(v) {
  if (!v || isNaN(v)) return "\u2014";
  if (v < 0.7) return "\u26A0 Hypoglyc\u00e9mie s\u00e9v\u00e8re";
  if (v < 1.0) return "Limite basse";
  if (v <= 1.8) return "\u2713 Zone cible";
  if (v <= 2.0) return "\u00c9lev\u00e9e";
  if (v <= 2.5) return "\u26A0 Hyperglyc\u00e9mie";
  if (v <= 3.0) return "\u{1F6A8} Hyper s\u00e9v\u00e8re";
  return "\u{1F6A8} URGENCE M\u00c9DICALE";
}

export function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
