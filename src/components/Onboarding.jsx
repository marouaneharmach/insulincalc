import { useState } from 'react';
import { calcWeightSuggestions } from '../utils/calculations.js';

const BG = "#06101A";
const CARD = "#0A1928";
const ACCENT = "#0CBAA6";
const BORDER = "#1A2D42";
const TEXT = "#c8d6e5";
const MUTED = "#4a6070";
const MONO = "'Geist Mono','IBM Plex Mono',monospace";

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState('');
  const [icr, setIcr] = useState(10);
  const [isf, setIsf] = useState(50);
  const [targetG, setTargetG] = useState(1.2);

  const weightKg = parseFloat(weight);
  const weightOk = !isNaN(weightKg) && weightKg >= 20 && weightKg <= 200;
  const suggestions = weightOk ? calcWeightSuggestions(weightKg) : null;

  // Auto-update ICR/ISF when weight changes
  const handleWeightChange = (val) => {
    setWeight(val);
    const w = parseFloat(val);
    if (!isNaN(w) && w >= 20 && w <= 200) {
      const s = calcWeightSuggestions(w);
      if (s) {
        setIcr(s.icr);
        setIsf(s.isfMg);
      }
    }
  };

  const finish = () => {
    onComplete({ weight: weightKg || 70, icr, isf, targetG });
  };

  const dotStyle = (i) => ({
    width: 10, height: 10, borderRadius: '50%',
    background: step === i ? ACCENT : BORDER,
    transition: 'all 0.3s',
  });

  const cardStyle = {
    background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
    padding: 24, marginBottom: 16,
  };

  const bigValue = (val, color = ACCENT) => ({
    fontFamily: MONO, fontSize: 32, fontWeight: 700, color,
    textAlign: 'center', lineHeight: 1.2,
  });

  const labelStyle = {
    fontSize: 11, letterSpacing: 2, color: MUTED,
    textTransform: 'uppercase', marginBottom: 8, display: 'block',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: BG, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: MONO, color: TEXT, overflow: 'hidden',
    }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {[0, 1, 2].map(i => <div key={i} style={dotStyle(i)} />)}
      </div>

      {/* Content area */}
      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>

        {/* ─── STEP 0 : Bienvenue + Poids ─── */}
        {step === 0 && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>{"\u{1F489}"}</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                Bienvenue sur InsulinCalc
              </h1>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
                Calculez vos doses d'insuline adaptées à la cuisine marocaine.
                Commençons par votre poids.
              </p>
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>{"\u2696"} Votre poids (kg)</label>
              <input
                type="number" step="0.5" min="20" max="200"
                placeholder="ex : 68" inputMode="decimal"
                value={weight}
                onChange={e => handleWeightChange(e.target.value)}
                style={{
                  width: '100%', background: '#070c12', border: `1px solid ${BORDER}`,
                  borderRadius: 12, color: weightOk ? '#22c55e' : TEXT,
                  padding: 16, fontSize: 28, fontFamily: MONO,
                  fontWeight: 700, textAlign: 'center', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              {suggestions && (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'TDD', val: `${suggestions.tdd}U/j`, color: '#7dd3fc' },
                    { label: 'ICR', val: `1U/${suggestions.icr}g`, color: ACCENT },
                    { label: 'ISF', val: `${suggestions.isfMg}`, color: '#f59e0b' },
                  ].map((it, i) => (
                    <div key={i} style={{
                      background: '#070c12', borderRadius: 10, padding: '10px 8px',
                      border: `1px solid ${BORDER}`, textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>{it.label}</div>
                      <div style={{ ...bigValue(it.val, it.color), fontSize: 16 }}>{it.val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(1)}
              disabled={!weightOk}
              style={{
                width: '100%', padding: 16, borderRadius: 12, border: 'none',
                background: weightOk ? `linear-gradient(135deg,${ACCENT},#0a9e8e)` : CARD,
                color: weightOk ? '#fff' : MUTED,
                fontSize: 14, fontWeight: 700, fontFamily: MONO,
                cursor: weightOk ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              Continuer {"\u2192"}
            </button>
          </div>
        )}

        {/* ─── STEP 1 : Ajuster ICR, ISF, Cible ─── */}
        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>{"\u2699\uFE0F"}</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                Ajustez vos paramètres
              </h1>
              <p style={{ fontSize: 12, color: MUTED }}>
                Vous pouvez les modifier à tout moment dans Réglages
              </p>
            </div>

            <div style={cardStyle}>
              {/* ICR Slider */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Ratio Insuline / Glucides (ICR)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={5} max={25} step={1} value={icr}
                    onChange={e => setIcr(Number(e.target.value))}
                    style={{ flex: 1, accentColor: ACCENT }} />
                  <div style={{
                    background: '#070c12', border: `1px solid ${BORDER}`,
                    borderRadius: 8, padding: '8px 14px', minWidth: 100, textAlign: 'center',
                  }}>
                    <span style={{ ...bigValue('', ACCENT), fontSize: 18 }}>1U / {icr}g</span>
                  </div>
                </div>
              </div>

              {/* ISF Slider */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Facteur de correction (ISF)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={20} max={100} step={5} value={isf}
                    onChange={e => setIsf(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#a78bfa' }} />
                  <div style={{
                    background: '#070c12', border: `1px solid ${BORDER}`,
                    borderRadius: 8, padding: '8px 14px', minWidth: 100, textAlign: 'center',
                  }}>
                    <span style={{ ...bigValue('', '#a78bfa'), fontSize: 18 }}>{isf} mg/dL</span>
                  </div>
                </div>
              </div>

              {/* Target Glycemia */}
              <div>
                <label style={labelStyle}>Glycémie cible</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={1.0} max={1.8} step={0.1} value={targetG}
                    onChange={e => setTargetG(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#22c55e' }} />
                  <div style={{
                    background: '#070c12', border: `1px solid rgba(34,197,94,0.3)`,
                    borderRadius: 8, padding: '8px 14px', minWidth: 100, textAlign: 'center',
                  }}>
                    <span style={{ ...bigValue('', '#22c55e'), fontSize: 18 }}>{targetG.toFixed(1)} g/L</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(0)} style={{
                flex: 1, padding: 14, borderRadius: 12,
                border: `1px solid ${BORDER}`, background: 'transparent',
                color: MUTED, fontSize: 13, fontFamily: MONO, cursor: 'pointer',
              }}>
                {"\u2190"} Retour
              </button>
              <button onClick={() => setStep(2)} style={{
                flex: 2, padding: 14, borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg,${ACCENT},#0a9e8e)`,
                color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: MONO,
                cursor: 'pointer',
              }}>
                Continuer {"\u2192"}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2 : Résumé + Commencer ─── */}
        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>{"\u2705"}</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                Vous êtes prêt !
              </h1>
              <p style={{ fontSize: 12, color: MUTED }}>
                Voici le résumé de vos paramètres initiaux
              </p>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Poids', val: `${weight} kg`, color: '#22c55e', icon: "\u2696" },
                  { label: 'Ratio ICR', val: `1U/${icr}g`, color: ACCENT, icon: "\u{1F489}" },
                  { label: 'Correction ISF', val: `${isf} mg/dL`, color: '#a78bfa', icon: "\u26A1" },
                  { label: 'Glycémie cible', val: `${targetG.toFixed(1)} g/L`, color: '#22c55e', icon: "\u{1F3AF}" },
                ].map((it, i) => (
                  <div key={i} style={{
                    background: '#070c12', borderRadius: 12, padding: 14,
                    border: `1px solid ${BORDER}`, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{it.icon}</div>
                    <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>{it.label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: it.color }}>{it.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: `${ACCENT}12`, border: `1px solid ${ACCENT}33`,
              borderRadius: 10, padding: '10px 14px', marginBottom: 16,
              fontSize: 12, color: ACCENT, lineHeight: 1.5,
            }}>
              {"\u2695\uFE0F"} Ces valeurs sont des estimations basées sur votre poids.
              Validez-les avec votre endocrinologue et ajustez-les dans Réglages.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{
                flex: 1, padding: 14, borderRadius: 12,
                border: `1px solid ${BORDER}`, background: 'transparent',
                color: MUTED, fontSize: 13, fontFamily: MONO, cursor: 'pointer',
              }}>
                {"\u2190"} Retour
              </button>
              <button onClick={finish} style={{
                flex: 2, padding: 16, borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg,${ACCENT},#0a9e8e)`,
                color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: MONO,
                cursor: 'pointer',
              }}>
                {"\u{1F680}"} Commencer
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
