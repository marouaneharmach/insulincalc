/**
 * ClinicalResponse — affichage structuré de analyzeAndRecommend() :
 * Analyse, Recommandation, Vigilance, Prédiction, Prochaine étape.
 * Tous les textes proviennent des codes du moteur traduits via t().
 */
import { VELOCITY_ARROW } from '../domain/engine/velocity';
import { alertText } from './alertText';

function Section({ icon, title, children, isDark }) {
  return (
    <section className={`rounded-xl overflow-hidden border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`} aria-label={title}>
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
        <span className="text-base leading-none" aria-hidden="true">{icon}</span>
        <h3 className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

const STATUS_COLORS = {
  'hypo-severe': 'bg-red-700 text-white', hypo: 'bg-red-600 text-white', 'hypo-proche': 'bg-orange-600 text-white',
  cible: 'bg-green-700 text-white', 'sous-cible': 'bg-yellow-400 text-slate-900', elevee: 'bg-orange-500 text-white',
  haute: 'bg-red-500 text-white', 'hyper-severe': 'bg-red-800 text-white',
};
const STATUS_I18N_KEY = {
  'hypo-severe': 'cl_hypoSevere', hypo: 'cl_hypo', 'hypo-proche': 'cl_hypoProche', cible: 'cl_cible',
  'sous-cible': 'cl_sousCible', elevee: 'cl_elevee', haute: 'cl_haute', 'hyper-severe': 'cl_hyperSevere',
};
const RISK_STYLE = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  high: 'bg-red-100 text-red-800 border-red-300',
  critical: 'bg-red-200 text-red-900 border-red-400',
};
const ZONE_STYLE = (zone, isDark) => zone === 'cible'
  ? (isDark ? 'bg-green-900/30 border-green-700/40 text-green-300' : 'bg-green-50 border-green-200 text-green-800')
  : zone === 'hypo' || zone === 'bas'
    ? (isDark ? 'bg-red-900/30 border-red-700/40 text-red-300' : 'bg-red-50 border-red-200 text-red-800')
    : (isDark ? 'bg-orange-900/30 border-orange-700/40 text-orange-300' : 'bg-orange-50 border-orange-200 text-orange-800');

function DoseBreakdown({ reasoning, t, isDark }) {
  if (!reasoning) return null;
  const items = [
    { key: 'cl_bolusRepas', value: reasoning.bolusRepas },
    { key: 'cl_correction', value: reasoning.correctionFinale ?? reasoning.correctionNette },
    { key: 'cl_bonusGras', value: reasoning.bonusGras },
  ].filter((item) => item.value != null && Math.round(item.value * 100) !== 0);
  if (items.length === 0 && (reasoning.activityFactor ?? 1) === 1) return null;
  return (
    <dl className="mt-3 space-y-1">
      {items.map(({ key, value }) => (
        <div key={key} className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <dt>{t(key)}</dt>
          <dd className={`font-medium tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{value > 0 ? '+' : ''}{Math.round(value * 100) / 100} U</dd>
        </div>
      ))}
      {reasoning.activityFactor != null && reasoning.activityFactor !== 1 && (
        <div className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <dt>{t('cl_activite')}</dt>
          <dd className="font-medium tabular-nums">× {reasoning.activityFactor}</dd>
        </div>
      )}
    </dl>
  );
}

function AlertList({ items, tone, icon, t, isDark }) {
  if (!items?.length) return null;
  const cls = tone === 'risk'
    ? (isDark ? 'bg-red-500/10 border-red-500/25 text-red-200' : 'bg-red-50 border-red-200 text-red-800')
    : tone === 'warning'
      ? (isDark ? 'bg-amber-500/10 border-amber-500/25 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800')
      : (isDark ? 'bg-sky-500/10 border-sky-500/25 text-sky-200' : 'bg-sky-50 border-sky-200 text-sky-800');
  return items.map((a, i) => (
    <div key={`${tone}-${i}`} className={`flex items-start gap-2 p-2.5 rounded-lg border ${cls}`}>
      <span className="text-sm leading-none mt-0.5 shrink-0" aria-hidden="true">{icon}</span>
      <p className="text-xs leading-snug">{alertText(a, t)}</p>
    </div>
  ));
}

export default function ClinicalResponse({ result, t, isDark = true }) {
  if (!result) return null;
  const { analysis, recommendation, vigilance, nextStep, prediction } = result;
  const hasVigilance = vigilance?.risks?.length > 0 || vigilance?.warnings?.length > 0 || vigilance?.infos?.length > 0;
  const subtle = isDark ? 'text-slate-400' : 'text-slate-500';
  const velocityArrow = analysis.velocityClass ? VELOCITY_ARROW[analysis.velocityClass] : analysis.trend;

  return (
    <div className="space-y-3">
      <Section icon="🔍" title={t('cl_analyse')} isDark={isDark}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[analysis.glycemiaStatus] ?? 'bg-slate-600 text-white'}`}>
            {t(STATUS_I18N_KEY[analysis.glycemiaStatus] ?? 'cl_cible')}
          </span>
          {analysis.iob > 0 && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${isDark ? 'bg-blue-500/20 text-blue-200 border-blue-500/30' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
              {t('cl_iobActive')} {Math.round(analysis.iob * 10) / 10} {t('cl_unites')}
            </span>
          )}
          {analysis.hypoRisk && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${RISK_STYLE[analysis.hypoRisk.level]}`}>
              {t(`RISK_${analysis.hypoRisk.level}`)} · {analysis.hypoRisk.score}
            </span>
          )}
          {analysis.nightMode && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>🌑 {t('modeNuitActif')}</span>
          )}
        </div>
        <div className={`mt-3 flex flex-wrap items-center gap-4 text-xs ${subtle}`}>
          {analysis.totalCarbs != null && (
            <span><span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{analysis.totalCarbs} g</span> {t('cl_glucides') || 'glucides'}</span>
          )}
          {analysis.fatLevel && analysis.fatLevel !== 'aucun' && (
            <span>{t('cl_gras') || 'Gras'} <span className={`font-semibold capitalize ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{analysis.fatLevel}</span></span>
          )}
          <span>
            {t('cl_tendance')}{' '}
            <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {velocityArrow} {analysis.velocityClass ? t(`VEL_${analysis.velocityClass}`) : ''}
              {analysis.velocity != null && ` (${analysis.velocity > 0 ? '+' : ''}${analysis.velocity.toFixed(2)} g/L/h)`}
            </span>
          </span>
        </div>
      </Section>

      <Section icon="💉" title={t('cl_recommandation')} isDark={isDark}>
        {recommendation.blocked ? (
          <div role="alert" className={`flex items-start gap-2 p-3 rounded-lg border ${isDark ? 'bg-red-500/15 border-red-500/30' : 'bg-red-50 border-red-300'}`}>
            <span className="text-base leading-none mt-0.5" aria-hidden="true">🚫</span>
            <p className={`text-sm font-medium leading-snug ${isDark ? 'text-red-200' : 'text-red-800'}`}>
              {vigilance?.risks?.[0] ? alertText(vigilance.risks[0], t) : t('cl_injectionBloquee')}
            </p>
          </div>
        ) : (
          <>
            {recommendation.split?.type === 'fractionne' ? (
              <>
                <div className="mb-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border uppercase tracking-wide ${isDark ? 'bg-purple-500/20 text-purple-200 border-purple-500/30' : 'bg-purple-50 text-purple-800 border-purple-200'}`}>
                    {t('cl_doseFractionnee')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex-1 flex flex-col items-center p-3 rounded-xl border ${isDark ? 'bg-teal-500/10 border-teal-500/20' : 'bg-teal-50 border-teal-200'}`}>
                    <span className={`text-xs uppercase tracking-wider mb-1 ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>{t('cl_immediat')}</span>
                    <span className={`text-3xl font-bold tabular-nums ${isDark ? 'text-teal-200' : 'text-teal-700'}`}>{recommendation.split.immediate}</span>
                    <span className={`text-xs font-medium ${isDark ? 'text-teal-300' : 'text-teal-600'}`}>U</span>
                  </div>
                  <span className={`text-xl font-bold ${subtle}`} aria-hidden="true">+</span>
                  <div className={`flex-1 flex flex-col items-center p-3 rounded-xl border ${isDark ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50 border-purple-200'}`}>
                    <span className={`text-xs uppercase tracking-wider mb-1 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>+{recommendation.split.delayMinutes} min</span>
                    <span className={`text-3xl font-bold tabular-nums ${isDark ? 'text-purple-200' : 'text-purple-700'}`}>{recommendation.split.delayed}</span>
                    <span className={`text-xs font-medium ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>U</span>
                  </div>
                </div>
                <p className={`mt-2 text-center text-xs ${subtle}`}>{t('total')} : <span className="font-semibold">{recommendation.dose} U</span></p>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className={`text-4xl font-bold tabular-nums leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{recommendation.dose}</span>
                  <span className={`text-lg font-medium ${subtle}`}>U</span>
                  {recommendation.split?.type === 'etendu' ? (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wide ${isDark ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/30' : 'bg-indigo-50 text-indigo-800 border-indigo-200'}`}>
                      {t('etendu3Phases') || 'Étendu 3 phases'}
                    </span>
                  ) : (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wide ${isDark ? 'bg-teal-500/20 text-teal-200 border-teal-500/30' : 'bg-teal-50 text-teal-800 border-teal-200'}`}>
                      {t('cl_doseUnique')}
                    </span>
                  )}
                </div>
                {recommendation.split?.type === 'etendu' && recommendation.split.phases && (
                  <ol className="mt-3 space-y-1.5">
                    {recommendation.split.phases.map((phase, i) => (
                      <li key={i} className={`flex items-center gap-3 p-2 rounded-lg border ${isDark ? 'bg-indigo-900/15 border-indigo-700/30' : 'bg-indigo-50 border-indigo-200'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-indigo-700 text-indigo-100' : 'bg-indigo-200 text-indigo-800'}`}>{i + 1}</span>
                        <div className="flex-1">
                          <p className={`text-xs font-medium ${isDark ? 'text-indigo-200' : 'text-indigo-800'}`}>{t(phase.label) === phase.label ? phase.label : t(phase.label)}</p>
                          <p className={`text-xs ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                            {phase.delayMinutes === 0 ? t('maintenant') : `+${phase.delayMinutes} min`}{phase.checkGlycemia && ` · 🩸 ${t('controlerGlycemieAvant')}`}
                          </p>
                        </div>
                        <span className={`text-lg font-bold tabular-nums ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>{phase.units} U</span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
            <p className={`mt-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>⏱ {t(recommendation.timing)}</p>
            <DoseBreakdown reasoning={recommendation.reasoning} t={t} isDark={isDark} />
          </>
        )}
      </Section>

      {hasVigilance && (
        <Section icon="⚠️" title={t('cl_vigilance')} isDark={isDark}>
          <div className="space-y-2">
            <AlertList items={vigilance.risks} tone="risk" icon="🔴" t={t} isDark={isDark} />
            <AlertList items={vigilance.warnings} tone="warning" icon="🟡" t={t} isDark={isDark} />
            <AlertList items={vigilance.infos} tone="info" icon="ℹ️" t={t} isDark={isDark} />
          </div>
        </Section>
      )}

      {prediction && !recommendation.blocked && (
        <Section icon="📈" title={t('predictionPostRepas') || 'Prédiction'} isDark={isDark}>
          <div className="grid grid-cols-3 gap-2">
            {[prediction.at1h, prediction.at2h, prediction.at3h].map((p) => (
              <div key={p.minutes} className={`flex flex-col items-center px-2 py-2 rounded-lg border ${ZONE_STYLE(p.zone, isDark)}`}>
                <span className="text-xs uppercase tracking-wider">+{p.minutes / 60} h</span>
                <span className="text-xl font-bold tabular-nums leading-tight">{p.value.toFixed(2)}</span>
                <span className="text-xs tabular-nums">{p.low.toFixed(1)} à {p.high.toFixed(1)}</span>
                <span className="text-xs mt-0.5">{t(`PRED_ZONE_${p.zone}`)}</span>
              </div>
            ))}
          </div>
          {prediction.alerts?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {prediction.alerts.map((code) => (
                <li key={code} className={`text-xs ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>⚠️ {t(code)}</li>
              ))}
            </ul>
          )}
          <p className={`mt-2 text-xs ${subtle}`}>{t('predictionEstimation')} · g/L · {t('predictionPlage')}</p>
        </Section>
      )}

      {nextStep && (
        <Section icon="⏱️" title={t('cl_prochaineEtape')} isDark={isDark}>
          <div className="flex items-center gap-3">
            {nextStep.checkTime != null && (
              <div className={`flex flex-col items-center px-4 py-2 rounded-lg border shrink-0 ${isDark ? 'bg-slate-700/50 border-slate-600/40' : 'bg-gray-100 border-gray-200'}`}>
                <span className={`text-2xl font-bold tabular-nums leading-none ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{nextStep.checkTime}</span>
                <span className={`text-xs uppercase tracking-wider mt-0.5 ${subtle}`}>{t('cl_minutes')}</span>
              </div>
            )}
            <p className={`text-sm leading-snug flex-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t(nextStep.instruction, { minutes: nextStep.checkTime })}</p>
          </div>
        </Section>
      )}
    </div>
  );
}
