/**
 * TirBar — barre empilée « temps en cible » du consensus international (Battelino 2019).
 * Cinq segments : < 0,54 · 0,54–0,70 · 0,70–1,80 · 1,80–2,50 · > 2,50 g/L.
 *
 * La couleur n'est jamais le seul support de l'information : chaque segment affiche
 * son pourcentage (dès qu'il est assez large), une légende textuelle suit la barre
 * et un aria-label décrit l'ensemble pour les lecteurs d'écran.
 */
import { CONSENSUS } from '../../domain/analytics/metrics';
import { localeTag } from '../../domain/time';

const COLORS = { tbr2: '#7F1D1D', tbr1: '#DC2626', tir: '#16A34A', tar1: '#EAB308', tar2: '#EA580C' };
const INK = { tbr2: '#FFFFFF', tbr1: '#FFFFFF', tir: '#FFFFFF', tar1: '#1E293B', tar2: '#FFFFFF' };
/** Largeur minimale (en %) pour écrire le pourcentage dans le segment lui-même. */
const MIN_LABEL_PCT = 8;

function fmtNum(v, digits, locale) {
  if (v == null || !Number.isFinite(v)) return '—';
  try {
    return new Intl.NumberFormat(localeTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  } catch {
    return v.toFixed(digits);
  }
}

function fmtPct(v, locale) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${fmtNum(v, Number.isInteger(v) ? 0 : 1, locale)} %`;
}

const clampPct = (v) => Math.max(0, Math.round((Number(v) || 0) * 10) / 10);

export default function TirBar({ metrics, t, isDark = false, locale = 'fr' }) {
  const secondary = isDark ? 'text-slate-400' : 'text-slate-500';

  if (!metrics || metrics.tirPct == null) {
    return <p className={`text-sm ${secondary}`}>{t('aucuneDonnee')}</p>;
  }

  const gl = (v) => fmtNum(v, 2, locale);
  const segments = [
    { key: 'tbr2', pct: clampPct(metrics.tbr2Pct), label: t('tempsSousCible2') },
    { key: 'tbr1', pct: clampPct(metrics.tbrPct - metrics.tbr2Pct), label: `${gl(CONSENSUS.level2Low)} – ${gl(CONSENSUS.level1Low)} g/L` },
    { key: 'tir', pct: clampPct(metrics.tirPct), label: t('tempsEnCibleLabel') },
    { key: 'tar1', pct: clampPct(metrics.tarPct - metrics.tar2Pct), label: `${gl(CONSENSUS.level1High)} – ${gl(CONSENSUS.level2High)} g/L` },
    { key: 'tar2', pct: clampPct(metrics.tar2Pct), label: t('tempsAuDessus2') },
  ];

  const ariaLabel = [
    `${t('tempsEnCibleLabel')} ${fmtPct(metrics.tirPct, locale)}`,
    `${t('tempsSousCible')} ${fmtPct(metrics.tbrPct, locale)} (${t('tempsSousCible2')} ${fmtPct(metrics.tbr2Pct, locale)})`,
    `${t('tempsAuDessus')} ${fmtPct(metrics.tarPct, locale)} (${t('tempsAuDessus2')} ${fmtPct(metrics.tar2Pct, locale)})`,
  ].join(' ; ');

  return (
    <div>
      <div
        role="img"
        aria-label={ariaLabel}
        className={`flex h-8 w-full overflow-hidden rounded-lg ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}
        style={{ gap: 2 }}
      >
        {segments.filter((s) => s.pct > 0).map((s) => (
          <div
            key={s.key}
            className="flex min-w-0 items-center justify-center text-xs font-semibold tabular-nums"
            style={{ width: `${s.pct}%`, backgroundColor: COLORS[s.key], color: INK[s.key] }}
          >
            {s.pct >= MIN_LABEL_PCT ? fmtPct(Math.round(s.pct), locale) : null}
          </div>
        ))}
      </div>

      <ul className="mt-2 grid grid-cols-1 gap-y-1 text-xs sm:grid-cols-2 sm:gap-x-3">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[s.key] }} />
            <span className={`min-w-0 flex-1 truncate ${secondary}`}>{s.label}</span>
            <span className={`font-semibold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmtPct(s.pct, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
