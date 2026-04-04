/**
 * ClinicalResponse.jsx — 4-bloc clinical display for InsulinCalc v5
 *
 * Renders the structured output of analyzeAndRecommend() into four
 * distinct sections: Analyse, Recommandation, Vigilance, Prochaine étape.
 */

// ─── Sub-component: Section card ──────────────────────────────────────────────

function Section({ icon, title, children, isDark }) {
  return (
    <div className={`rounded-xl overflow-hidden border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
        <span className="text-base leading-none">{icon}</span>
        <h3 className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
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

function DoseBreakdown({ reasoning, t, isDark }) {
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
        <div key={key} className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span>{t(key)}</span>
          <span className={`font-medium tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {value > 0 ? `+${value}` : value} U
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClinicalResponse({ result, t, isDark = true }) {
  if (!result) return null;

  const { analysis, recommendation, vigilance, nextStep, prediction } = result;

  const hasVigilance =
    (vigilance?.risks?.length > 0) || (vigilance?.warnings?.length > 0);

  return (
    <div className="space-y-3">

      {/* ── Section 1 : Analyse ─────────────────────────────────────────────── */}
      <Section icon="🔍" title={t('cl_analyse')} isDark={isDark}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={analysis.glycemiaStatus} t={t} />

          {analysis.iob > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {t('cl_iobActive')} {Math.round(analysis.iob * 10) / 10} {t('cl_unites')}
            </span>
          )}
        </div>

        <div className={`mt-3 flex items-center gap-4 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {analysis.totalCarbs != null && (
            <span>
              <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{analysis.totalCarbs} g</span>
              {' '}{t('cl_glucides') || 'glucides'}
            </span>
          )}
          {analysis.fatLevel && analysis.fatLevel !== 'aucun' && (
            <span>
              {t('cl_gras') || 'Gras'}{' '}
              <span className={`font-semibold capitalize ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{analysis.fatLevel}</span>
            </span>
          )}
          {analysis.trend && (
            <span>
              {t('cl_tendance')}{' '}
              <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{analysis.trend}</span>
            </span>
          )}
        </div>
      </Section>

      {/* ── Section 2 : Recommandation ──────────────────────────────────────── */}
      <Section icon="💉" title={t('cl_recommandation')} isDark={isDark}>
        {recommendation.blocked ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/15 border border-red-500/30">
            <span className="text-red-400 text-base leading-none mt-0.5">🚫</span>
            <p className={`text-sm font-medium leading-snug ${isDark ? 'text-red-300' : 'text-red-600'}`}>
              {recommendation.reasoning?.bolusRepas ?? recommendation.blocked}
            </p>
          </div>
        ) : (
          <>
            {/* Large dose number */}
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold tabular-nums leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {recommendation.dose}
              </span>
              <span className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>U</span>

              {recommendation.split?.type === 'etendu' ? (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-500 border border-indigo-500/30 uppercase tracking-wide">
                  {t('etendu3Phases') || 'Étendu 3 phases'}
                </span>
              ) : recommendation.split?.type === 'fractionne' ? (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-500 border border-purple-500/30 uppercase tracking-wide">
                  {t('cl_doseFractionnee')}
                </span>
              ) : (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-500 border border-teal-500/30 uppercase tracking-wide">
                  {t('cl_doseUnique')}
                </span>
              )}
            </div>

            {/* Extended 3-phase details */}
            {recommendation.split?.type === 'etendu' && recommendation.split.phases && (
              <div className="mt-3 space-y-1.5">
                {recommendation.split.phases.map((phase, i) => (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg border ${
                    isDark ? 'bg-indigo-900/15 border-indigo-700/30' : 'bg-indigo-50 border-indigo-200'
                  }`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isDark ? 'bg-indigo-700 text-indigo-200' : 'bg-indigo-200 text-indigo-700'
                    }`}>{i + 1}</span>
                    <div className="flex-1">
                      <p className={`text-xs font-medium ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>{phase.label}</p>
                      <p className={`text-[10px] ${isDark ? 'text-indigo-500' : 'text-indigo-400'}`}>
                        {phase.delayMinutes === 0 ? 'Maintenant' : `+${phase.delayMinutes} min`}
                        {phase.checkGlycemia && ' · 🩸 contrôle'}
                      </p>
                    </div>
                    <span className={`text-lg font-bold tabular-nums ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                      {phase.units}U
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Split details */}
            {recommendation.split?.type === 'fractionne' && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 flex flex-col items-center p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                  <span className="text-[10px] uppercase tracking-wider text-teal-500 mb-1">
                    {t('cl_immediat')}
                  </span>
                  <span className="text-xl font-bold text-teal-400 tabular-nums">
                    {recommendation.split.immediate} U
                  </span>
                </div>
                <span className={`text-lg ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>+</span>
                <div className="flex-1 flex flex-col items-center p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[10px] uppercase tracking-wider text-purple-500 mb-1">
                    +{recommendation.split.delayMinutes} min
                  </span>
                  <span className="text-xl font-bold text-purple-400 tabular-nums">
                    {recommendation.split.delayed} U
                  </span>
                </div>
              </div>
            )}

            {/* Dose breakdown */}
            <DoseBreakdown reasoning={recommendation.reasoning} t={t} isDark={isDark} />
          </>
        )}
      </Section>

      {/* ── Section 3 : Vigilance (conditional) ─────────────────────────────── */}
      {hasVigilance && (
        <Section icon="⚠️" title={t('cl_vigilance')} isDark={isDark}>
          <div className="space-y-2">
            {vigilance.risks?.map((risk, i) => (
              <div
                key={`risk-${i}`}
                className={`flex items-start gap-2 p-2.5 rounded-lg border ${isDark ? 'bg-red-500/10 border-red-500/25' : 'bg-red-50 border-red-200'}`}
              >
                <span className="text-red-500 text-sm leading-none mt-0.5 shrink-0">🔴</span>
                <p className={`text-xs leading-snug ${isDark ? 'text-red-300' : 'text-red-600'}`}>{risk.message}</p>
              </div>
            ))}
            {vigilance.warnings?.map((warn, i) => (
              <div
                key={`warn-${i}`}
                className={`flex items-start gap-2 p-2.5 rounded-lg border ${isDark ? 'bg-amber-500/10 border-amber-500/25' : 'bg-amber-50 border-amber-200'}`}
              >
                <span className="text-amber-500 text-sm leading-none mt-0.5 shrink-0">🟡</span>
                <p className={`text-xs leading-snug ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{warn.message}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Section 4 : Prediction post-repas ──────────────────────────────── */}
      {prediction && !recommendation.blocked && recommendation.dose > 0 && (
        <Section icon="📈" title={t('predictionPostRepas') || 'Prédiction post-repas'} isDark={isDark}>
          <div className="flex items-center gap-3">
            <div className={`flex flex-col items-center px-4 py-2 rounded-lg border shrink-0 ${
              prediction.zone === 'cible' ? (isDark ? 'bg-green-900/30 border-green-700/40' : 'bg-green-50 border-green-200')
              : prediction.zone === 'hypo' || prediction.zone === 'bas' ? (isDark ? 'bg-red-900/30 border-red-700/40' : 'bg-red-50 border-red-200')
              : (isDark ? 'bg-orange-900/30 border-orange-700/40' : 'bg-orange-50 border-orange-200')
            }`}>
              <span className={`text-2xl font-bold tabular-nums leading-none ${
                prediction.zone === 'cible' ? (isDark ? 'text-green-400' : 'text-green-700')
                : prediction.zone === 'hypo' || prediction.zone === 'bas' ? (isDark ? 'text-red-400' : 'text-red-700')
                : (isDark ? 'text-orange-400' : 'text-orange-700')
              }`}>
                {prediction.predicted.toFixed(2)}
              </span>
              <span className={`text-[10px] uppercase tracking-wider mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                g/L à +2h
              </span>
            </div>
            <div className="flex-1">
              <p className={`text-xs leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {prediction.delta > 0 ? '+' : ''}{prediction.delta.toFixed(2)} g/L
                {prediction.zone === 'cible' && ' — dans la cible ✓'}
                {prediction.zone === 'hypo' && ' — risque hypo ⚠️'}
                {prediction.zone === 'bas' && ' — attention glycémie basse'}
                {prediction.zone === 'haut' && ' — glycémie restera élevée'}
                {prediction.zone === 'hyper' && ' — hyperglycémie persistante ⚠️'}
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* ── Section 5 : Prochaine étape ──────────────────────────────────────── */}
      {nextStep && (
        <Section icon="⏱️" title={t('cl_prochaineEtape')} isDark={isDark}>
          <div className="flex items-center gap-3">
            {nextStep.checkTime != null && (
              <div className={`flex flex-col items-center px-4 py-2 rounded-lg border shrink-0 ${isDark ? 'bg-slate-700/50 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
                <span className={`text-2xl font-bold tabular-nums leading-none ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {nextStep.checkTime}
                </span>
                <span className={`text-[10px] uppercase tracking-wider mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('cl_minutes')}
                </span>
              </div>
            )}
            {nextStep.instruction && (
              <p className={`text-sm leading-snug flex-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {nextStep.instruction}
              </p>
            )}
          </div>
        </Section>
      )}

    </div>
  );
}
