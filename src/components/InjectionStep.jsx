export default function InjectionStep({ step, index, total }) {
  const isInj = step.units !== null;
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: isInj ? `${step.color}22` : "rgba(74,96,112,0.12)", border: `2px solid ${isInj ? step.color : "#2d3f50"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{step.icon}</div>
        {index < total - 1 && <div style={{ width: 2, flex: 1, minHeight: 18, background: "linear-gradient(180deg,#1c2a38,transparent)", marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: index < total - 1 ? 18 : 0 }}>
        <div style={{ fontSize: 12, color: "#3d5a73", letterSpacing: 1.5, marginBottom: 3, textTransform: "uppercase" }}>{step.time}</div>
        {isInj ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 32, fontWeight: 900, fontFamily: "'Syne Mono',monospace", color: step.color, lineHeight: 1 }}>{step.units}</span>
              <span style={{ fontSize: 14, color: "#4a6070" }}>unit\u00e9s</span>
            </div>
            <div style={{ fontSize: 11, color: "#4a6070", marginBottom: 3 }}>{step.label}</div>
          </>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 600, color: step.color, marginBottom: 3 }}>{step.label}</div>
        )}
        <div style={{ fontSize: 12, color: "#2d3f50", fontStyle: "italic" }}>{step.note}</div>
      </div>
    </div>
  );
}
