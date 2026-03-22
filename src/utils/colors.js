export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const FONT = { xs: 12, sm: 13, md: 14, lg: 16, xl: 20, xxl: 24, display: 34, hero: 48 };

// ─── DARK THEME (default — Teal Vital) ──────────────────────────────────────
export const C = {
  bg: "#06101A", card: "#0A1928", border: "#1A2D42", accent: "#0CBAA6",
  accentLight: "#5EECD5",
  adim: "rgba(12,186,166,0.12)", text: "#c8d6e5", muted: "#4a6070",
  faint: "#0f161e", green: "#22c55e", yellow: "#f59e0b", red: "#ef4444",
};

// ─── LIGHT THEME ────────────────────────────────────────────────────────────
export const C_LIGHT = {
  bg: "#F5F7FA", card: "#FFFFFF", border: "#E2E8F0", accent: "#0CBAA6",
  accentLight: "#5EECD5",
  adim: "rgba(12,186,166,0.10)", text: "#1A202C", muted: "#718096",
  faint: "#EDF2F7", green: "#22c55e", yellow: "#f59e0b", red: "#ef4444",
};

export const GI_ICON = { faible: "\u{1F7E2}", moyen: "\u{1F7E1}", "élevé": "\u{1F534}" };
export const GI_COLOR = { faible: "#22c55e", moyen: "#f59e0b", "élevé": "#ef4444" };

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
  if (v < 0.7) return "\u26A0 Hypoglycémie sévère";
  if (v < 1.0) return "Limite basse";
  if (v <= 1.8) return "\u2713 Zone cible";
  if (v <= 2.0) return "Élevée";
  if (v <= 2.5) return "\u26A0 Hyperglycémie";
  if (v <= 3.0) return "\u{1F6A8} Hyper sévère";
  return "\u{1F6A8} URGENCE MÉDICALE";
}

export function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
