import { useState, useEffect, useCallback } from 'react';
import { SPACE, FONT } from '../utils/colors.js';

/**
 * DosagePlan — Interactive injection schedule with fractionation UI.
 *
 * Props:
 *   schedule     — array from buildSchedule() [{timeMin, time, units, label, color, icon, note}]
 *   totalDose    — total dose (number)
 *   bolusType    — "standard" | "dual"
 *   onPlanChange — callback(planSteps) fires when plan state changes
 *   t            — i18n function
 *   colors       — theme colors object
 *   theme        — "dark" | "light"
 */
export default function DosagePlan({ schedule, totalDose, onPlanChange, t, colors, theme }) {
  const cc = colors || {};
  const isDark = theme === 'dark' || !theme;

  // Build plan steps from injection steps only (units != null)
  const buildInitialPlan = useCallback(() => {
    if (!schedule) return [];
    let idx = 0;
    return schedule
      .filter(s => s.units != null)
      .map(s => ({
        step: idx++,
        label: s.label,
        plannedDose: s.units,
        actualDose: s.units,
        taken: false,
        takenAt: null,
        timeLabel: s.time,
        color: s.color,
        icon: s.icon,
        note: s.note,
      }));
  }, [schedule]);

  const [planSteps, setPlanSteps] = useState(buildInitialPlan);

  // Reset plan when schedule changes
  useEffect(() => {
    setPlanSteps(buildInitialPlan());
  }, [buildInitialPlan]);

  // Notify parent of changes
  useEffect(() => {
    if (onPlanChange) onPlanChange(planSteps);
  }, [planSteps, onPlanChange]);

  const toggleTaken = (stepIdx) => {
    setPlanSteps(prev => prev.map((s, i) => {
      if (i !== stepIdx) return s;
      const nowTaken = !s.taken;
      return {
        ...s,
        taken: nowTaken,
        takenAt: nowTaken ? new Date().toISOString() : null,
      };
    }));
  };

  const updateActualDose = (stepIdx, value) => {
    setPlanSteps(prev => prev.map((s, i) => {
      if (i !== stepIdx) return s;
      return { ...s, actualDose: value === '' ? null : parseFloat(value) };
    }));
  };

  // Separate control checkpoints (units == null) for display
  const checkpoints = schedule ? schedule.filter(s => s.units == null) : [];

  // Styles
  const stepCard = (color, taken) => ({
    background: taken
      ? (isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.04)')
      : (isDark ? '#0a1520' : '#f8fafc'),
    border: `1px solid ${taken ? 'rgba(34,197,94,0.35)' : `${color}30`}`,
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 10,
    transition: 'all 0.2s',
  });

  const checkpointStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 8,
    background: isDark ? 'rgba(74,96,112,0.08)' : 'rgba(74,96,112,0.04)',
    border: `1px dashed ${isDark ? '#1c2a38' : '#cbd5e1'}`,
    marginBottom: 8,
    fontSize: 11,
    color: cc.muted || '#4a6070',
  };

  if (!schedule || planSteps.length === 0) return null;

  return (
    <div>
      {/* Injection steps */}
      {planSteps.map((step, i) => (
        <div key={step.step} style={stepCard(step.color, step.taken)}>
          {/* Header: icon + label + time */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `${step.color}25`,
                border: `2px solid ${step.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
              }}>
                {step.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: step.color }}>{step.label}</div>
                <div style={{ fontSize: 11, color: cc.muted || '#4a6070' }}>{step.timeLabel}</div>
              </div>
            </div>
            <div style={{
              fontSize: 18, fontWeight: 700, fontFamily: "'Syne Mono',monospace",
              color: step.color, opacity: 0.5,
            }}>
              {step.plannedDose}U
            </div>
          </div>

          {/* Dose + Checkbox row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Checkbox */}
            <button
              onClick={() => toggleTaken(i)}
              aria-label={step.taken ? (t?.('pris') || 'Pris') : (t?.('nonPris') || 'Non pris')}
              style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                border: `2px solid ${step.taken ? '#22c55e' : (cc.border || '#1c2a38')}`,
                background: step.taken ? 'rgba(34,197,94,0.15)' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
                transition: 'all 0.15s',
              }}
            >
              {step.taken ? '\u2713' : ''}
            </button>

            {/* Actual dose input */}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: cc.muted || '#4a6070', display: 'block', marginBottom: 3 }}>
                {t?.('doseReelle') || 'Dose r\u00e9elle'}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  value={step.actualDose != null ? step.actualDose : ''}
                  onChange={e => updateActualDose(i, e.target.value)}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8,
                    background: isDark ? '#070c12' : '#f1f5f9',
                    border: `1px solid ${cc.border || '#1c2a38'}`,
                    color: cc.text || '#e2e8f0', fontSize: 16, fontWeight: 700,
                    fontFamily: "'Syne Mono',monospace", textAlign: 'center',
                    maxWidth: 100,
                  }}
                />
                <span style={{ fontSize: 13, color: cc.muted || '#4a6070', fontWeight: 600 }}>U</span>
              </div>
            </div>

            {/* Taken timestamp */}
            {step.taken && step.takenAt && (
              <div style={{ fontSize: 10, color: '#22c55e', textAlign: 'right', flexShrink: 0 }}>
                {new Date(step.takenAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>

          {/* Note */}
          {step.note && (
            <div style={{ fontSize: 10, color: cc.muted || '#4a6070', marginTop: 6, paddingLeft: 54 }}>
              {step.note}
            </div>
          )}
        </div>
      ))}

      {/* Control checkpoints (non-editable milestones) */}
      {checkpoints.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {checkpoints.map((cp, i) => (
            <div key={`cp-${i}`} style={checkpointStyle}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(74,96,112,0.12)',
                border: `2px solid ${cp.color || '#2d3f50'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, flexShrink: 0,
              }}>
                {cp.icon}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: cp.color || '#4a6070' }}>{cp.label}</span>
                <span style={{ marginLeft: 8, color: cc.muted || '#4a6070' }}>{cp.time}</span>
              </div>
              {cp.note && <span style={{ fontSize: 10, color: cc.muted || '#3d5a73' }}>{cp.note}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div style={{
        marginTop: 6, padding: '8px 12px', borderRadius: 8,
        background: isDark ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.03)',
        border: `1px solid ${cc.accent || '#0ea5e9'}15`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 11, color: cc.muted || '#4a6070',
      }}>
        <span>
          {planSteps.filter(s => s.taken).length}/{planSteps.length} {t?.('injectionsPrises') || 'injection(s) prise(s)'}
        </span>
        <span style={{ fontWeight: 700, color: cc.accent || '#0ea5e9', fontFamily: "'Syne Mono',monospace" }}>
          {planSteps.reduce((sum, s) => sum + (s.taken && s.actualDose != null ? s.actualDose : 0), 0)}U / {totalDose}U
        </span>
      </div>
    </div>
  );
}
