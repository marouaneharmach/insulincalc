import { C } from '../utils/colors.js';

const ZONES = [
  { key: "hypo",   label: "Hypo",    color: "#ef4444", min: 0,   max: 0.7 },
  { key: "low",    label: "Basse",   color: "#f97316", min: 0.7, max: 1.0 },
  { key: "target", label: "Cible",   color: "#22c55e", min: 1.0, max: 1.8 },
  { key: "high",   label: "Élevée",  color: "#f59e0b", min: 1.8, max: 2.5 },
  { key: "hyper",  label: "Hyper",   color: "#ef4444", min: 2.5, max: Infinity },
];

export default function TimeInRange({ stats }) {
  if (!stats || stats.measureCount === 0) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: C.muted }}>Aucune mesure disponible pour le Time-in-Range</div>
      </div>
    );
  }

  const percents = [
    stats.hypoPercent,
    stats.lowPercent,
    stats.targetPercent,
    stats.highPercent,
    stats.hyperPercent,
  ];

  const inTarget = stats.targetPercent;
  const goalMet = inTarget >= 70;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: C.accent, textTransform: "uppercase" }}>
          Time in Range
        </div>
        <div style={{
          fontSize: 11,
          padding: "3px 10px",
          borderRadius: 99,
          background: goalMet ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
          border: `1px solid ${goalMet ? "rgba(34,197,94,0.4)" : "rgba(245,158,11,0.4)"}`,
          color: goalMet ? "#22c55e" : "#f59e0b",
        }}>
          {goalMet ? "✓ Objectif atteint" : `Objectif : ≥ 70%`}
        </div>
      </div>

      {/* Bar */}
      <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
        {ZONES.map((zone, i) => {
          const pct = percents[i];
          if (pct === 0) return null;
          return (
            <div key={zone.key} style={{
              width: `${pct}%`,
              background: zone.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: pct > 0 ? 18 : 0,
              transition: "width 0.4s ease",
            }}>
              {pct >= 8 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                  {pct}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {ZONES.map((zone, i) => (
          <div key={zone.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.muted }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: zone.color }} />
            <span>{zone.label}</span>
            <span style={{ color: zone.color, fontWeight: 600 }}>{percents[i]}%</span>
          </div>
        ))}
      </div>

      {/* Big number: target % */}
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <span style={{
          fontSize: 36,
          fontWeight: 700,
          fontFamily: "'Syne Mono',monospace",
          color: goalMet ? "#22c55e" : "#f59e0b",
        }}>
          {inTarget}%
        </span>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          en zone cible (1.0 – 1.8 g/L) sur {stats.measureCount} mesures
        </div>
      </div>
    </div>
  );
}
