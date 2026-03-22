import { useState, useMemo } from 'react';
import { C, SPACE, FONT, glycColor, glycLabel } from '../utils/colors.js';
import { estimateHbA1c, detectPatterns } from '../utils/calculations.js';
import { getEntries, getStats, addEntry, updateEntry, deleteEntry } from '../data/journalStore.js';
import TimeInRange from './TimeInRange.jsx';
import JournalEntryForm from './JournalEntryForm.jsx';

// ─── MEAL TYPE DISPLAY ───────────────────────────────────────────────────────
const MEAL_ICONS = {
  "petit-déjeuner": "🌅",
  "déjeuner": "☀️",
  "dîner": "🌙",
  "collation": "🍎",
};

const MEAL_LABELS = {
  "petit-déjeuner": "Petit-déj",
  "déjeuner": "Déjeuner",
  "dîner": "Dîner",
  "collation": "Collation",
};

// ─── SPARKLINE SVG ───────────────────────────────────────────────────────────
function GlycemiaSparkline({ entries, width = 320, height = 80 }) {
  const points = useMemo(() => {
    const pts = [];
    entries.forEach(e => {
      const t = new Date(e.date).getTime();
      if (e.preMealGlycemia != null && !isNaN(e.preMealGlycemia)) {
        pts.push({ t, v: e.preMealGlycemia, type: "pre" });
      }
      if (e.postMealGlycemia != null && !isNaN(e.postMealGlycemia)) {
        pts.push({ t: t + (e.postMealTime || 120) * 60000, v: e.postMealGlycemia, type: "post" });
      }
    });
    return pts.sort((a, b) => a.t - b.t);
  }, [entries]);

  if (points.length < 2) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0", fontSize: 12, color: C.muted }}>
        Pas assez de données pour le graphique (min. 2 mesures)
      </div>
    );
  }

  const pad = { top: 10, bottom: 10, left: 4, right: 4 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const rangeT = maxT - minT || 1;
  const minV = 0.4;
  const maxV = Math.max(3.0, ...points.map(p => p.v));

  const x = (t) => pad.left + ((t - minT) / rangeT) * w;
  const y = (v) => pad.top + h - ((v - minV) / (maxV - minV)) * h;

  const yTarget1 = y(1.8);
  const yTarget2 = y(1.0);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <rect x={pad.left} y={yTarget1} width={w} height={yTarget2 - yTarget1}
        fill="rgba(34,197,94,0.1)" rx={3} />
      <line x1={pad.left} x2={width - pad.right} y1={y(1.0)} y2={y(1.0)}
        stroke="rgba(34,197,94,0.2)" strokeDasharray="3,3" />
      <line x1={pad.left} x2={width - pad.right} y1={y(1.8)} y2={y(1.8)}
        stroke="rgba(34,197,94,0.2)" strokeDasharray="3,3" />
      <path d={linePath} fill="none" stroke="rgba(14,165,233,0.3)" strokeWidth={1.5} />
      {points.map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={y(p.v)} r={3.5}
          fill={glycColor(p.v)} stroke={C.bg} strokeWidth={1.5} />
      ))}
      <text x={pad.left + 2} y={y(1.0) + 11} fill="rgba(34,197,94,0.4)" fontSize={9} fontFamily="monospace">1.0</text>
      <text x={pad.left + 2} y={yTarget1 - 3} fill="rgba(34,197,94,0.4)" fontSize={9} fontFamily="monospace">1.8</text>
    </svg>
  );
}

