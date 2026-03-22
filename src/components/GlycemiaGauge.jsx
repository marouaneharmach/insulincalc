import { C, glycColor, glycLabel } from '../utils/colors.js';

/**
 * Semi-circular arc gauge for glycemia display.
 * Zones: red hypo → orange low → green target → orange high → red hyper
 */
export default function GlycemiaGauge({ value, targetG }) {
  const gVal = parseFloat(value);
  const hasValue = !isNaN(gVal) && gVal >= 0.3 && gVal <= 6.0;

  // Arc geometry
  const cx = 150, cy = 140, r = 110;
  const startAngle = Math.PI; // 180° (left)
  const endAngle = 0;        // 0° (right)

  // Zone boundaries in g/L mapped to arc fractions [0..1]
  // 0.3 → 0, 6.0 → 1
  const minG = 0.3, maxG = 4.0; // clamp display range
  const toFrac = (v) => Math.max(0, Math.min(1, (v - minG) / (maxG - minG)));

  // Zone definitions (fraction of arc)
  const zones = [
    { from: toFrac(0.3), to: toFrac(0.7), color: "#ef4444" },   // hypo sévère
    { from: toFrac(0.7), to: toFrac(1.0), color: "#f97316" },   // limite basse
    { from: toFrac(1.0), to: toFrac(1.8), color: "#22c55e" },   // zone cible
    { from: toFrac(1.8), to: toFrac(2.5), color: "#f97316" },   // élevée
    { from: toFrac(2.5), to: toFrac(4.0), color: "#ef4444" },   // hyper
  ];

  const fracToAngle = (frac) => Math.PI - frac * Math.PI;
  const polarToXY = (angle, radius) => ({
    x: cx + radius * Math.cos(angle),
    y: cy - radius * Math.sin(angle),
  });

  const describeArc = (startFrac, endFrac, innerR, outerR) => {
    const a1 = fracToAngle(startFrac);
    const a2 = fracToAngle(endFrac);
    const outerStart = polarToXY(a1, outerR);
    const outerEnd = polarToXY(a2, outerR);
    const innerEnd = polarToXY(a2, innerR);
    const innerStart = polarToXY(a1, innerR);
    const largeArc = Math.abs(a1 - a2) > Math.PI ? 1 : 0;
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
      'Z'
    ].join(' ');
  };

  // Needle position
  const needleFrac = hasValue ? toFrac(gVal) : 0.5;
  const needleAngle = fracToAngle(needleFrac);
  const needleTip = polarToXY(needleAngle, r + 6);
  const needleBase1 = polarToXY(needleAngle + 0.06, 12);
  const needleBase2 = polarToXY(needleAngle - 0.06, 12);

  const displayColor = hasValue ? glycColor(gVal) : "#2d3f50";
  const label = hasValue ? glycLabel(gVal) : "Saisissez votre glycémie";

  return (
    <div style={{ textAlign: "center", padding: "8px 0 0" }}>
      <svg viewBox="0 0 300 160" style={{ width: "100%", maxWidth: 320, height: "auto" }}>
        {/* Background track */}
        <path
          d={describeArc(0, 1, r - 16, r)}
          fill="#0f1f2e"
          stroke={C.border}
          strokeWidth={0.5}
        />

        {/* Colored zones */}
        {zones.map((z, i) => (
          <path
            key={i}
            d={describeArc(z.from, z.to, r - 16, r)}
            fill={z.color}
            opacity={hasValue ? 0.85 : 0.3}
            style={{ transition: "opacity 0.3s" }}
          />
        ))}

        {/* Zone separators */}
        {[toFrac(0.7), toFrac(1.0), toFrac(1.8), toFrac(2.5)].map((frac, i) => {
          const angle = fracToAngle(frac);
          const p1 = polarToXY(angle, r - 18);
          const p2 = polarToXY(angle, r + 2);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={C.bg} strokeWidth={2} />;
        })}

        {/* Tick marks */}
        {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5].map((v, i) => {
          const frac = toFrac(v);
          const angle = fracToAngle(frac);
          const p1 = polarToXY(angle, r + 2);
          const p2 = polarToXY(angle, r + 8);
          const pLabel = polarToXY(angle, r + 20);
          return (
            <g key={i}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={C.muted} strokeWidth={1} opacity={0.5} />
              <text x={pLabel.x} y={pLabel.y} textAnchor="middle" dominantBaseline="middle" fill={C.muted} fontSize={9} fontFamily="'IBM Plex Mono',monospace">
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Needle */}
        {hasValue && (
          <g style={{ transition: "all 0.5s ease-out" }}>
            <polygon
              points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
              fill={displayColor}
              opacity={0.9}
            />
            <circle cx={cx} cy={cy} r={8} fill={C.card} stroke={displayColor} strokeWidth={2} />
          </g>
        )}

        {/* Center value */}
        <text x={cx} y={cy - 30} textAnchor="middle" dominantBaseline="middle"
          fill={displayColor} fontSize={hasValue ? 38 : 16} fontWeight={700}
          fontFamily="'Syne Mono',monospace"
          style={{ transition: "fill 0.3s" }}>
          {hasValue ? gVal.toFixed(2) : "—"}
        </text>
        {hasValue && (
          <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
            fill={C.muted} fontSize={11} fontFamily="'IBM Plex Mono',monospace">
            g/L
          </text>
        )}
      </svg>

      {/* Label below */}
      <div style={{
        marginTop: -8,
        fontSize: 13,
        fontWeight: 600,
        color: displayColor,
        fontFamily: "'IBM Plex Mono',monospace",
        letterSpacing: 0.5,
        transition: "color 0.3s",
      }}>
        {label}
      </div>

      {hasValue && gVal !== parseFloat(targetG) && (
        <div style={{
          marginTop: 4,
          fontSize: 11,
          color: C.muted,
        }}>
          Écart cible : {gVal > targetG ? "+" : ""}{(gVal - targetG).toFixed(2)} g/L
        </div>
      )}
    </div>
  );
}
