/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

afterEach(cleanup);
import Switch from '../ui/Switch';
import Field from '../ui/Field';

describe('Switch', () => {
  it('expose role="switch" et aria-checked, relié à son libellé', () => {
    render(<Switch checked={false} onChange={() => {}} label="Mode nuit" description="Bloque la correction" isDark={false} />);
    const sw = screen.getByRole('switch', { name: 'Mode nuit' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.getAttribute('type')).toBe('button');
    expect(sw.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(sw.getAttribute('aria-describedby')).textContent).toBe('Bloque la correction');
  });

  it('reflète la valeur contrôlée', () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} label="Profils" />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    rerender(<Switch checked onChange={() => {}} label="Profils" />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('bascule au clic', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Profils" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('bascule au clavier (Espace et Entrée)', () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="Profils" />);
    const sw = screen.getByRole('switch');
    fireEvent.keyDown(sw, { key: ' ' });
    expect(onChange).toHaveBeenLastCalledWith(false);
    fireEvent.keyDown(sw, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(sw, { key: 'a' });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('ignore les interactions lorsqu\'il est désactivé', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Profils" disabled />);
    const sw = screen.getByRole('switch');
    expect(sw.hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(sw, { key: ' ' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respecte un id fourni', () => {
    render(<Switch id="custom-switch" checked={false} onChange={() => {}} label="Profils" />);
    const sw = screen.getByRole('switch');
    expect(sw.id).toBe('custom-switch');
    expect(sw.getAttribute('aria-labelledby')).toBe('custom-switch-label');
  });
});

describe('Field', () => {
  it('associe le libellé et l\'aide au contrôle enfant', () => {
    render(
      <Field id="poids" label="Poids (kg)" hint="Entre 15 et 300 kg" isDark={false}>
        <input type="number" />
      </Field>,
    );
    const input = screen.getByLabelText('Poids (kg)');
    expect(input.tagName).toBe('INPUT');
    expect(input.id).toBe('poids');
    expect(input.getAttribute('aria-describedby')).toBe('poids-hint');
    expect(document.getElementById('poids-hint').textContent).toBe('Entre 15 et 300 kg');
  });

  it('n\'écrase pas un id déjà présent sur le contrôle', () => {
    render(
      <Field id="field-x" label="Taille">
        <input id="taille-input" type="number" />
      </Field>,
    );
    const input = screen.getByLabelText('Taille');
    expect(input.id).toBe('taille-input');
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });

  it('fonctionne sans aide', () => {
    render(
      <Field id="age" label="Âge">
        <input type="number" />
      </Field>,
    );
    const input = screen.getByLabelText('Âge');
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(document.getElementById('age-hint')).toBeNull();
  });
});
