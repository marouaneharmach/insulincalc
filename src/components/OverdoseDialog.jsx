import { useEffect, useId, useRef } from 'react';

const noTranslate = () => undefined;

/**
 * OverdoseDialog — confirmation explicite lorsqu'une dose dépasse le plafond
 * de sécurité. Boîte de dialogue modale accessible : focus initial sur
 * l'action la moins destructive (« Annuler et vérifier »), fermeture par
 * Échap, titre et description reliés par aria-labelledby / aria-describedby.
 */
export default function OverdoseDialog({ dose, maxDose, onConfirm, onCancel, isDark, t = noTranslate }) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const title = t('doseEleveeDetectee') || t('doseElevee') || 'Dose élevée détectée';
  const description = t('doseDepasseSeuil', { dose, max: maxDose })
    || `La dose calculée de ${dose} U dépasse votre seuil de sécurité de ${maxDose} U.`;
  const advice = t('verifierParametres') || 'Vérifiez vos paramètres';
  const contact = t('contactMedecin') || 'En cas de doute, consultez votre médecin';
  const confirmLabel = t('onboardingConfirmerDose', { dose }) || `Confirmer et enregistrer ${dose} U`;
  const cancelLabel = t('annulerVerifier') || 'Annuler et vérifier';
  const maxLabel = t('max') || 'max';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`max-w-sm w-full rounded-2xl p-5 space-y-4 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-2xl`}
      >
        <div className="text-center">
          <p className="text-5xl mb-3" aria-hidden="true">🚨</p>
          <h2 id={titleId} className={`text-lg font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            {title}
          </h2>
          <p id={descId} className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {description}
          </p>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <strong className={isDark ? 'text-red-400' : 'text-red-600'}>{dose} U</strong>
            {' · '}
            {maxLabel} <strong>{maxDose} U</strong>
          </p>
        </div>

        <div className={`p-3 rounded-xl ${isDark ? 'bg-red-900/20 border border-red-800/40' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xs ${isDark ? 'text-red-300' : 'text-red-700'}`}>
            ⚕️ {advice}. {contact}.
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3 rounded-2xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
          >
            ⚠️ {confirmLabel}
          </button>
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className={`w-full py-3 rounded-2xl font-medium text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
              isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