// ─── JOURNAL ENTRY ROW ───────────────────────────────────────────────────────
function JournalEntryRow({ entry, onEdit, onDelete, onAddPostMeal }) {
  const date = new Date(entry.date);
  const dateStr = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const foodSummary = entry.foods?.slice(0, 3).map(f => f.name).join(", ") || "—";
  const hasMore = entry.foods?.length > 3;

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "12px 14px", marginBottom: 8, transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{MEAL_ICONS[entry.mealType] || "🍽"}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9ab8cc" }}>
              {MEAL_LABELS[entry.mealType] || entry.mealType}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>{dateStr} · {timeStr}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: glycColor(entry.preMealGlycemia) }}>
              {entry.preMealGlycemia?.toFixed(2) || "—"}
            </span>
            {entry.postMealGlycemia != null && (
              <>
                <span style={{ color: C.muted, fontSize: 12 }}>→</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: glycColor(entry.postMealGlycemia) }}>
                  {entry.postMealGlycemia.toFixed(2)}
                </span>
              </>
            )}
            <span style={{ fontSize: 10, color: C.muted }}>g/L</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <div style={{
          padding: "3px 8px", borderRadius: 6, fontSize: 11,
          background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)", color: C.accent,
        }}>
          💉 {entry.doseInjected || entry.doseCalculated}U
          {entry.doseInjected && entry.doseCalculated && entry.doseInjected !== entry.doseCalculated && (
            <span style={{ color: C.muted, marginLeft: 4 }}>(calc: {entry.doseCalculated}U)</span>
          )}
        </div>
        {entry.totalCarbs > 0 && (
          <div style={{
            padding: "3px 8px", borderRadius: 6, fontSize: 11,
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#fcd34d",
          }}>
            {entry.totalCarbs}g glucides
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: entry.notes ? 4 : 0 }}>
        {foodSummary}{hasMore ? ` +${entry.foods.length - 3}` : ""}
      </div>

      {entry.notes && (
        <div style={{ fontSize: 11, color: "#4a8fa8", fontStyle: "italic", marginBottom: 2 }}>
          📋 {entry.notes}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
        {entry.postMealGlycemia == null && (
          <button onClick={() => onAddPostMeal(entry)} style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 10,
            border: `1px dashed rgba(34,197,94,0.4)`, background: "transparent",
            color: "#22c55e", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace",
          }}>
            + Post-repas
          </button>
        )}
        <button onClick={() => onEdit(entry)} style={{
          padding: "4px 10px", borderRadius: 6, fontSize: 10,
          border: `1px solid ${C.border}`, background: "transparent",
          color: C.muted, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace",
        }}>
          ✏️
        </button>
        <button onClick={() => { if (confirm("Supprimer cette entrée ?")) onDelete(entry.id); }} style={{
          padding: "4px 10px", borderRadius: 6, fontSize: 10,
          border: "1px solid rgba(239,68,68,0.3)", background: "transparent",
          color: "#ef4444", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace",
        }}>
          🗑
        </button>
      </div>
    </div>
  );
}

