import { useMemo } from 'react';
import { C, SPACE, FONT, glycColor } from '../utils/colors.js';
import { getEntries } from '../data/journalStore.js';
import { calcIOB } from '../utils/calculations.js';
import { calcHypoRiskScore, classifyRisk } from '../utils/hypoRisk.js';
import { isNightMode } from '../utils/clinicalEngine.js';
import VelocityIndicator from './VelocityIndicator.jsx';
import HypoRiskBadge from './HypoRiskBadge.jsx';
import NightModeIndicator from './NightModeIndicator.jsx';
import PatternAlerts from './PatternAlerts.jsx';
import { detectAdvancedPatterns } from '../utils/patternDetector.js';
import { detectPatterns } from '../utils/calculations.js';

export default function Dashboard({ setTab, t, colors, theme, journalRefreshKey }) {
  const cc = colors || C;
  const isDark = theme === 'dark' || !theme;

  // Compute dashboard data from journal
  const dashData = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const recentEntries = getEntries(7);
    const last3 = recentEntries.slice(0, 3);
    const lastEntry = recentEntries.length > 0 ? recentEntries[0] : null;

    // IOB computation
    const insulinDurationMin = 240;
    const iobTotal = recentEntries.reduce((sum, entry) => {
      const entryTime = new Date(entry.date).getTime();
      const minutesAgo = (now.getTime() - entryTime) / 60000;
      if (minutesAgo >= insulinDurationMin || minutesAgo < 0) return sum;
      const dose = entry.doseInjected || entry.doseCalculated || 0;
      if (dose <= 0) return sum;
      return sum + calcIOB(dose, minutesAgo, insulinDurationMin);
    }, 0);

    // Max IOB for bar display (estimate from recent max dose)
    const maxRecentDose = recentEntries.reduce((max, e) => {
      const d = e.doseInjected || e.doseCalculated || 0;
      return d > max ? d : max;
    }, 5);

    // Hypo risk
    let hypoRiskScore = null;
    if (lastEntry && lastEntry.preMealGlycemia != null) {
      hypoRiskScore = calcHypoRiskScore({
        glycemia: lastEntry.preMealGlycemia,
        iobTotal,
        trend: lastEntry.velocityTrend || 'unknown',
        hypoIn24h: recentEntries.some(e => e.preMealGlycemia != null && e.preMealGlycemia < 0.7),
        activity: lastEntry.activitePhysique || null,
        currentHour,
      });
    }

    // Time since last entry
    let minutesAgo = null;
    if (lastEntry) {
      minutesAgo = Math.round((now.getTime() - new Date(lastEntry.date).getTime()) / 60000);
    }

    // Patterns
    const allRecent = getEntries(14);
    const basicPatterns = detectPatterns(allRecent);
    const advancedPatterns = detectAdvancedPatterns(allRecent);
    const seenTypes = new Set(basicPatterns.map(p => p.type));
    const patterns = [...basicPatterns];
    advancedPatterns.forEach(p => {
      if (!seenTypes.has(p.type)) {
        patterns.push(p);
        seenTypes.add(p.type);
      }
    });

    return {
      lastEntry,
      last3,
      iobTotal: Math.round(iobTotal * 100) / 100,
      maxRecentDose,
      hypoRiskScore,
      nightMode: isNightMode(currentHour),
      minutesAgo,
      patterns,
    };
  }, [journalRefreshKey]);

  const { lastEntry, last3, iobTotal, maxRecentDose, hypoRiskScore, nightMode, minutesAgo, patterns } = dashData;

  const card = {
    background: cc.card,
    border: `1px solid ${cc.border}`,
    borderRadius: 14,
    padding: SPACE.xl,
    marginBottom: SPACE.md,
  };

  function formatTimeAgo(min) {
    if (min == null) return '';
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h < 24) return `il y a ${h}h${m > 0 ? `${m.toString().padStart(2, '0')}` : ''}`;
    const d = Math.floor(h / 24);
    return `il y a ${d}j`;
  }

  const MEAL_ICONS = {
    "petit-déjeuner": "🌅",
    "déjeuner": "☀️",
    "dîner": "🌙",
    "collation": "🍎",
  };

  return (
    <div>
      {/* 1. Current Status Card */}
      <div style={{ ...card, borderColor: `${cc.accent}40` }}>
        <div style={{
          fontSize: 12, letterSpacing: 2, color: cc.accent,
          textTransform: "uppercase", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          📊 {t?.('etatActuel') || 'Etat actuel'}
          {nightMode && <NightModeIndicator active={true} t={t} colors={cc} />}
        </div>

        {lastEntry ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{
                fontSize: 36, fontWeight: 900, fontFamily: "'Syne Mono',monospace",
                color: glycColor(lastEntry.preMealGlycemia),
                lineHeight: 1,
              }}>
                {lastEntry.preMealGlycemia?.toFixed(2) || '—'}
              </div>
              <div>
                <div style={{ fontSize: 12, color: cc.muted }}>g/L</div>
                <div style={{ fontSize: 11, color: cc.muted }}>
                  {formatTimeAgo(minutesAgo)}
                </div>
              </div>
              {lastEntry.velocityTrend && lastEntry.velocityTrend !== 'unknown' && (
                <VelocityIndicator trend={lastEntry.velocityTrend} velocity={lastEntry.velocity} />
              )}
            </div>
            {hypoRiskScore != null && (
              <div style={{ marginTop: 4 }}>
                <HypoRiskBadge score={hypoRiskScore} showLabel={true} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0", color: cc.muted, fontSize: 13 }}>
            {t?.('aucuneMesure') || 'Aucune mesure enregistr\u00e9e.'}
            <br />{t?.('commencezCalculer') || 'Commencez par calculer un repas.'}
          </div>
        )}
      </div>

      {/* 2. IOB Card */}
      <div style={card}>
        <div style={{
          fontSize: 12, letterSpacing: 2, color: cc.accent,
          textTransform: "uppercase", marginBottom: 10,
        }}>
          💉 {t?.('insulineActive') || 'Insuline active (IOB)'}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            fontSize: 28, fontWeight: 900, fontFamily: "'Syne Mono',monospace",
            color: iobTotal > 0 ? '#f59e0b' : cc.muted,
          }}>
            {iobTotal > 0 ? `${iobTotal}U` : '0U'}
          </div>
          <div style={{ fontSize: 11, color: cc.muted }}>
            {iobTotal > 0 ? (t?.('encoreEnAction') || 'encore en action') : (t?.('aucuneInsulineResiduelle') || 'aucune insuline r\u00e9siduelle')}
          </div>
        </div>
        {/* IOB decay bar */}
        <div style={{
          width: '100%', height: 8, background: isDark ? '#0d1520' : '#e2e8f0',
          borderRadius: 4, overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(100, (iobTotal / Math.max(maxRecentDose, 1)) * 100)}%`,
            height: '100%',
            background: iobTotal > 3 ? '#ef4444' : iobTotal > 1.5 ? '#f59e0b' : '#22c55e',
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* 3. Quick Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: SPACE.md }}>
        <button onClick={() => setTab('repas')} aria-label={t?.('nouveauRepasBtn') || 'Nouveau repas'} style={{
          flex: 1, padding: 14, borderRadius: 12,
          border: "none",
          background: `linear-gradient(135deg,${cc.accent},#0a9e8e)`,
          color: "#fff", fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          boxShadow: `0 4px 16px ${cc.accent}4D`,
        }}>
          🍽 {t?.('nouveauRepasBtn') || 'Nouveau repas'}
        </button>
        <button onClick={() => setTab('repas')} aria-label={t?.('correctionSeule') || 'Correction seule'} style={{
          flex: 1, padding: 14, borderRadius: 12,
          border: `1px solid ${cc.accent}40`,
          background: `${cc.accent}0F`,
          color: isDark ? '#7dd3fc' : cc.accent,
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          💉 {t?.('correctionSeule') || 'Correction seule'}
        </button>
      </div>

      {/* 4. Last 3 entries */}
      {last3.length > 0 && (
        <div style={card}>
          <div style={{
            fontSize: 12, letterSpacing: 2, color: cc.accent,
            textTransform: "uppercase", marginBottom: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>📋 {t?.('derniersEnregistrements') || 'Derniers enregistrements'}</span>
            <button onClick={() => setTab('journal')} aria-label={t?.('voirTout') || 'Voir tout'} style={{
              background: "none", border: `1px solid ${cc.border}`,
              borderRadius: 6, padding: "3px 8px", color: cc.muted,
              fontSize: 10, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace",
            }}>
              {t?.('voirTout') || 'Voir tout'}
            </button>
          </div>
          {last3.map((entry, i) => {
            const date = new Date(entry.date);
            const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
            const dateStr = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
            return (
              <div key={entry.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: i < last3.length - 1 ? `1px solid ${cc.faint || cc.border}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{MEAL_ICONS[entry.mealType] || "🍽"}</span>
                  <div>
                    <div style={{ fontSize: 11, color: isDark ? '#9ab8cc' : '#334155' }}>
                      {dateStr} {timeStr}
                    </div>
                    <div style={{ fontSize: 10, color: cc.muted }}>
                      {entry.totalCarbs}g · {entry.doseInjected || entry.doseCalculated}U
                      {entry.modeNocturne && ' 🌙'}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 15, fontWeight: 700, fontFamily: "'Syne Mono',monospace",
                    color: glycColor(entry.preMealGlycemia),
                  }}>
                    {entry.preMealGlycemia?.toFixed(2) || '—'}
                  </span>
                  {entry.velocityTrend && entry.velocityTrend !== 'unknown' && (
                    <VelocityIndicator trend={entry.velocityTrend} velocity={entry.velocity} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Active alerts */}
      {patterns.length > 0 && (
        <div>
          <div style={{
            fontSize: 12, letterSpacing: 2, color: cc.accent,
            textTransform: "uppercase", marginBottom: 8,
          }}>
            🔔 {t?.('alertesActives') || 'Alertes actives'}
          </div>
          <PatternAlerts patterns={patterns} />
        </div>
      )}
    </div>
  );
}
