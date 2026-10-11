/**
 * AgpChart — profil glycémique ambulatoire (AGP) en SVG inline.
 *
 * Axe x : 0–24 h (repères toutes les 6 h). Axe y : 0,4–3,0 g/L avec lignes de
 * grille à 0,70 / 1,00 / 1,80 / 2,50. Bande cible ombrée, bande p10–p90 (claire),
 * bande p25–p75 (moyenne), médiane p50 (trait épais). Les tranches sans lecture
 * (n = 0 ou percentile null) ne sont pas tracées : les courbes s'interrompent.
 *
 * Accessibilité : role="img" + aria-label, légende textuelle, lecture au survol
 * dans une zone aria-live. Le SVG est forcé en LTR (axe du temps), le reste
 * suit la direction du document (RTL compatible).
 */
import { useState } from 'react';
import { agpSummary } from '../../domain/analytics/agp';
import { localeTag } from '../../domain/time';

const W = 360;
const H = 220;
const PAD = { top: 12, right: 10, bottom: 26, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const Y_MIN = 0.4;
const Y_MAX = 3.0;
const GRID_LINES = [0.7, 1.0, 1.8, 2.5];
const HOUR_TICKS = [0, 6, 12, 18, 24];

const xOf = (hour) => PAD.left + (hour / 24) * PLOT_W;
const yOf = (v) => {
  const c = Math.min(Y_MAX, Math.max(Y_MIN, v));
  return PAD.top + (1 - (c - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;
};
const r1 = (n) => Math.round(n * 10) / 10;

function fmtNum(v, digits, locale) {
  if (v == null || !Number.isFinite(v)) return '—';
  try {
    return new Intl.NumberFormat(localeTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  } catch {
    return v.toFixed(digits);
  }
}

/** Libellé traduit, ou repli français si la clé n'existe pas encore dans i18n. */
function tf(t, key, fallback) {
  const v = t(key);
  return v && v !== key ? v : fallback;
}

function hourLabel(hour) {
  const hh = Math.floor(hour);
  const mm = Math.round((hour - hh) * 60);
  return mm ? `${hh}:${String(mm).padStart(2, '0')}` : `${hh} h`;
}

const isDrawable = (b) =>
  Boolean(b) && b.n > 0 && b.p50 != null && b.p10 != null && b.p90 != null && b.p25 != null && b.p75 != null;

/** Suites de tranches consécutives renseignées ; un trou (n = 0) coupe les courbes. */
function runsOf(buckets, bucketMinutes) {
  const half = bucketMinutes / 120;
  const runs = [];
  let current = [];
  for (const b of buckets) {
    if (isDrawable(b)) {
      current.push({ ...b, x: xOf(b.hour + half) });
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

function bandPath(run, lowKey, highKey) {
  const top = run.map((p, i) => `${i === 0 ? 'M' : 'L'}${r1(p.x)},${r1(yOf(p[highKey]))}`).join(' ');
  const bottom = [...run].reverse().map((p) => `L${r1(p.x)},${r1(yOf(p[lowKey]))}`).join(' ');
  return `${top} ${bottom} Z`;
}

function linePath(run, key) {
  return run.map((p, i) => `${i === 0 ? 'M' : 'L'}${r1(p.x)},${r1(yOf(p[key]))}`).join(' ');
}

export default function AgpChart({ profile, targetMin = 0.7, targetMax = 1.8, isDark = false, t, locale = 'fr' }) {
  const [focus, setFocus] = useState(null);

  const buckets = profile?.buckets ?? [];
  const bucketMinutes = profile?.bucketMinutes ?? 60;
  const runs = runsOf(buckets, bucketMinutes);
  const summary = profile ? agpSummary(profile) : { medianMean: null, iqrMean: null, widestHour: null };

  const c = isDark
    ? { median: '#5EEAD4', band: '#2DD4BF', target: '#4ADE80', grid: '#334155', axis: '#475569', text: '#94A3B8', focus: '#F8FAFC' }
    : { median: '#0F766E', band: '#14B8A6', target: '#22C55E', grid: '#E2E8F0', axis: '#CBD5E1', text: '#64748B', focus: '#0F172A' };
  const secondary = isDark ? 'text-slate-400' : 'text-slate-500';

  const labelMedian = tf(t, 'agpMediane', 'Médiane');
  const labelIqr = tf(t, 'agpBande2575', '25 à 75 %');
  const labelDeciles = tf(t, 'agpBande1090', '10 à 90 %');
  const labelTarget = tf(t, 'agpZoneCible', 'Zone cible');
  const gl = (v) => fmtNum(v, 2, locale);

  const ariaLabel = `${t('agpTitre')}. ${t('agpDesc')} ${labelMedian} ${gl(summary.medianMean)} g/L.`;

  const onPointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const hour = ((px - PAD.left) / PLOT_W) * 24;
    if (hour < 0 || hour >= 24) {
      setFocus(null);
      return;
    }
    const idx = Math.floor((hour * 60) / bucketMinutes);
    setFocus(isDrawable(buckets[idx]) ? idx : null);
  };

  const focused = focus != null ? buckets[focus] : null;
  const readout = focused
    ? `${hourLabel(focused.hour)} : ${labelMedian} ${gl(focused.p50)} g/L · ${labelIqr} ${gl(focused.p25)} – ${gl(focused.p75)} g/L · n = ${focused.n}`
    : `${labelMedian} ${gl(summary.medianMean)} g/L · ${labelIqr} ± ${gl(summary.iqrMean)} g/L`;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="block h-auto w-full"
        style={{ direction: 'ltr', touchAction: 'pan-y' }}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setFocus(null)}
      >
        <title>{t('agpTitre')}</title>
        <desc>{t('agpDesc')}</desc>

        {/* Bande cible */}
        <rect
          x={PAD.left}
          y={yOf(targetMax)}
          width={PLOT_W}
          height={Math.max(0, yOf(targetMin) - yOf(targetMax))}
          fill={c.target}
          fillOpacity={isDark ? 0.14 : 0.12}
        />

        {/* Grille horizontale + étiquettes y */}
        {GRID_LINES.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)} stroke={c.grid} strokeWidth={1} strokeDasharray={v === 1.0 ? '3 3' : undefined} />
            <text x={PAD.left - 5} y={yOf(v) + 3.5} textAnchor="end" fontSize={11} fill={c.text}>
              {gl(v)}
            </text>
          </g>
        ))}

        {/* Axe x + repères horaires */}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H} stroke={c.axis} strokeWidth={1} />
        {HOUR_TICKS.map((h) => (
          <g key={h}>
            <line x1={xOf(h)} x2={xOf(h)} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H + 4} stroke={c.axis} strokeWidth={1} />
            <text
              x={xOf(h)}
              y={H - 8}
              textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}
              fontSize={11}
              fill={c.text}
            >
              {`${h} h`}
            </text>
          </g>
        ))}

        {/* Bandes de percentiles et médiane, par suite continue */}
        {runs.map((run, i) => (
          <g key={i}>
            {run.length > 1 && <path d={bandPath(run, 'p10', 'p90')} fill={c.band} fillOpacity={isDark ? 0.22 : 0.18} stroke="none" />}
            {run.length > 1 && <path d={bandPath(run, 'p25', 'p75')} fill={c.band} fillOpacity={0.4} stroke="none" />}
            {run.length > 1 ? (
              <path d={linePath(run, 'p50')} fill="none" stroke={c.median} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            ) : (
              <circle cx={r1(run[0].x)} cy={r1(yOf(run[0].p50))} r={3.5} fill={c.median} />
            )}
          </g>
        ))}

        {/* Repère de survol */}
        {focused && (
          <g pointerEvents="none">
            <line
              x1={xOf(focused.hour + bucketMinutes / 120)}
              x2={xOf(focused.hour + bucketMinutes / 120)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke={c.focus}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <circle cx={xOf(focused.hour + bucketMinutes / 120)} cy={yOf(focused.p50)} r={4} fill={c.median} stroke={isDark ? '#0F172A' : '#FFFFFF'} strokeWidth={2} />
          </g>
        )}
      </svg>

      <p aria-live="polite" className={`mt-1 min-h-4 text-xs tabular-nums ${secondary}`}>{readout}</p>

      <figcaption className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs ${secondary}`}>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: c.median, height: 3 }} />
          {labelMedian}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: c.band, opacity: 0.5 }} />
          {labelIqr}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: c.band, opacity: 0.22 }} />
          {labelDeciles}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: c.target, opacity: 0.3 }} />
          {`${labelTarget} ${gl(targetMin)} – ${gl(targetMax)} g/L`}
        </span>
      </figcaption>
    </figure>
  );
}
