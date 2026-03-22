import { useState } from 'react';
import { DIGESTION_PROFILES } from '../data/constants.js';
import { requestNotificationPermission } from '../utils/notifications.js';

export default function ReglagesPanel({
  ratio, setRatio, isf, setIsf, targetG, setTargetG,
  digestion, setDigestion, maxDose, setMaxDose,
  patientName, setPatientName,
  theme, toggleTheme, colors,
  notifEnabled, setNotifEnabled, notifDelay, setNotifDelay,
}) {
  const cc = colors;
  const [permStatus, setPermStatus] = useState(null);

  const card = { background: cc.card, border: `1px solid ${cc.border}`, borderRadius: 14, padding: 18, marginBottom: 12 };
  const lbl = { fontSize: 12, letterSpacing: 2, color: cc.muted, textTransform: "uppercase", marginBottom: 8, display: "block" };
  const sectionTitle = (text, color) => ({
    fontSize: 12, letterSpacing: 2, color: color || cc.accent, marginBottom: 14, textTransform: "uppercase",
  });
  const inp = {
    width: "100%", background: theme === 'light' ? '#f8fafc' : "#070c12",
    border: `1px solid ${cc.border}`, borderRadius: 8, color: cc.text,
    padding: "11px 14px", fontSize: 14, fontFamily: "'IBM Plex Mono',monospace",
    outline: "none", boxSizing: "border-box",
  };
  const monoBox = (color) => ({
    background: theme === 'light' ? '#f8fafc' : "#070c12",
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

  const ToggleSwitch = ({ on, onToggle, accentColor }) => (
    <button onClick={onToggle} style={{
      width: 48, height: 26, borderRadius: 13, border: 'none',
      background: on ? (accentColor || cc.accent) : (theme === 'light' ? '#cbd5e1' : '#1c2a38'),
      position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff', position: 'absolute', top: 3,
        left: on ? 25 : 3, transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );

  return (
    <div>
      {/* ─── PROFIL ─── */}
      <div style={card}>
        <div style={sectionTitle("\u{1F464} Profil", cc.accent)}>{"\u{1F464}"} Profil</div>
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Nom du patient</label>
          <input
            type="text" placeholder="Pour l'export PDF"
            value={patientName} onChange={e => setPatientName(e.target.value)}
            style={inp}
          />
          <div style={{ color: cc.muted, fontSize: 11, marginTop: 4 }}>
            Affiché dans l'en-tête du journal PDF exporté
          </div>
        </div>
      </div>

      {/* ─── APPARENCE ─── */}
      <div style={card}>
        <div style={sectionTitle("\u{1F3A8} Apparence", '#a78bfa')}>{"\u{1F3A8}"} Apparence</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: cc.text, marginBottom: 2 }}>
              {theme === 'dark' ? "\u{1F319} Mode sombre" : "\u2600\uFE0F Mode clair"}
            </div>
            <div style={{ fontSize: 11, color: cc.muted }}>
              Basculer entre thème clair et sombre
            </div>
          </div>
          <ToggleSwitch on={theme === 'light'} onToggle={toggleTheme} accentColor="#a78bfa" />
        </div>
      </div>

      {/* ─── NOTIFICATIONS ─── */}
      <div style={card}>
        <div style={sectionTitle("\u{1F514} Notifications", '#f59e0b')}>{"\u{1F514}"} Notifications</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, color: cc.text, marginBottom: 2 }}>
              Rappel post-repas
            </div>
            <div style={{ fontSize: 11, color: cc.muted }}>
              Rappel pour mesurer la glycémie après le repas
            </div>
          </div>
          <ToggleSwitch on={notifEnabled} onToggle={handleNotifToggle} accentColor="#f59e0b" />
        </div>

        {permStatus === 'denied' && (
          <div style={{ fontSize: 11, color: cc.red, marginBottom: 10, padding: '6px 10px', borderRadius: 6, background: `${cc.red}12` }}>
            {"\u26A0"} Notifications bloquées par le navigateur. Autorisez-les dans les paramètres.
          </div>
        )}

        {notifEnabled && (
          <div>
            <label style={lbl}>Délai de rappel</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { label: '1h', val: 60 },
                { label: '1h30', val: 90 },
                { label: '2h', val: 120 },
              ].map(opt => (
                <button key={opt.val} onClick={() => setNotifDelay(opt.val)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10,
                  border: `1px solid ${notifDelay === opt.val ? '#f59e0b' : cc.border}`,
                  background: notifDelay === opt.val ? 'rgba(245,158,11,0.12)' : (theme === 'light' ? '#f8fafc' : '#070c12'),
                  color: notifDelay === opt.val ? '#fcd34d' : cc.muted,
                  fontFamily: "'IBM Plex Mono',monospace", fontSize: 13,
                  fontWeight: notifDelay === opt.val ? 700 : 400,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── PARAMETRES MANUELS ─── */}
      <div style={card}>
        <div style={sectionTitle("\u2699\uFE0F Paramètres manuels", cc.accent)}>{"\u2699\uFE0F"} Paramètres manuels</div>

        {[
          { label: "Ratio insuline / glucides (ICR)", val: ratio, set: setRatio, min: 5, max: 25, step: 1, display: `1 U / ${ratio}g`, note: `1 unité couvre ${ratio}g de glucides`, color: cc.accent },
          { label: "Facteur de correction (ISF)", val: isf, set: setIsf, min: 20, max: 100, step: 5, display: `${isf} mg/dL`, note: `1 unité baisse de ${isf} mg/dL (${(isf / 100).toFixed(2)} g/L)`, color: "#a78bfa" },
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

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Glycémie cible</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="range" min={1.0} max={1.8} step={0.1} value={targetG} onChange={e => setTargetG(Number(e.target.value))} style={{ flex: 1, accentColor: cc.green }} />
            <div style={{ ...monoBox(cc.green), fontWeight: 700 }}>{targetG.toFixed(1)} g/L</div>
          </div>
          <div style={{ marginTop: 10, position: "relative", height: 6, background: theme === 'light' ? '#e2e8f0' : "#1c2a38", borderRadius: 99 }}>
            <div style={{ position: "absolute", left: 0, width: "25%", height: "100%", borderRadius: "99px 0 0 99px", background: "rgba(239,68,68,0.3)" }} />
            <div style={{ position: "absolute", left: "25%", width: "50%", height: "100%", background: "rgba(34,197,94,0.25)" }} />
            <div style={{ position: "absolute", left: "75%", right: 0, height: "100%", borderRadius: "0 99px 99px 0", background: "rgba(245,158,11,0.3)" }} />
            <div style={{ position: "absolute", top: -4, left: `${Math.min(Math.max(((targetG - 1.0) / 0.8) * 50 + 25, 0), 100)}%`, width: 14, height: 14, borderRadius: "50%", background: cc.green, border: `2px solid ${cc.bg}`, transform: "translateX(-50%)", transition: "left 0.3s" }} />
          </div>
          <div style={{ fontSize: 12, color: cc.green, marginTop: 6, fontWeight: 700 }}>Votre cible : {targetG.toFixed(1)} g/L</div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Vitesse de digestion par défaut</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {Object.entries(DIGESTION_PROFILES).map(([key, dp]) => (
              <button key={key} onClick={() => setDigestion(key)} style={{
                padding: "10px", border: `1px solid ${digestion === key ? cc.accent : cc.border}`,
                borderRadius: 10,
                background: digestion === key ? `${cc.accent}18` : (theme === 'light' ? '#f8fafc' : '#070c12'),
                color: digestion === key ? cc.accentLight || cc.accent : cc.muted,
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{dp.icon}</div>
                <div style={{ fontWeight: digestion === key ? 700 : 400, marginBottom: 2 }}>{dp.label}</div>
                <div style={{ fontSize: 12, color: digestion === key ? cc.muted : (theme === 'light' ? '#94a3b8' : '#2d3f50') }}>
                  Pic {dp.peakMin}min {"\u00b7"} Fin {Math.round(dp.tail / 60 * 10) / 10}h
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SECURITE ─── */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={sectionTitle("\u{1F6E1}\uFE0F Sécurité", cc.red)}>{"\u{1F6E1}\uFE0F"} Sécurité</div>
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Seuil d'alerte dose maximale</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="range" min={5} max={50} step={1} value={maxDose} onChange={e => setMaxDose(Number(e.target.value))} style={{ flex: 1, accentColor: cc.red }} />
            <div style={{ ...monoBox(cc.red), fontWeight: 700 }}>{maxDose} U</div>
          </div>
          <div style={{ color: cc.muted, fontSize: 12, marginTop: 4, opacity: 0.6 }}>
            Affiche un avertissement si la dose dépasse ce seuil
          </div>
        </div>
      </div>
    </div>
  );
}
