import { classifyRisk, RISK_DISPLAY } from '../utils/hypoRisk.js';

export default function HypoRiskBadge({ score, showLabel = true }) {
  if (score == null) return null;
  const level = classifyRisk(score);
  const display = RISK_DISPLAY[level];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 8,
      background: display.bg, border: `1px solid ${display.border}`,
      fontSize: 12, color: display.color, fontWeight: 600,
    }}>
      <span>{display.icon}</span>
      <span style={{ fontFamily: "'Syne Mono',monospace", fontWeight: 700 }}>{score}</span>
      {showLabel && <span style={{ fontSize: 10, opacity: 0.8 }}>{display.label}</span>}
    </div>
  );
}
