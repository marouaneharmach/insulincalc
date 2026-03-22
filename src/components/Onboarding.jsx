import { useState } from 'react';
import { calcWeightSuggestions } from '../utils/calculations.js';

const BG = "#06101A";
const CARD = "#0A1928";
const ACCENT = "#0CBAA6";
const BORDER = "#1A2D42";
const TEXT = "#c8d6e5";
const MUTED = "#4a6070";
const MONO = "'Geist Mono','IBM Plex Mono',monospace";

const TOTAL_STEPS = 5;

export default function Onboarding({ onComplete, t: tProp, locale: localeProp, setLocale }) {
  const [step, setStep] = useState(0);

  // Langue (step 0)
  const [selectedLocale, setSelectedLocale] = useState(localeProp || 'fr');

  // Profil (step 1)
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('M');
  const [height, setHeight] = useState('');

  // Poids (step 2)
  const [weight, setWeight] = useState('');
  const [icr, setIcr] = useState(10);
  const [isf, setIsf] = useState(50);
  const [targetGMin, setTargetGMin] = useState(0.8);
  const [targetGMax, setTargetGMax] = useState(1.3);

  const tl = tProp || ((k) => k);
  const isRTL = selectedLocale === 'ar';
  const weightKg = parseFloat(weight);
  const weightOk = !isNaN(weightKg) && weightKg >= 20 && weightKg <= 200;
  const suggestions = weightOk ? calcWeightSuggestions(weightKg) : null;
  const ageOk = age !== '' && parseInt(age) >= 1 && parseInt(age) <= 120;
  const heightOk = height !== '' && parseFloat(height) >= 50 && parseFloat(height) <= 250;

  const handleLocaleChange = (loc) => {
    setSelectedLocale(loc);
    if (setLocale) setLocale(loc);
  };

  const handleWeightChange = (val) => {
    setWeight(val);
    const w = parseFloat(val);
    if (!isNaN(w) && w >= 20 && w <= 200) {
      const s = calcWeightSuggestions(w);
      if (s) { setIcr(s.icr); setIsf(s.isfMg); }
    }
  };

  const finish = () => {
    onComplete({
      weight: weightKg || 70, icr, isf,
      targetGMin, targetGMax,
      patientName, age: age ? parseInt(age) : '', sex, height: height ? parseFloat(height) : '',
      locale: selectedLocale,
    });
  };

  const dotStyle = (i) => ({
    width: step === i ? 24 : 10, height: 10, borderRadius: 5,
    background: step === i ? ACCENT : step > i ? `${ACCENT}88` : BORDER,
    transition: 'all 0.3s',
  });

  const cardStyle = {
    background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, marginBottom: 16,
  };

  const bigValue = (val, color = ACCENT) => ({
    fontFamily: MONO, fontSize: 32, fontWeight: 700, color, textAlign: 'center', lineHeight: 1.2,
  });

  const labelStyle = {
    fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: 'uppercase', marginBottom: 8, display: 'block',
  };

  const inputStyle = {
    width: '100%', background: '#070c12', border: `1px solid ${BORDER}`,
    borderRadius: 12, color: TEXT,
    padding: '14px 16px', fontSize: 15, fontFamily: MONO,
    outline: 'none', boxSizing: 'border-box',
  };

  const btnPrimary = (enabled) => ({
    width: '100%', padding: 16, borderRadius: 12, border: 'none',
    background: enabled ? `linear-gradient(135deg,${ACCENT},#0a9e8e)` : CARD,
    color: enabled ? '#fff' : MUTED, fontSize: 14, fontWeight: 700,
    fontFamily: MONO, cursor: enabled ? 'pointer' : 'not-allowed',
  });

  const btnBack = {
    flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${BORDER}`,
    background: 'transparent', color: MUTED, fontSize: 13, fontFamily: MONO, cursor: 'pointer',
  };

  const btnNext = (enabled) => ({
    flex: 2, padding: 14, borderRadius: 12, border: 'none',
    background: enabled ? `linear-gradient(135deg,${ACCENT},#0a9e8e)` : CARD,
    color: enabled ? '#fff' : MUTED, fontSize: 14, fontWeight: 700,
    fontFamily: MONO, cursor: enabled ? 'pointer' : 'not-allowed',
  });

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: BG, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: MONO, color: TEXT, overflow: 'auto',
    }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => <div key={i} style={dotStyle(i)} />)}
      </div>

      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>

        {/* STEP 0 — LANGUE */}
        {step === 0 && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>🌐</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{tl("choixLangue")}</h1>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>{tl("choixLangueDesc")}</p>
            </div>
            <div style={cardStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { v: 'fr', label: 'Français', flag: '🇫🇷', desc: 'Interface en français' },
                  { v: 'ar', label: 'العربية', flag: '🇲🇦', desc: 'الواجهة بالعربية' },
                ].map(lang => (
                  <button key={lang.v} onClick={() => handleLocaleChange(lang.v)} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 18px', borderRadius: 14,
                    border: `2px solid ${selectedLocale === lang.v ? ACCENT : BORDER}`,
                    background: selectedLocale === lang.v ? `${ACCENT}12` : '#070c12',
                    cursor: 'pointer', textAlign: isRTL ? 'right' : 'left',
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ fontSize: 28 }}>{lang.flag}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: selectedLocale === lang.v ? ACCENT : TEXT, fontFamily: MONO }}>{lang.label}</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{lang.desc}</div>
                    </div>
                    {selectedLocale === lang.v && (
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff' }}>✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setStep(1)} style={btnPrimary(true)}>{tl("continuer")}</button>
          </div>
        )}

        {/* STEP 1 — PROFIL UTILISATEUR */}
        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>👤</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{tl("votreProfil")}</h1>
              <p style={{ fontSize: 12, color: MUTED }}>{tl("votreProfilDesc")}</p>
            </div>
            <div style={cardStyle}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{tl("nomPatient")}</label>
                <input type="text" placeholder={tl("nomPlaceholder")} value={patientName} onChange={e => setPatientName(e.target.value)} style={inputStyle} />
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{tl("optionnelPourPdf")}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>{tl("age")}</label>
                  <input type="number" min="1" max="120" placeholder="30" inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} style={{ ...inputStyle, textAlign: 'center', fontSize: 22, fontWeight: 700, color: ageOk ? '#22c55e' : TEXT }} />
                </div>
                <div>
                  <label style={labelStyle}>{tl("taille")}</label>
                  <input type="number" min="50" max="250" placeholder="170" inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} style={{ ...inputStyle, textAlign: 'center', fontSize: 22, fontWeight: 700, color: heightOk ? '#22c55e' : TEXT }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{tl("sexe")}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { v: 'M', label: tl("homme"), icon: '♂' },
                    { v: 'F', label: tl("femme"), icon: '♀' },
                  ].map(s => (
                    <button key={s.v} onClick={() => setSex(s.v)} style={{
                      flex: 1, padding: '14px 10px', borderRadius: 12,
                      border: `2px solid ${sex === s.v ? ACCENT : BORDER}`,
                      background: sex === s.v ? `${ACCENT}12` : '#070c12',
                      color: sex === s.v ? ACCENT : MUTED,
                      fontFamily: MONO, fontSize: 14, fontWeight: sex === s.v ? 700 : 400,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                      <span style={{ fontSize: 20, marginRight: 6 }}>{s.icon}</span>{s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(0)} style={btnBack}>{tl("retour")}</button>
              <button onClick={() => setStep(2)} style={btnNext(true)}>{tl("continuer")}</button>
            </div>
          </div>
        )}

        {/* STEP 2 — POIDS */}
        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>💉</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{tl("bienvenue")}</h1>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>{tl("bienvenueDesc")}</p>
            </div>
            <div style={cardStyle}>
              <label style={labelStyle}>{tl("votrePoids")}</label>
              <input type="number" step="0.5" min="20" max="200" placeholder="ex : 68" inputMode="decimal" value={weight} onChange={e => handleWeightChange(e.target.value)} style={{
                width: '100%', background: '#070c12', border: `1px solid ${BORDER}`,
                borderRadius: 12, color: weightOk ? '#22c55e' : TEXT,
                padding: 16, fontSize: 28, fontFamily: MONO, fontWeight: 700,
                textAlign: 'center', outline: 'none', boxSizing: 'border-box',
              }} />
              {suggestions && (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'TDD', val: `${suggestions.tdd}U/j`, color: '#7dd3fc' },
                    { label: 'ICR', val: `1U/${suggestions.icr}g`, color: ACCENT },
                    { label: 'ISF', val: `${suggestions.isfMg}`, color: '#f59e0b' },
                  ].map((it, i) => (
                    <div key={i} style={{ background: '#070c12', borderRadius: 10, padding: '10px 8px', border: `1px solid ${BORDER}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 4 }}>{it.label}</div>
                      <div style={{ ...bigValue(it.val, it.color), fontSize: 16 }}>{it.val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={btnBack}>{tl("retour")}</button>
              <button onClick={() => setStep(3)} disabled={!weightOk} style={btnNext(weightOk)}>{tl("continuer")}</button>
            </div>
          </div>
        )}

        {/* STEP 3 — PARAMÈTRES INSULINE */}
        {step === 3 && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>⚙️</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{tl("ajustezParams")}</h1>
              <p style={{ fontSize: 12, color: MUTED }}>{tl("modifierDansReglages")}</p>
            </div>
            <div style={cardStyle}>
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>{tl("ratioInsulineGlucides")}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={5} max={25} step={1} value={icr} onChange={e => setIcr(Number(e.target.value))} style={{ flex: 1, accentColor: ACCENT }} />
                  <div style={{ background: '#070c12', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 14px', minWidth: 100, textAlign: 'center' }}>
                    <span style={{ ...bigValue('', ACCENT), fontSize: 18 }}>1U / {icr}g</span>
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>{tl("facteurCorrection")}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={20} max={100} step={5} value={isf} onChange={e => setIsf(Number(e.target.value))} style={{ flex: 1, accentColor: '#a78bfa' }} />
                  <div style={{ background: '#070c12', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 14px', minWidth: 100, textAlign: 'center' }}>
                    <span style={{ ...bigValue('', '#a78bfa'), fontSize: 18 }}>{isf} mg/dL</span>
                  </div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>{tl("glycemieCiblePlage")}</label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: MUTED, marginBottom: 4, textAlign: 'center' }}>{tl("cibleMin")}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="range" min={0.6} max={1.2} step={0.1} value={targetGMin} onChange={e => {
                        const v = Number(e.target.value);
                        setTargetGMin(v);
                        if (v >= targetGMax) setTargetGMax(Math.min(v + 0.2, 2.0));
                      }} style={{ flex: 1, accentColor: '#22c55e' }} />
                      <div style={{ background: '#070c12', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '6px 10px', minWidth: 55, textAlign: 'center' }}>
                        <span style={{ ...bigValue('', '#22c55e'), fontSize: 16 }}>{targetGMin.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: MUTED, marginBottom: 4, textAlign: 'center' }}>{tl("cibleMax")}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="range" min={1.0} max={2.0} step={0.1} value={targetGMax} onChange={e => {
                        const v = Number(e.target.value);
                        setTargetGMax(v);
                        if (v <= targetGMin) setTargetGMin(Math.max(v - 0.2, 0.6));
                      }} style={{ flex: 1, accentColor: '#22c55e' }} />
                      <div style={{ background: '#070c12', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '6px 10px', minWidth: 55, textAlign: 'center' }}>
                        <span style={{ ...bigValue('', '#22c55e'), fontSize: 16 }}>{targetGMax.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ background: '#070c12', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                  <span style={{ ...bigValue('', '#22c55e'), fontSize: 16 }}>{tl("votreCible")} : {targetGMin.toFixed(1)} — {targetGMax.toFixed(1)} g/L</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={btnBack}>{tl("retour")}</button>
              <button onClick={() => setStep(4)} style={btnNext(true)}>{tl("continuer")}</button>
            </div>
          </div>
        )}

        {/* STEP 4 — RÉSUMÉ */}
        {step === 4 && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{tl("vousPret")}</h1>
              <p style={{ fontSize: 12, color: MUTED }}>{tl("resumeParams")}</p>
            </div>
            <div style={cardStyle}>
              {/* User profile summary */}
              {patientName && (
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: MONO }}>{patientName}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                    {age && `${age} ${tl("ans")}`}{age && height ? ' · ' : ''}{height && `${height} cm`}{(age || height) && sex ? ' · ' : ''}{sex === 'M' ? tl("homme") : tl("femme")}
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: tl("poidsKg"), val: `${weight} ${tl("uniteKg")}`, color: '#22c55e', icon: "⚖" },
                  { label: 'ICR', val: `1U/${icr}g`, color: ACCENT, icon: "💉" },
                  { label: 'ISF', val: `${isf} mg/dL`, color: '#a78bfa', icon: "⚡" },
                  { label: tl("glycemieCible"), val: `${targetGMin.toFixed(1)}–${targetGMax.toFixed(1)} g/L`, color: '#22c55e', icon: "🎯" },
                ].map((it, i) => (
                  <div key={i} style={{ background: '#070c12', borderRadius: 12, padding: 14, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{it.icon}</div>
                    <div style={{ fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>{it.label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: it.color }}>{it.val}</div>
                  </div>
                ))}
              </div>
              {/* Language indicator */}
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0' }}>
                <span style={{ fontSize: 16 }}>{selectedLocale === 'ar' ? '🇲🇦' : '🇫🇷'}</span>
                <span style={{ fontSize: 12, color: MUTED }}>{selectedLocale === 'ar' ? 'العربية' : 'Français'}</span>
              </div>
            </div>
            <div style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: ACCENT, lineHeight: 1.5 }}>
              {tl("valeursEstim")}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(3)} style={btnBack}>{tl("retour")}</button>
              <button onClick={finish} style={btnNext(true)}>{tl("commencer")}</button>
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
