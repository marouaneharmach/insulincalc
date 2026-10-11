/**
 * ReportsScreen — écran « Rapports » (v7).
 *
 * Indicateurs du consensus international (TIR / TBR / TAR / CV / GMI), profil
 * glycémique ambulatoire (AGP), schémas récurrents, pistes d'ajustement du
 * traitement, export CSV du journal et rapport imprimable pour le médecin.
 *
 * Tous les calculs proviennent des modules purs de `src/domain` ; ce composant ne
 * contient aucune règle clinique, uniquement de la présentation.
 */
import { useMemo, useState } from 'react';
import { entryDate, entryKind, getGlucosePost, getGlucosePre, readingsFromJournal } from '../domain/journal';
import { CONSENSUS, computeGlycemicMetrics } from '../domain/analytics/metrics';
import { computeAGP, smoothProfile } from '../domain/analytics/agp';
import { detectPatterns } from '../domain/analytics/patterns';
import { TREATMENT_RULES, analyzeTreatment } from '../domain/analytics/treatmentAnalyzer';
import { formatDate, localDateKey, localeTag, timeKey } from '../domain/time';
import { toNumber } from '../domain/units';
import AgpChart from './reports/AgpChart';
import MedicalReportPrint from './reports/MedicalReportPrint';
import TirBar from './reports/TirBar';

const PERIODS = [
  { days: 14, key: 'periode14' },
  { days: 30, key: 'periode30' },
  { days: 90, key: 'periode90' },
];
const DEFAULT_DAYS = 14;
const DAY_MS = 86_400_000;
const CSV_COLUMNS = ['date', 'heure', 'type', 'glycPre', 'glycPost', 'totalGlucides', 'doseSuggeree', 'doseReelle', 'bolusType', 'notes'];

// ─── Formatage ──────────────────────────────────────────────────────────────

/** Libellé traduit, ou repli français si la clé n'existe pas encore dans i18n. */
function tf(t, key, fallback) {
  const v = t(key);
  return v && v !== key ? v : fallback;
}

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

// ─── Export CSV ─────────────────────────────────────────────────────────────

