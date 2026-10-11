import { useId } from 'react';

/**
 * Switch — interrupteur accessible (WCAG 2.2 AA).
 *
 * Rend un `<button role="switch" aria-checked>` relié à son libellé par
 * `aria-labelledby` (et à sa description par `aria-describedby`).
 * Opérable au clavier (Espace / Entrée), anneau de focus visible.
 *
 * @param {object} props
 * @param {boolean} props.checked        État courant.
 * @param {(next: boolean) => void} props.onChange  Appelé avec la nouvelle valeur.
 * @param {import('react').ReactNode} props.label   Libellé visible (à gauche).
 * @param {import('react').ReactNode} [props.description]  Texte d'aide optionnel.
 * @param {boolean} [props.isDark]
 * @param {string} [props.id]            Identifiant du bouton (sinon généré).
 * @param {boolean} [props.disabled]
 */
export default function Switch({ checked, onChange, label, description, isDark, id, disabled = false }) {
  const autoId = useId();
  const switchId = id || autoId;
  const labelId = `${switchId}-label`;
  const descId = description ? `${switchId}-desc` : undefined;
  const isOn = Boolean(checked);

  const toggle = () => {
    if (disabled) return;
    onChange?.(!isOn);
  };

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      // On gère nous-mêmes l'activation pour éviter le double déclenchement
      // (clic natif du bouton + handler).
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <span
          id={labelId}
          onClick={toggle}
          className={`block text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'} ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
        >
          {label}
        </span>
        {description && (
          <span id={descId} className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={isOn}
        aria-labelledby={labelId}
        aria-describedby={descId}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={`relative w-12 h-7 shrink-0 rounded-full transition outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
          isDark ? 'focus-visible:ring-offset-slate-800' : 'focus-visible:ring-offset-white'
        } ${isOn ? 'bg-teal-500' : isDark ? 'bg-slate-600' : 'bg-gray-300'} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${isOn ? 'left-6' : 'left-1'}`}
        />
      </button>
    </div>
  );
}
