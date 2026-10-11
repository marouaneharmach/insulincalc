/**
 * MedicalReportPrint — rapport imprimable pour le médecin.
 *
 * Surcouche plein écran blanche (fond forcé, texte noir) pensée pour l'impression :
 * en-tête patient / période, paramètres du traitement, tableau des indicateurs,
 * barre TIR, profil AGP, schémas détectés, pistes d'ajustement et avertissement.
 * Les boutons portent la classe `icr-no-print` et disparaissent à l'impression ;
 * le reste de l'application est masqué par la feuille `@media print`.
 */
import { useEffect, useRef } from 'react';
import { CONSENSUS } from '../../domain/analytics/metrics';
import { formatDate, formatTime, localeTag } from '../../domain/time';
import AgpChart from './AgpChart';
import TirBar from './TirBar';

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#fff',
    color: '#000',
    zIndex: 9999,
    overflowY: 'auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  page: { maxWidth: 800, margin: '0 auto', padding: '32px 20px', backgroundColor: '#fff' },
  header: { borderBottom: '2px solid #000', paddingBottom: 14, marginBottom: 24 },
  h1: { margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#000' },
  h2: { margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#000', borderBottom: '1px solid #ddd', paddingBottom: 4 },
  section: { marginBottom: 24 },
  meta: { margin: '2px 0', fontSize: 13, color: '#333' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'start', padding: '6px 8px', borderBottom: '2px solid #000', fontWeight: 700, color: '#000' },
  td: { padding: '6px 8px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', color: '#000' },
  tdNum: { padding: '6px 8px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', color: '#000', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  note: { fontSize: 12, color: '#555', margin: '2px 0 0' },
  list: { margin: 0, paddingInlineStart: 20, fontSize: 13, lineHeight: 1.5, color: '#000' },
  muted: { fontSize: 13, color: '#555', margin: 0 },
  disclaimer: { marginTop: 32, paddingTop: 14, borderTop: '1px solid #ddd', fontSize: 12, color: '#555', lineHeight: 1.6 },
  actions: { marginTop: 28, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  btnPrimary: { padding: '10px 20px', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 8, backgroundColor: '#0F766E', color: '#fff', cursor: 'pointer' },
  btnSecondary: { padding: '10px 20px', fontSize: 14, fontWeight: 600, border: '1px solid #ccc', borderRadius: 8, backgroundColor: '#fff', color: '#000', cursor: 'pointer' },
};

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  .icr-print-root, .icr-print-root * { visibility: visible; }
  .icr-print-root { position: absolute !important; top: 0; left: 0; right: 0; width: 100%; height: auto !important; overflow: visible !important; }
  .icr-no-print { display: none !important; }
  .icr-avoid-break { page-break-inside: avoid; break-inside: avoid; }
  h2 { page-break-after: avoid; break-after: avoid; }
}
`;

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

/** Libellé traduit, ou repli français si la clé n'existe pas encore dans i18n. */
function tf(t, key, fallback) {
  const v = t(key);
  return v && v !== key ? v : fallback;
}

export default function MedicalReportPrint({
  open,
  onClose,
  t,
  locale = 'fr',
  patientName,
  periodLabel,
  from,
  to,
  generatedAt,
  ratio,
  isf,
  targetGMin,
  targetGMax,
  insulinRapid,
  basalDose,
  metrics,
  profile,
  patternLines = [],
  suggestionLines = [],
  treatment,
}) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const gl = (v) => fmtNum(v, 2, locale);
  const goals = CONSENSUS.goals;
  const met = metrics?.goalsMet;
  const objectifAtteint = tf(t, 'objectifAtteint', 'Objectif atteint');
  const objectifNonAtteint = tf(t, 'objectifNonAtteint', 'Objectif non atteint');
  const statusText = (ok) => (ok == null ? '' : ok ? `✓ ${objectifAtteint}` : `✗ ${objectifNonAtteint}`);
  const generated = generatedAt ?? new Date();

  const rows = metrics
    ? [
        { label: t('tempsEnCibleLabel'), value: fmtPct(metrics.tirPct, locale), goal: `≥ ${goals.tir} %`, ok: met?.tir },
        { label: t('tempsSousCible'), value: fmtPct(metrics.tbrPct, locale), goal: `< ${goals.tbr} %`, ok: met?.tbr },
        { label: t('tempsSousCible2'), value: fmtPct(metrics.tbr2Pct, locale), goal: `< ${goals.tbr2} %`, ok: met?.tbr2 },
        { label: t('tempsAuDessus'), value: fmtPct(metrics.tarPct, locale), goal: `< ${goals.tar} %`, ok: met?.tar },
        { label: t('tempsAuDessus2'), value: fmtPct(metrics.tar2Pct, locale), goal: `< ${goals.tar2} %`, ok: met?.tar2 },
        { label: t('coefVariation'), value: fmtPct(metrics.cvPct, locale), goal: `≤ ${goals.cv} %`, ok: met?.cv },
        {
          label: t('gmi'),
          value: metrics.gmiPct != null ? fmtPct(metrics.gmiPct, locale) : '—',
          goal: '—',
          ok: null,
          note: metrics.gmiPct == null ? t('gmiPasAssez') : !metrics.gmiReliable ? t('gmiNonFiable') : null,
        },
        { label: t('moyenne'), value: `${gl(metrics.meanGl)} g/L (± ${gl(metrics.sdGl)})`, goal: '—', ok: null },
        { label: tf(t, 'glycMinMax', 'Minimum – maximum'), value: `${gl(metrics.minGl)} – ${gl(metrics.maxGl)} g/L`, goal: '—', ok: null },
        {
          label: t('hypos'),
          value: `${metrics.hypoCount} (< ${gl(CONSENSUS.level1Low)}) · ${metrics.severeHypoCount} (< ${gl(CONSENSUS.level2Low)})`,
          goal: '—',
          ok: null,
        },
      ]
    : [];

  return (
    <div className="icr-print-root" style={S.overlay} role="dialog" aria-modal="true" aria-labelledby="icr-report-title">
      <div style={S.page}>
        <header style={S.header}>
          <h1 id="icr-report-title" style={S.h1}>{t('rapportMedecin')}</h1>
          {patientName && (
            <p style={S.meta}>
              <strong>{t('nomPatient')} :</strong> {patientName}
            </p>
          )}
          <p style={S.meta}>
            <strong>{tf(t, 'periodeLabel', 'Période')} :</strong> {periodLabel}
            {from && to ? ` (${formatDate(from, locale)} – ${formatDate(to, locale)})` : ''}
          </p>
          <p style={S.meta}>
            <strong>{tf(t, 'genereLe', 'Généré le')}</strong> {formatDate(generated, locale)} {formatTime(generated, locale)}
          </p>
        </header>

        <section style={S.section} className="icr-avoid-break">
          <h2 style={S.h2}>{tf(t, 'parametresTraitement', 'Paramètres du traitement')}</h2>
          <table style={S.table}>
            <tbody>
              <tr>
                <td style={S.td}><strong>{t('ratioICR')}</strong></td>
                <td style={S.tdNum}>{ratio ? `1 U / ${ratio} g` : '—'}</td>
              </tr>
              <tr>
                <td style={S.td}><strong>{t('isfCorrection')}</strong></td>
                <td style={S.tdNum}>{isf ? `${isf} mg/dL / U` : '—'}</td>
              </tr>
              <tr>
                <td style={S.td}><strong>{t('cibleChart')}</strong></td>
                <td style={S.tdNum}>{`${gl(Number(targetGMin))} – ${gl(Number(targetGMax))} g/L`}</td>
              </tr>
              <tr>
                <td style={S.td}><strong>{t('cl_insulineRapide')}</strong></td>
                <td style={S.td}>{insulinRapid || '—'}</td>
              </tr>
              <tr>
                <td style={S.td}><strong>{t('cl_doseBasale')}</strong></td>
                <td style={S.tdNum}>{basalDose ? `${basalDose} U` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section style={S.section} className="icr-avoid-break">
          <h2 style={S.h2}>{t('metriquesTitre')}</h2>
          {metrics && (
            <p style={S.muted}>{t('lecturesEtJours', { n: metrics.n, days: metrics.daysWithData })}</p>
          )}
          {metrics && metrics.n > 0 ? (
            <>
              <div style={{ margin: '12px 0' }}>
                <TirBar metrics={metrics} t={t} isDark={false} locale={locale} />
              </div>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>{tf(t, 'indicateur', 'Indicateur')}</th>
                    <th style={S.th}>{tf(t, 'valeur', 'Valeur')}</th>
                    <th style={S.th}>{t('objectif')}</th>
                    <th style={S.th} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <td style={S.td}>
                        {r.label}
                        {r.note && <p style={S.note}>{r.note}</p>}
                      </td>
                      <td style={S.tdNum}>{r.value}</td>
                      <td style={S.tdNum}>{r.goal}</td>
                      <td style={S.td}>{statusText(r.ok)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p style={S.muted}>{t('aucuneDonnee')}</p>
          )}
        </section>

        <section style={S.section} className="icr-avoid-break">
          <h2 style={S.h2}>{t('agpTitre')}</h2>
          <p style={S.muted}>{t('agpDesc')}</p>
          {profile && profile.daysWithData >= 3 ? (
            <div style={{ marginTop: 8 }}>
              <AgpChart profile={profile} targetMin={CONSENSUS.tirMin} targetMax={CONSENSUS.tirMax} isDark={false} t={t} locale={locale} />
            </div>
          ) : (
            <p style={{ ...S.muted, marginTop: 8 }}>{t('agpPasAssez')}</p>
          )}
          {profile && (
            <p style={{ ...S.muted, marginTop: 6 }}>{t('agpCouverture', { pct: Math.round((profile.coverage ?? 0) * 100) })}</p>
          )}
        </section>

        <section style={S.section} className="icr-avoid-break">
          <h2 style={S.h2}>{t('patternsTitre')}</h2>
          {patternLines.length === 0 ? (
            <p style={S.muted}>{t('patternsAucun')}</p>
          ) : (
            <ul style={S.list}>
              {patternLines.map((p) => (
                <li key={p.key}>
                  <span aria-hidden="true">{p.icon} </span>
                  <strong>{p.severityLabel} :</strong> {p.text}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={S.section} className="icr-avoid-break">
          <h2 style={S.h2}>{t('suggestionsTitre')}</h2>
          {treatment && !treatment.enoughData ? (
            <p style={S.muted}>{t('suggestionsPasAssez', { days: treatment.daysOfData, min: treatment.minDays ?? 14 })}</p>
          ) : (
            <>
              {treatment?.tdd && (
                <p style={{ ...S.muted, marginBottom: 8 }}>
                  {t('tddMoyenne')} : <strong style={{ color: '#000' }}>{fmtNum(treatment.tdd.meanU, 1, locale)} U</strong>
                  {' · '}
                  {t('basaleEstimee')} : <strong style={{ color: '#000' }}>{fmtNum(treatment.tdd.basalEstimateU, 1, locale)} U</strong>
                </p>
              )}
              {suggestionLines.length === 0 ? (
                <p style={S.muted}>{tf(t, 'suggestionsAucune', 'Aucun ajustement à signaler sur la période.')}</p>
              ) : (
                <ul style={S.list}>
                  {suggestionLines.map((s) => (
                    <li key={s.key}>{s.text}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p style={{ ...S.note, marginTop: 8 }}>{t('suggestionsDisclaimer')}</p>
        </section>

        <div style={S.disclaimer}>
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>⚕️</p>
          <p style={{ margin: 0 }}>{t('disclaimerFull')}</p>
        </div>

        <div style={S.actions} className="icr-no-print">
          <button type="button" onClick={() => window.print()} style={S.btnPrimary}>
            {t('imprimerExporter')}
          </button>
          <button ref={closeRef} type="button" onClick={onClose} style={S.btnSecondary}>
            {t('fermer')}
          </button>
        </div>
      </div>

      <style>{PRINT_CSS}</style>
    </div>
  );
}