// ─── MAIN JOURNAL TAB ────────────────────────────────────────────────────────
export default function JournalTab({ selections, totalCarbs, doseCalculated, glycemia }) {
  const [period, setPeriod] = useState(14);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  const stats = useMemo(() => getStats(period), [period, refreshKey]);
  const entries = stats.entries || [];
  const hba1c = useMemo(() => estimateHbA1c(entries), [entries]);
  const patterns = useMemo(() => detectPatterns(entries), [entries]);

  const handleSave = (entry) => {
    if (entry.id) {
      updateEntry(entry.id, entry);
    } else {
      addEntry(entry);
    }
    setShowForm(false);
    setEditEntry(null);
    refresh();
  };

  const handleDelete = (id) => {
    deleteEntry(id);
    refresh();
  };

  const handleEdit = (entry) => {
    setEditEntry(entry);
    setShowForm(true);
  };

  const handleAddPostMeal = (entry) => {
    setEditEntry(entry);
    setShowForm(true);
  };

  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: SPACE.xl, marginBottom: SPACE.md };

  return (
    <div>
      {/* Period selector pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setPeriod(d)} style={{
            flex: 1, padding: "9px 8px",
            border: `1px solid ${period === d ? C.accent : C.border}`,
            borderRadius: 8, cursor: "pointer",
            background: period === d ? "rgba(14,165,233,0.12)" : "#070c12",
            color: period === d ? "#7dd3fc" : C.muted,
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, fontWeight: period === d ? 700 : 400,
            transition: "all 0.15s",
          }}>
            {d} jours
          </button>
        ))}
      </div>

      {/* Stats summary */}
      <div style={{ ...card, borderColor: "rgba(14,165,233,0.25)" }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: C.accent, textTransform: "uppercase", marginBottom: 12 }}>
          📊 Résumé — {period} derniers jours
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div style={{ background: "#070c12", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>Moyenne</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: glycColor(stats.average), fontFamily: "'Syne Mono',monospace" }}>
              {stats.average > 0 ? stats.average.toFixed(2) : "—"}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>g/L</div>
          </div>
          <div style={{ background: "#070c12", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>En cible</div>
            <div style={{
              fontSize: 20, fontWeight: 700, fontFamily: "'Syne Mono',monospace",
              color: stats.targetPercent >= 70 ? "#22c55e" : stats.targetPercent >= 50 ? "#f59e0b" : "#ef4444",
            }}>
              {stats.measureCount > 0 ? `${stats.targetPercent}%` : "—"}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>1.0–1.8</div>
          </div>
          <div style={{ background: "#070c12", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>Mesures</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: "'Syne Mono',monospace" }}>
              {stats.measureCount}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>lectures</div>
          </div>
        </div>

        {/* HbA1c estimée */}
        {hba1c != null && (
          <div style={{
            padding: "8px 12px", borderRadius: 8, marginBottom: 12,
            background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 12, color: "#c4b5fd" }}>🧪 HbA1c estimée</span>
            <span style={{
              fontSize: 18, fontWeight: 700, fontFamily: "'Syne Mono',monospace",
              color: hba1c <= 7.0 ? "#22c55e" : hba1c <= 8.0 ? "#f59e0b" : "#ef4444",
            }}>
              {hba1c}%
            </span>
          </div>
        )}

        {stats.measureCount > 0 && (
          <div style={{ fontSize: 11, color: C.muted, textAlign: "center" }}>
            Écart-type : {stats.stdDev.toFixed(2)} g/L
            {stats.stdDev > 0.5 && <span style={{ color: "#f59e0b" }}> — variabilité élevée</span>}
          </div>
        )}
      </div>

      {/* Sparkline */}
      {entries.length >= 2 && (
        <div style={{ ...card }}>
          <div style={{ fontSize: 12, letterSpacing: 2, color: C.accent, textTransform: "uppercase", marginBottom: 8 }}>
            📈 Évolution glycémique
          </div>
          <GlycemiaSparkline entries={entries} />
        </div>
      )}

      {/* Time in Range */}
      <div style={{ marginBottom: SPACE.md }}>
        <TimeInRange stats={stats} />
      </div>

      {/* Patterns */}
      {patterns.length > 0 && (
        <div style={{ ...card, borderColor: "rgba(245,158,11,0.3)" }}>
          <div style={{ fontSize: 12, letterSpacing: 2, color: "#f59e0b", textTransform: "uppercase", marginBottom: 10 }}>
            🔍 Patterns détectés
          </div>
          {patterns.map((p, i) => (
            <div key={i} style={{
              padding: "8px 12px", borderRadius: 8, marginBottom: i < patterns.length - 1 ? 6 : 0,
              background: p.severity === "warning" ? "rgba(239,68,68,0.08)" : "rgba(14,165,233,0.06)",
              border: `1px solid ${p.severity === "warning" ? "rgba(239,68,68,0.3)" : "rgba(14,165,233,0.2)"}`,
              fontSize: 11, color: p.severity === "warning" ? "#fca5a5" : "#7dd3fc", lineHeight: 1.5,
            }}>
              {p.icon} {p.message}
            </div>
          ))}
        </div>
      )}

      {/* Add entry button */}
      <button onClick={() => { setEditEntry(null); setShowForm(true); }} style={{
        width: "100%", padding: 14, borderRadius: 12, marginBottom: SPACE.md,
        border: "none", background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
        color: "#fff", fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, fontWeight: 700, cursor: "pointer",
        boxShadow: "0 4px 16px rgba(14,165,233,0.3)",
      }}>
        + Nouvelle entrée
      </button>

      {/* Entry list */}
      {entries.length > 0 ? (
        <div>
          <div style={{ fontSize: 12, letterSpacing: 2, color: C.muted, textTransform: "uppercase", marginBottom: 10 }}>
            📋 Historique ({entries.length} entrée{entries.length > 1 ? "s" : ""})
          </div>
          {entries.map(entry => (
            <JournalEntryRow
              key={entry.id}
              entry={entry}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddPostMeal={handleAddPostMeal}
            />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📓</div>
          <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
            Votre journal est vide.<br />
            Calculez un repas puis enregistrez-le ici pour suivre vos glycémies.
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <JournalEntryForm
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditEntry(null); }}
          selections={selections}
          totalCarbs={totalCarbs}
          doseCalculated={doseCalculated}
          glycemia={glycemia}
          editEntry={editEntry}
        />
      )}
    </div>
  );
}
