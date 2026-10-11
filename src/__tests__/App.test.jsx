/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../App';

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

describe('App (intégration)', () => {
  it('onboarding puis écran de consultation, journal migré depuis localStorage', async () => {
    localStorage.setItem('insulincalc_v4_onboarded', 'true');
    localStorage.setItem('insulincalc_v4_journal', JSON.stringify([
      { id: 1700000000000, date: new Date(Date.now() - 3600000).toISOString(), preMealGlycemia: '1.35', doseCalculated: 4, doseInjected: 3.5, totalCarbs: 55 },
    ]));
    render(<App />);
    expect(await screen.findByRole('button', { name: /Analyser/i })).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/1\.35 g\/L/)).toBeTruthy());
    expect(screen.getByText(/InsulinCalc/)).toBeTruthy();
  });

  it('affiche l’onboarding quand non initialisé', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Suivant/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Suivant/i }));
    expect(screen.getByText(/Paramètres insuline/i)).toBeTruthy();
  });
});
