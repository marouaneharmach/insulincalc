/**
 * VelocityIndicator - Displays glucose trend arrow and velocity value.
 * Color-coded by trend severity.
 */
import { VELOCITY_DISPLAY } from '../utils/velocity.js';

export default function VelocityIndicator({ trend, velocity }) {
  const display = VELOCITY_DISPLAY[trend] || VELOCITY_DISPLAY.unknown;
  if (trend === 'unknown') return null;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 6,
      background: `${display.color}15`,
      border: `1px solid ${display.color}40`,
      fontSize: 12,
      fontWeight: 700,
      color: display.color,
    }}>
      {display.arrow}
      {velocity != null && (
        <span style={{ fontSize: 10, fontWeight: 400 }}>
          {velocity > 0 ? '+' : ''}{velocity.toFixed(2)}
        </span>
      )}
    </span>
  );
}
