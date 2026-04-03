import { C, SPACE } from '../utils/colors.js';

// ─── PATTERN ALERTS ─────────────────────────────────────────────────────────
// Renders detected patterns as color-coded alert cards.
// Props: patterns (array from detectAdvancedPatterns + detectPatterns)

export default function PatternAlerts({ patterns }) {
  if (!patterns || patterns.length === 0) return null;

  return (
    <div style={{
      background: C.card,
      border: `1px solid rgba(245,158,11,0.3)`,
      borderRadius: 14,
      padding: SPACE.xl,
      marginBottom: SPACE.md,
    }}>
      <div style={{
        fontSize: 12,
        letterSpacing: 2,
        color: '#f59e0b',
        textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        🔍 Patterns détectés
      </div>
      {patterns.map((p, i) => (
        <div
          key={`${p.type}-${i}`}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            marginBottom: i < patterns.length - 1 ? 6 : 0,
            background: p.severity === 'warning'
              ? 'rgba(239,68,68,0.08)'
              : 'rgba(14,165,233,0.06)',
            border: `1px solid ${
              p.severity === 'warning'
                ? 'rgba(239,68,68,0.3)'
                : 'rgba(14,165,233,0.2)'
            }`,
            fontSize: 11,
            color: p.severity === 'warning' ? '#fca5a5' : '#7dd3fc',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
          }}
        >
          <span style={{ flexShrink: 0 }}>{p.icon}</span>
          <span>{p.message}</span>
          {p.count != null && (
            <span style={{
              marginLeft: 'auto',
              flexShrink: 0,
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 10,
              background: p.severity === 'warning'
                ? 'rgba(239,68,68,0.15)'
                : 'rgba(14,165,233,0.12)',
              fontWeight: 600,
            }}>
              {p.count}x
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
