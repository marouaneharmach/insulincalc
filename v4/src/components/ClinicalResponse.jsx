/**
 * ClinicalResponse.jsx — 4-bloc clinical display for InsulinCalc v5
 *
 * Renders the structured output of analyzeAndRecommend() into four
 * distinct sections: Analyse, Recommandation, Vigilance, Prochaine étape.
 */

// ─── Sub-component: Section card ──────────────────────────────────────────────

function Section({ icon, title, children }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
        <span className="text-base leading-none">{icon}</span>
        <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-300">
          {title}
        </h3>
      </div>
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}

// ─── Sub-component: StatusBadge ───────────────────────────────────────────────

const STATUS_COLORS = {
  'hypo-severe':  'bg-red-600 text-white',
  'hypo':         'bg-red-500 text-white',
  'hypo-proche':  'bg-orange-500 text-white',
  'cible':        'bg-green-500 text-white',
  'sous-cible':   'bg-yellow-500 text-slate-900',
  'elevee':       'bg-orange-400 text-white',
  'haute':        'bg-red-400 text-white',
  'hyper-severe': 'bg-red-700 text-white',
};

const STATUS_I18N_KEY = {
  'hypo-severe':  'cl_hypoSevere',
  'hypo':         'cl_hypo',
  'hypo-proche':  'cl_hypoProche',
  'cible':        'cl_cible',
  'sous-cible':   'cl_sousCible',
  'elevee':       'cl_elevee',
  'haute':        'cl_haute',
  'hyper-severe': 'cl_hyperSevere',
};

function StatusBadge({ status, t }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-slate-600 text-white';
  const label = t(STATUS_I18N_KEY[status] ?? 'cl_cible');
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}

// ─── Sub-component: DoseBreakdown ─────────────────────────────────────────────

function DoseBreakdown({ reasoning, t }) {
  if (!reasoning) return null;

  const items = [
    { key: 'cl_bolusRepas', value: reasoning.bolusRepas },
    { key: 'cl_correction', value: reasoning.correctionNette },
    { key: 'cl_bonusGras',  value: reasoning.bonusGras },
  ].filter(item => item.value != null && item.value !== 0);

  if (items.length === 0) return null;

  return (
    <div className="mt-3 space-y-1">
      {items.map(({ key, value }) => (
        <div key={key} className="flex items-center justify-between text-xs text-slate-400">
          <span>{t(key)}</span>
          <span className="font-medium text-slate-300 tabular-nums">
            {value > 0 ? `+${value}` : value} U
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClinicalResponse({ result, t }) {
  if (!result) return null;

  const { analysis, recommendation, vigilance, nextStep } = result;

  const hasVigilance =
    (vigilance?.risks?.length > 0) || (vigilance?.warnings?.length > 0);

  return (
    <div className="space-y-3">

      {/* ── Section 1 : Analyse ─────────────────────────────────────────────── */}
      <Section icon="🔍" title={t('cl_analyse')}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={analysis.glycemiaStatus} t={t} />

          {analysis.iob > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {t('cl_iobActive')} {analysis.iob} {t('cl_unites')}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
          {analysis.totalCarbs != null && (
            <span>
              <span className="text-slate-200 font-semibold">{analysis.totalCarbs} g</span>
              {' '}glucides
            </span>
          )}
          {analysis.fatLevel && analysis.fatLevel !== 'aucun' && (
            <span>
              Gras{' '}
              <span className="text-slate-200 font-semibold capitalize">{analysis.fatLevel}</span>
            </span>
          )}
          {analysis.trend && (
            <span>
              {t('cl_tendance')}{' '}
              <span className="text-slate-200 font-semibold">{analysis.trend}</span>
            </span>
          )}
        </div>
      </Section>

      {/* ── Section 2 : Recommandation ──────────────────────────────────────── */}
      <Section icon="💉" title={t('cl_recommandation')}>
        {recommendation.blocked ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/15 border border-red-500/30">
            <span className="text-red-400 text-base leading-none mt-0.5">🚫</span>
            <p className="text-sm text-red-300 font-medium leading-snug">
              {recommendation.reasoning?.bolusRepas ?? recommendation.blocked}
            </p>
          </div>
        ) : (
          <>
            {/* Large dose number */}
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white tabular-nums leading-none">
                {recommendation.dose}
              </span>
              <span className="text-lg text-slate-400 font-medium">U</span>

              {recommendation.split?.type === 'fractionne' ? (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wide">
                  {t('cl_doseFractionnee')}
                </span>
              ) : (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wide">
                  {t('cl_doseUnique')}
                </span>
              )}
            </div>

            {/* Split details */}
            {recommendation.split?.type === 'fractionne' && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 flex flex-col items-center p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                  <span className="text-[10px] uppercase tracking-wider text-teal-400 mb-1">
                    {t('cl_immediat')}
                  </span>
                  <span className="text-xl font-bold text-teal-300 tabular-nums">
                    {recommendation.split.immediate} U
                  </span>
                </div>
                <span className="text-slate-500 text-lg">+</span>
                <div className="flex-1 flex flex-col items-center p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[10px] uppercase tracking-wider text-purple-400 mb-1">
                    +{recommendation.split.delayMinutes} min
                  </span>
                  <span className="text-xl font-bold text-purple-300 tabular-nums">
                    {recommendation.split.delayed} U
                  </span>
                </div>
              </div>
            )}

            {/* Dose breakdown */}
            <DoseBreakdown reasoning={recommendation.reasoning} t={t} />
          </>
        )}
      </Section>

      {/* ── Section 3 : Vigilance (conditional) ─────────────────────────────── */}
      {hasVigilance && (
        <Section icon="⚠️" title={t('cl_vigilance')}>
          <div className="space-y-2">
            {vigilance.risks?.map((risk, i) => (
              <div
                key={`risk-${i}`}
                className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/25"
              >
                <span className="text-red-400 text-sm leading-none mt-0.5 shrink-0">🔴</span>
                <p className="text-xs text-red-300 leading-snug">{risk.message}</p>
              </div>
            ))}
            {vigilance.warnings?.map((warn, i) => (
              <div
                key={`warn-${i}`}
                className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25"
              >
                <span className="text-amber-400 text-sm leading-none mt-0.5 shrink-0">🟡</span>
                <p className="text-xs text-amber-300 leading-snug">{warn.message}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Section 4 : Prochaine étape ──────────────────────────────────────── */}
      {nextStep && (
        <Section icon="⏱️" title={t('cl_prochaineEtape')}>
          <div className="flex items-center gap-3">
            {nextStep.checkTime != null && (
              <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600/40 shrink-0">
                <span className="text-2xl font-bold text-slate-200 tabular-nums leading-none">
                  {nextStep.checkTime}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                  {t('cl_minutes')}
                </span>
              </div>
            )}
            {nextStep.instruction && (
              <p className="text-sm text-slate-300 leading-snug flex-1">
                {nextStep.instruction}
              </p>
            )}
          </div>
        </Section>
      )}

    </div>
  );
}
