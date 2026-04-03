/**
 * NightModeIndicator - Shows a compact badge when night mode is active (21h-06h)
 * Uses amber color (#f59e0b) with subtle glow effect.
 */
export default function NightModeIndicator({ active, t, colors }) {
  if (!active) return null;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      borderRadius: 6,
      background: 'rgba(245,158,11,0.1)',
      border: '1px solid rgba(245,158,11,0.3)',
      fontSize: 11,
      color: '#f59e0b',
      boxShadow: '0 0 6px rgba(245,158,11,0.15)',
    }}>
      🌙 {t?.('modeNocturne') || 'Mode nocturne'}
    </div>
  );
}
