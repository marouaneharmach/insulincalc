import { Children, cloneElement, isValidElement } from 'react';

/**
 * Field — enveloppe « libellé + contrôle + aide » accessible.
 *
 * - `<label htmlFor={id}>` associé au contrôle enfant ;
 * - aide optionnelle rendue avec l'id `${id}-hint` et reliée au contrôle
 *   par `aria-describedby`.
 *
 * Lorsque `children` est un élément unique (input, select…), l'`id` et
 * l'`aria-describedby` lui sont injectés automatiquement (sans écraser un
 * `id` déjà fourni). Sinon, placez vous-même `id={id}` et
 * `aria-describedby={`${id}-hint`}` sur le contrôle.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.label
 * @param {import('react').ReactNode} [props.hint]
 * @param {import('react').ReactNode} props.children
 * @param {boolean} [props.isDark]
 * @param {string} props.id
 * @param {string} [props.className]
 */
export default function Field({ label, hint, children, isDark, id, className = '' }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const single = Children.count(children) === 1 && isValidElement(children) ? children : null;
  const controlId = single?.props?.id || id;

  const control = single
    ? cloneElement(single, {
        id: controlId,
        'aria-describedby': [single.props['aria-describedby'], hintId].filter(Boolean).join(' ') || undefined,
      })
    : children;

  return (
    <div className={className}>
      <label
        htmlFor={controlId}
        className={`text-xs uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        {label}
      </label>
      {control}
      {hint && (
        <p id={hintId} className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