function csvEscape(value) {
  const s = String(value ?? '');
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Dose réellement saisie (sans le repli sur la dose suggérée). */
const explicitActualDose = (e) => toNumber(e.doseReelle ?? e.doseActual ?? e.doseInjected);

/** CSV du journal sur [from, now] : BOM UTF-8, séparateur « ; », virgule décimale en français. */
function buildCsv(entries, { from, now, locale }) {
  const dec = locale === 'fr' ? ',' : '.';
  const num = (v) => {
    const n = toNumber(v);
    return n == null ? '' : String(n).replace('.', dec);
  };
  const horizon = now.getTime() + 60_000;
  const rows = entries
    .filter((e) => e && e.date)
    .map((e) => ({ e, d: entryDate(e) }))
    .filter(({ d }) => {
      const ts = d.getTime();
      return Number.isFinite(ts) && ts >= from.getTime() && ts <= horizon;
    })
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .map(({ e, d }) =>
      [
        localDateKey(d),
        timeKey(d),
        entryKind(e),
        num(getGlucosePre(e)),
        num(getGlucosePost(e)),
        num(e.totalGlucides ?? e.totalCarbs),
        num(e.doseSuggeree ?? e.doseSuggested ?? e.doseCalculated),
        num(explicitActualDose(e)),
        e.bolusType ?? '',
        e.notes ?? '',
      ]
        .map(csvEscape)
        .join(';'),
    );
  return `\uFEFF${[CSV_COLUMNS.join(';'), ...rows].join('\r\n')}`;
}

function downloadTextFile(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ─── Composant ──────────────────────────────────────────────────────────────

export default function ReportsScreen({
  journal,
  targetGMin,
  targetGMax,
  ratio,
  isf,
  patientName,
  t,
  isDark = false,
  locale = 'fr',
  insulinRapid,
  basalDose,
}) {
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [printOpen, setPrintOpen] = useState(false);

  const targetMin = toNumber(targetGMin) ?? CONSENSUS.tirMin;
  const targetMax = toNumber(targetGMax) ?? CONSENSUS.tirMax;
  const ratioN = toNumber(ratio) ?? 0;
  const isfN = toNumber(isf) ?? 0;

  // Un seul mémo pour toute l'analyse : `now` est figé avec le journal et la période.
  const analysis = useMemo(() => {
    const entries = Array.isArray(journal) ? journal : [];
    const now = new Date();
    const readings = readingsFromJournal(entries, { days, now });
    const metrics = computeGlycemicMetrics(readings);
    const profile = smoothProfile(computeAGP(readings, { days, now }));
    const patterns = detectPatterns(entries, { days, targetMin, targetMax, now });
    const treatment = analyzeTreatment(entries, { ratio: ratioN, isfMgdl: isfN, targetMin, targetMax, days, now });
    return { now, from: new Date(now.getTime() - days * DAY_MS), readings, metrics, profile, patterns, treatment };
  }, [journal, days, targetMin, targetMax, ratioN, isfN]);

  const { now, from, metrics, profile, patterns, treatment } = analysis;

  // ── Styles partagés ──
  const card = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const heading = `text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const secondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const primary = isDark ? 'text-slate-100' : 'text-slate-800';
  const tile = `rounded-xl border p-2.5 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-gray-100'}`;
  const okText = isDark ? 'text-green-400' : 'text-green-700';
  const koText = isDark ? 'text-red-400' : 'text-red-700';
  const buttonCls = `w-full py-3 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 border transition ${
    isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-gray-200 text-slate-700 hover:bg-gray-50'
  }`;

  // ── Libellés ──
  const objectifAtteint = tf(t, 'objectifAtteint', 'Objectif atteint');
  const objectifNonAtteint = tf(t, 'objectifNonAtteint', 'Objectif non atteint');
  const severityLabel = (severity) =>
    severity === 'warning' ? tf(t, 'severiteAvertissement', 'Avertissement') : tf(t, 'severiteInfo', 'Information');
  const periodLabel = t(PERIODS.find((p) => p.days === days)?.key ?? 'periode14');
  const gl = (v) => fmtNum(v, 2, locale);

  const goals = CONSENSUS.goals;
  const met = metrics.goalsMet;
  const goalTiles = [
    { key: 'tir', label: t('tempsEnCibleLabel'), value: metrics.tirPct, goal: `≥ ${goals.tir} %`, ok: met?.tir },
    { key: 'tbr', label: t('tempsSousCible'), value: metrics.tbrPct, goal: `< ${goals.tbr} %`, ok: met?.tbr },
    { key: 'tbr2', label: t('tempsSousCible2'), value: metrics.tbr2Pct, goal: `< ${goals.tbr2} %`, ok: met?.tbr2 },
    { key: 'tar', label: t('tempsAuDessus'), value: metrics.tarPct, goal: `< ${goals.tar} %`, ok: met?.tar },
    { key: 'tar2', label: t('tempsAuDessus2'), value: metrics.tar2Pct, goal: `< ${goals.tar2} %`, ok: met?.tar2 },
    { key: 'cv', label: t('coefVariation'), value: metrics.cvPct, goal: `≤ ${goals.cv} %`, ok: met?.cv },
  ];

  const patternLines = patterns.map((p, i) => ({
    key: `${p.code}-${i}`,
    severity: p.severity,
    icon: p.severity === 'warning' ? '⚠️' : 'ℹ️',
    severityLabel: severityLabel(p.severity),
    text: t(p.code, { ...p.params, ...(p.params?.period ? { period: t(String(p.params.period)) } : {}), ...(p.params?.mealType ? { mealType: t(String(p.params.mealType)) } : {}) }),
  }));

  const suggestionParams = (s) => ({
    ...s.params,
    ...(s.period ? { period: t(s.period) === s.period ? s.period : t(s.period) } : {}),
    // Alias vers les noms de paramètres utilisés par les libellés i18n.
    ...(s.params?.effectiveMgdl != null ? { effective: s.params.effectiveMgdl } : {}),
    ...(s.params?.cvPct != null ? { cv: s.params.cvPct } : {}),
  });
  const suggestionLines = treatment.suggestions.map((s, i) => ({
    key: `${s.code}-${s.period ?? ''}-${i}`,
    text: t(s.code, suggestionParams(s)),
  }));

  // ── Actions ──
  const exportCsv = () => {
    const csv = buildCsv(Array.isArray(journal) ? journal : [], { from, now, locale });
    downloadTextFile(csv, `insulincalc_journal_${localDateKey(now)}_${days}j.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-3 px-4 pb-6 pt-2">
      {/* ── Titre + période ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`text-lg font-bold ${primary}`}>{t('rapportsTitre')}</h2>
        <div
          role="group"
          aria-label={tf(t, 'periodeLabel', 'Période')}
          className={`inline-flex rounded-xl border p-0.5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}
        >
          {PERIODS.map((p) => {
            const active = p.days === days;
            return (
              <button
                key={p.days}
                type="button"
                aria-pressed={active}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  active ? 'bg-teal-600 text-white shadow-sm' : `${secondary} hover:bg-teal-500/10`
                }`}
              >
                {t(p.key)}
              </button>
            );
          })}
        </div>
      </div>
      <p className={`text-xs tabular-nums ${secondary}`}>
        {formatDate(from, locale)} – {formatDate(now, locale)}
      </p>

      {/* ── Indicateurs ── */}
      <section className={card} aria-labelledby="reports-metrics-title">
        <h3 id="reports-metrics-title" className={heading}>{t('metriquesTitre')}</h3>
        <p className={`mt-1 text-xs tabular-nums ${secondary}`}>{t('lecturesEtJours', { n: metrics.n, days: metrics.daysWithData })}</p>
        <div className="mt-3">
          <TirBar metrics={metrics} t={t} isDark={isDark} locale={locale} />
        </div>

        {metrics.n > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {goalTiles.map((g) => (
              <div key={g.key} className={tile}>
                <p className={`text-xs ${secondary}`}>{g.label}</p>
                <p className={`text-xl font-bold tabular-nums ${primary}`}>{fmtPct(g.value, locale)}</p>
                <p className={`text-xs tabular-nums ${secondary}`}>{t('objectif')} {g.goal}</p>
                <p className={`text-xs font-medium ${g.ok == null ? secondary : g.ok ? okText : koText}`}>
                  {g.ok == null ? '—' : g.ok ? `✓ ${objectifAtteint}` : `✗ ${objectifNonAtteint}`}
                </p>
              </div>
            ))}

            <div className={tile}>
              <p className={`text-xs ${secondary}`}>{t('moyenne')}</p>
              <p className={`text-xl font-bold tabular-nums ${primary}`}>{gl(metrics.meanGl)} <span className="text-xs font-medium">g/L</span></p>
              <p className={`text-xs tabular-nums ${secondary}`}>± {gl(metrics.sdGl)} · min {gl(metrics.minGl)} · max {gl(metrics.maxGl)}</p>
            </div>

            <div className={tile}>
              <p className={`text-xs ${secondary}`}>{t('gmi')}</p>
              <p className={`text-xl font-bold tabular-nums ${primary}`}>{metrics.gmiPct != null ? fmtPct(metrics.gmiPct, locale) : '—'}</p>
              {metrics.gmiPct == null ? (
                <p className={`text-xs ${secondary}`}>{t('gmiPasAssez')}</p>
              ) : !metrics.gmiReliable ? (
                <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{t('gmiNonFiable')}</p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {/* ── AGP ── */}
      <section className={card} aria-labelledby="reports-agp-title">
        <h3 id="reports-agp-title" className={heading}>{t('agpTitre')}</h3>
        <p className={`mt-1 text-xs ${secondary}`}>{t('agpDesc')}</p>
        {profile.daysWithData < 3 ? (
          <p className={`mt-3 text-sm ${secondary}`}>{t('agpPasAssez')}</p>
        ) : (
          <div className="mt-2">
            <AgpChart profile={profile} targetMin={0.7} targetMax={1.8} isDark={isDark} t={t} locale={locale} />
          </div>
        )}
        <p className={`mt-2 text-xs tabular-nums ${secondary}`}>{t('agpCouverture', { pct: Math.round(profile.coverage * 100) })}</p>
      </section>

      {/* ── Schémas détectés ── */}
      <section className={card} aria-labelledby="reports-patterns-title">
        <h3 id="reports-patterns-title" className={heading}>{t('patternsTitre')}</h3>
        {patternLines.length === 0 ? (
          <p className={`mt-2 text-sm ${secondary}`}>{t('patternsAucun')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {patternLines.map((p) => (
              <li
                key={p.key}
                className={`flex items-start gap-2 rounded-lg border p-2.5 ${
                  p.severity === 'warning'
                    ? isDark ? 'bg-amber-500/10 border-amber-500/25' : 'bg-amber-50 border-amber-200'
                    : isDark ? 'bg-sky-500/10 border-sky-500/25' : 'bg-sky-50 border-sky-200'
                }`}
              >
                <span aria-hidden="true" className="text-sm leading-none mt-0.5 shrink-0">{p.icon}</span>
                <p className={`text-xs leading-snug ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  <span className="font-semibold">{p.severityLabel} : </span>
                  {p.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Pistes d'ajustement ── */}
      <section className={card} aria-labelledby="reports-suggestions-title">
        <h3 id="reports-suggestions-title" className={heading}>{t('suggestionsTitre')}</h3>
        {!treatment.enoughData ? (
          <p className={`mt-2 text-sm ${secondary}`}>
            {t('suggestionsPasAssez', { days: treatment.daysOfData, min: TREATMENT_RULES.defaultMinDays })}
          </p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className={tile}>
                <p className={`text-xs ${secondary}`}>{t('tddMoyenne')}</p>
                <p className={`text-xl font-bold tabular-nums ${primary}`}>{fmtNum(treatment.tdd.meanU, 1, locale)} <span className="text-xs font-medium">U</span></p>
                {treatment.tdd.cvPct != null && (
                  <p className={`text-xs tabular-nums ${secondary}`}>CV {fmtPct(treatment.tdd.cvPct, locale)}</p>
                )}
              </div>
              <div className={tile}>
                <p className={`text-xs ${secondary}`}>{t('basaleEstimee')}</p>
                <p className={`text-xl font-bold tabular-nums ${primary}`}>{fmtNum(treatment.tdd.basalEstimateU, 1, locale)} <span className="text-xs font-medium">U</span></p>
              </div>
            </div>
            {suggestionLines.length === 0 ? (
              <p className={`mt-2 text-sm ${secondary}`}>{tf(t, 'suggestionsAucune', 'Aucun ajustement à signaler sur la période.')}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {suggestionLines.map((s) => (
                  <li key={s.key} className={`flex items-start gap-2 rounded-lg border p-2.5 ${isDark ? 'bg-teal-500/10 border-teal-500/25' : 'bg-teal-50 border-teal-200'}`}>
                    <span aria-hidden="true" className="text-sm leading-none mt-0.5 shrink-0">💡</span>
                    <p className={`text-xs leading-snug ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p className={`mt-2 text-xs ${secondary}`}>{t('suggestionsDisclaimer')}</p>
      </section>

      {/* ── Export ── */}
      <div className="space-y-2">
        <button type="button" onClick={() => setPrintOpen(true)} className={buttonCls}>
          <span aria-hidden="true">🖨</span> {t('exporterRapport')}
        </button>
        <button type="button" onClick={exportCsv} className={buttonCls}>
          <span aria-hidden="true">📄</span> {t('exporterCsv')}
        </button>
      </div>

      <MedicalReportPrint
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        t={t}
        locale={locale}
        patientName={patientName}
        periodLabel={periodLabel}
        from={from}
        to={now}
        generatedAt={now}
        ratio={ratioN}
        isf={isfN}
        targetGMin={targetMin}
        targetGMax={targetMax}
        insulinRapid={insulinRapid}
        basalDose={basalDose}
        metrics={metrics}
        profile={profile}
        patternLines={patternLines}
        suggestionLines={suggestionLines}
        treatment={treatment}
      />
    </div>
  );
}
