export default function InjectionStep({ step, index, total }) {
  const isInj = step.units !== null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      {/* Timeline dot + line */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0, paddingTop: 2 }}>
        <div style={{
          width: isInj ? 28 : 22, height: isInj ? 28 : 22, borderRadius: "50%",
          background: isInj ? `${step.color}30` : "rgba(74,96,112,0.12)",
          border: `2px solid ${isInj ? step.color : "#2d3f50"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: isInj ? 13 : 11, flexShrink: 0,
        }}>{step.icon}</div>
        {index < total - 1 && <div style={{ width: 2, flex: 1, minHeight: 12, background: "linear-gradient(180deg,#1c2a38,transparent)", marginTop: 3 }} />}
      </div>
      {/* Content - compact */}
      <div style={{ flex: 1, paddingBottom: index < total - 1 ? 12 : 0, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          {isInj && (
            <span style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Syne Mono',monospace", color: step.color, lineHeight: 1 }}>{step.units}U</span>
          )}
          <span style={{ fontSize: 11, color: "#3d5a73", letterSpacing: 1 }}>{step.time}</span>
        </div>
        <div style={{ fontSize: 11, color: isInj ? "#4a6070" : step.color, fontWeight: isInj ? 400 : 600, marginTop: 2 }}>{step.label}</div>
        {step.note && <div style={{ fontSize: 11, color: "#2d3f50", marginTop: 1 }}>{step.note}</div>}
      </div>
    </div>
  );
}