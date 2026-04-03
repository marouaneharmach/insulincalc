import { useState } from 'react';
import { DIGESTION_PROFILES } from '../data/constants.js';
import { requestNotificationPermission } from '../utils/notifications.js';
import { imcCategory } from '../utils/calculations.js';
import { PERIODS, createDefaultProfiles, getCurrentPeriodKey } from '../utils/timeProfiles.js';

function ToggleSwitch({ on, onToggle, accentColor, fallbackAccent, isDark }) {
  return (
    <button onClick={onToggle} style={{
      width: 48, height: 26, borderRadius: 13, border: 'none',
      background: on ? (accentColor || fallbackAccent) : (isDark ? '#1c2a38' : '#cbd5e1'),
      position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3,
        left: on ? 25 : 3, transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

export default function ReglagesPanel({
  ratio, setRatio, isf, setIsf,
  targetGMin, setTargetGMin, targetGMax, setTargetGMax, targetGMid,
  digestion, setDigestion, maxDose, setMaxDose,
  patientName, setPatientName,
  theme, toggleTheme, colors,
  notifEnabled, setNotifEnabled, notifDelay, setNotifDelay,
  height, setHeight, age, setAge, sex, setSex,
  imc, bsa, bmr,
  locale, setLocale,
  t, isRTL,
  timeProfiles, setTimeProfiles,
  useTimeProfiles, setUseTimeProfiles,
}) {
  const cc = colors;
  const isDark = theme === 'dark' || !theme;
  const [permStatus, setPermStatus] = useState(null);

  const card = { background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 14, padding: 18, marginBottom: 12 };
  const lbl = { fontSize: 12, letterSpacing: 2, color: cc.muted, textTransform: "uppercase", marginBottom: 8, display: "block" };
  const inp = {
    width: "100%", background: isDark ? "#070c12" : '#f8fafc',
    border: `1px solid ${cc.border}`, borderRadius: 8, color: cc.text,
    padding: "11px 14px", fontSize: 14, fontFamily: "'IBM Plex Mono',monospace",
    outline: "none", boxSizing: "border-box",
  };
  const monoBox = (color) => ({
    background: isDark ? "#070c12" : '#f8fafc',
    border: `1px solid ${color}44`, borderRadius: 8,
    padding: "6px 12px", color, fontFamily: "'IBM Plex Mono',monospace",
    fontSize: 13, minWidth: 90, textAlign: "center",
  });

  const handleNotifToggle = async () => {
    if (!notifEnabled) {
      const perm = await requestNotificationPermission();
      setPermStatus(perm);
      if (perm === 'granted') {
        setNotifEnabled(true);
      }
    } else {
      setNotifEnabled(false);
    }
  };


  return (
    <div>
      {/* PROFIL */}
      <div style={card}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: cc.accent, marginBottom: 14, textTransform: "uppercase" }}>👤 {t("profil")}</div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>{t("nomPatient")}</label>
          <input type="text" placeholder={t("pourExportPdf")} value={patientName} onChange={e => setPatientName(e.target.value)} style={inp} />
          <div style={{ color: cc.muted, fontSize: 11, marginTop: 4 }}>{t("afficheDansEntete")}</div>
        </div>
        {/* Age, Sex, Height (Fix #10) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div>
            <label style={lbl}>{t("age")}</label>
            <input type="number" min="1" max="120" placeholder="30" value={age} onChange={e => setAge(e.target.value)} style={{ ...inp, textAlign: "center" }} />
          </div>
          <div>
            <label style={lbl}>{t("taille")}</label>
            <input type="number" min="50" max="250" placeholder="170" value={height} onChange={e => setHeight(e.target.value)} style={{ ...inp, textAlign: "center" }} />
          </div>
          <div>
            <label style={lbl}>{t("sexe")}</label>
            <div style={{ display: "flex", gap: 4 }}>
              {[{v:"M",l:t("homme")},{v:"F",l:t("femme")}].map(s => (
                <button key={s.v} onClick={() => setSex(s.v)} style={{
                  flex: 1, padding: "10px 4px", border: `1px solid ${sex === s.v ? cc.accent : cc.border}`,
                  borderRadius: 8, background: sex === s.v ? `${cc.accent}18` : (isDark ? '#070c12' : '#f8fafc'),
                  color: sex === s.v ? cc.accent : cc.muted,
                  fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, cursor: "pointer",
                }}>{s.l}</button>
              ))}
            </div>
          </div>
        </div>
        {/* BMI Results (Fix #10) */}
        {imc && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div style={{ background: isDark ? "#070c12" : '#f1f5f9', borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: cc.muted, letterSpacing: 1 }}>{t("imc")}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: imc < 25 ? cc.green : imc < 30 ? cc.yellow : cc.red }}>{imc}</div>
              <div style={{ fontSize: 10, color: cc.muted }}>{imcCategory(imc)}</div>
            </div>
            {bsa && (
              <div style={{ background: isDark ? "#070c12" : '#f1f5f9', borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: cc.muted, letterSpacing: 1 }}>BSA</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#a78bfa" }}>{bsa} m²</div>
              </div>
            )}
            {bmr && (
              <div style={{ background: isDark ? "#070c12" : '#f1f5f9', borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: cc.muted, letterSpacing: 1 }}>BMR</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0ea5e9" }}>{bmr} kcal</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LANGUE (#13) */}
      <div style={card}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: '#a78bfa', marginBottom: 14, textTransform: "uppercase" }}>🌐 {t("langue")}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[{v:"fr",l:t("francais")},{v:"ar",l:t("arabe")}].map(lang => (
            <button key={lang.v} onClick={() => setLocale(lang.v)} style={{
              flex: 1, padding: "12px", border: `1px solid ${locale === lang.v ? '#a78bfa' : cc.border}`,
              borderRadius: 10, background: locale === lang.v ? 'rgba(167,139,250,0.12)' : (isDark ? '#070c12' : '#f8fafc'),
              color: locale === lang.v ? '#a78bfa' : cc.muted,
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 13,
              fontWeight: locale === lang.v ? 700 : 400, cursor: "pointer",
            }}>{lang.l}</button>
          ))}
        </div>
      </div>

      {/* APPARENCE */}
      <div style={card}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: '#a78bfa', marginBottom: 14, textTransform: "uppercase" }}>🎨 {t("apparence")}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: cc.text, marginBottom: 2 }}>{isDark ? t("modeSombre") : t("modeClair")}</div>
            <div style={{ fontSize: 11, color: cc.muted }}>{t("basculerTheme")}</div>
          </div>
          <ToggleSwitch on={!isDark} onToggle={toggleTheme} accentColor="#a78bfa" fallbackAccent={cc.accent} isDark={isDark} />
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <div style={card}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: '#f59e0b', marginBottom: 14, textTransform: "uppercase" }}>🔔 {t("notifications")}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, color: cc.text, marginBottom: 2 }}>{t("rappelPostRepas")}</div>
            <div style={{ fontSize: 11, color: cc.muted }}>{t("rappelMesurer")}</div>
          </div>
          <ToggleSwitch on={notifEnabled} onToggle={handleNotifToggle} accentColor="#f59e0b" fallbackAccent={cc.accent} isDark={isDark} />
        </div>
        {permStatus === 'denied' && (
          <div style={{ fontSize: 11, color: cc.red, marginBottom: 10, padding: '6px 10px', borderRadius: 6, background: `${cc.red}12` }}>{t("notifBloquees")}</div>
        )}
        {notifEnabled && (
          <div>
            <label style={lbl}>{t("delaiRappel")}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ label: '1h', val: 60 }, { label: '1h30', val: 90 }, { label: '2h', val: 120 }].map(opt => (
                <button key={opt.val} onClick={() => setNotifDelay(opt.val)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10,
                  border: `1px solid ${notifDelay === opt.val ? '#f59e0b' : cc.border}`,
                  background: notifDelay === opt.val ? 'rgba(245,158,11,0.12)' : (isDark ? '#070c12' : '#f8fafc'),
                  color: notifDelay === opt.val ? '#fcd34d' : cc.muted,
                  fontFamily: "'IBM Plex Mono',monospace", fontSize: 13,
                  fontWeight: notifDelay === opt.val ? 700 : 400, cursor: 'pointer',
                }}>{opt.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PARAMETRES MANUELS */}
      <div style={card}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: cc.accent, marginBottom: 14, textTransform: "uppercase" }}>⚙️ {t("parametresManuels")}</div>

        {/* Toggle: unique vs par période */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            { val: false, label: t("ratioUnique") },
            { val: true, label: t("parPeriode") },
          ].map(opt => (
            <button key={String(opt.val)} onClick={() => {
              setUseTimeProfiles(opt.val);
              if (opt.val && !timeProfiles) {
                setTimeProfiles(createDefaultProfiles(ratio, isf));
              }
            }} style={{
              flex: 1, padding: "10px 8px", borderRadius: 10,
              border: `1px solid ${useTimeProfiles === opt.val ? cc.accent : cc.border}`,
              background: useTimeProfiles === opt.val ? `${cc.accent}18` : (isDark ? '#070c12' : '#f8fafc'),
              color: useTimeProfiles === opt.val ? (cc.accentLight || cc.accent) : cc.muted,
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 12,
              fontWeight: useTimeProfiles === opt.val ? 700 : 400, cursor: "pointer",
            }}>{opt.label}</button>
          ))}
        </div>

        {!useTimeProfiles ? (
          /* Single ratio/ISF inputs (existing behavior) */
          <>
            {[
              { label: t("ratioInsulineGlucides"), val: ratio, set: setRatio, min: 5, max: 25, step: 1, display: `1 U / ${ratio}g`, note: `1 ${t("unite")} = ${ratio}g`, color: cc.accent },
              { label: t("facteurCorrection"), val: isf, set: setIsf, min: 20, max: 100, step: 5, display: `${isf} mg/dL`, note: `1 ${t("unite")} = ${isf} mg/dL (${(isf / 100).toFixed(2)} g/L)`, color: "#a78bfa" },
            ].map((p, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <label style={lbl}>{p.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={p.val} onChange={e => p.set(Number(e.target.value))} style={{ flex: 1, accentColor: p.color }} />
                  <div style={monoBox(p.color)}>{p.display}</div>
                </div>
                <div style={{ color: cc.muted, fontSize: 12, marginTop: 4, opacity: 0.6 }}>{p.note}</div>
              </div>
            ))}
          </>
        ) : (
          /* Per-period ratio/ISF table */
          <div style={{ marginBottom: 16 }}>
            {(() => {
              const currentPeriodKey = getCurrentPeriodKey(new Date().getHours());
              return PERIODS.map(period => {
                const prof = timeProfiles?.[period.key] || { ratio: ratio, isf: isf };
                const isCurrent = period.key === currentPeriodKey;
                return (
                  <div key={period.key} style={{
                    display: "grid", gridTemplateColumns: "90px 1fr 1fr", gap: 8,
                    alignItems: "center", marginBottom: 8,
                    padding: "8px 10px", borderRadius: 10,
                    background: isCurrent ? `${cc.accent}12` : 'transparent',
                    border: isCurrent ? `1px solid ${cc.accent}44` : `1px solid transparent`,
                  }}>
                    <div style={{ fontSize: 12, color: isCurrent ? cc.accent : cc.text, fontWeight: isCurrent ? 700 : 400 }}>
                      {period.icon} {period.label}
                      {isCurrent && <div style={{ fontSize: 9, color: cc.accent, marginTop: 2 }}>{t("periodeActuelle")}</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: cc.muted, marginBottom: 2 }}>ICR</div>
                      <input
                        type="number" min={5} max={25} step={1}
                        value={prof.ratio}
                        onChange={e => {
                          const v = Number(e.target.value);
                          if (v >= 5 && v <= 25) {
                            setTimeProfiles(prev => ({ ...prev, [period.key]: { ...prev[period.key], ratio: v } }));
                          }
                        }}
                        style={{ ...inp, textAlign: "center", padding: "6px 8px", fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: cc.muted, marginBottom: 2 }}>ISF</div>
                      <input
                        type="number" min={20} max={100} step={5}
                        value={prof.isf}
                        onChange={e => {
                          const v = Number(e.target.value);
                          if (v >= 20 && v <= 100) {
                            setTimeProfiles(prev => ({ ...prev, [period.key]: { ...prev[period.key], isf: v } }));
                          }
                        }}
                        style={{ ...inp, textAlign: "center", padding: "6px 8px", fontSize: 13 }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>{t("glycemieCiblePlage")}</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: cc.muted, marginBottom: 4, textAlign: "center" }}>{t("cibleMin")}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="range" min={0.6} max={1.2} step={0.1} value={targetGMin} onChange={e => {
                  const v = Number(e.target.value);
                  setTargetGMin(v);
                  if (v >= targetGMax) setTargetGMax(Math.min(v + 0.2, 2.0));
                }} style={{ flex: 1, accentColor: "#22c55e" }} />
                <div style={{ ...monoBox("#22c55e"), fontWeight: 700, minWidth: 70 }}>{targetGMin.toFixed(1)}</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: cc.muted, marginBottom: 4, textAlign: "center" }}>{t("cibleMax")}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="range" min={1.0} max={2.0} step={0.1} value={targetGMax} onChange={e => {
                  const v = Number(e.target.value);
                  setTargetGMax(v);
                  if (v <= targetGMin) setTargetGMin(Math.max(v - 0.2, 0.6));
                }} style={{ flex: 1, accentColor: "#22c55e" }} />
                <div style={{ ...monoBox("#22c55e"), fontWeight: 700, minWidth: 70 }}>{targetGMax.toFixed(1)}</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: cc.green, fontWeight: 700, textAlign: "center", padding: "8px", background: isDark ? "#070c12" : '#f1f5f9', borderRadius: 8, border: `1px solid ${cc.green}33` }}>
            {t("votreCible")} : {targetGMin.toFixed(1)} — {targetGMax.toFixed(1)} g/L ({t("correctionVers")} {targetGMid.toFixed(2)} g/L)
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>{t("digestionDefaut")}</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {Object.entries(DIGESTION_PROFILES).map(([key, dp]) => (
              <button key={key} onClick={() => setDigestion(key)} style={{
                padding: "10px", border: `1px solid ${digestion === key ? cc.accent : cc.border}`,
                borderRadius: 10, background: digestion === key ? `${cc.accent}18` : (isDark ? '#070c12' : '#f8fafc'),
                color: digestion === key ? (cc.accentLight || cc.accent) : cc.muted,
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
                cursor: "pointer", textAlign: isRTL ? "right" : "left",
              }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{dp.icon}</div>
                <div style={{ fontWeight: digestion === key ? 700 : 400, marginBottom: 2 }}>{dp.label}</div>
                <div style={{ fontSize: 12, color: digestion === key ? cc.muted : (isDark ? '#2d3f50' : '#94a3b8') }}>
                  {t("picMin")} {dp.peakMin}min · {t("finAction")} {Math.round(dp.tail / 60 * 10) / 10}h
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECURITE */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: cc.red, marginBottom: 14, textTransform: "uppercase" }}>🛡️ {t("securite")}</div>
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>{t("seuilAlerte")}</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="range" min={5} max={50} step={1} value={maxDose} onChange={e => setMaxDose(Number(e.target.value))} style={{ flex: 1, accentColor: cc.red }} />
            <div style={{ ...monoBox(cc.red), fontWeight: 700 }}>{maxDose} U</div>
          </div>
          <div style={{ color: cc.muted, fontSize: 12, marginTop: 4, opacity: 0.6 }}>{t("afficheAvertissement")}</div>
        </div>
      </div>
    </div>
  );
}
