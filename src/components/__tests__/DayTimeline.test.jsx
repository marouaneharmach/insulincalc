/** @vitest-environment jsdom */
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DayTimeline from '../DayTimeline';

function Wrapper({ initialJournal }) {
  const [journal, setJournal] = useState(initialJournal);
  const t = (key) => ({
    doseReellePrise: 'Dose réellement prise',
    doseSuggeree: 'Dose suggérée',
    planInjection: 'Plan d’injection',
    modifierDose: 'Modifier la dose',
    aujourdhui: 'Aujourd’hui',
    hier: 'Hier',
    repas: 'Repas',
    correction: 'Correction',
    unites: 'unités',
    insulineActive: 'Insuline active',
  }[key] || key);

  return (
    <DayTimeline
      journal={journal}
      setJournal={setJournal}
      targetGMin={1}
      targetGMax={1.2}
      t={t}
      isDark={false}
      locale="fr"
      dia={4.5}
    />
  );
}

describe('DayTimeline', () => {
  it('displays the real dose as primary and the total split plan', () => {
    const today = new Date().toISOString();

    render(
      <Wrapper
        initialJournal={[
          {
            id: 'meal-1',
            date: today,
            mealType: 'repas',
            aliments: [{ name: 'Burger King' }],
            totalGlucides: 112,
            glycPre: 1.9,
            doseSuggeree: 15.5,
            doseReelle: 10,
            doseActual: 10,
            bolusType: 'etendu',
            splitImmediate: 5,
            splitDelayed: 5,
            splitDelayMinutes: 60,
            splitPhases: [
              { label: 'Glucides rapides', delayMinutes: 0, units: 5, done: true, checkGlycemia: false },
              { label: 'Absorption graisses', delayMinutes: 60, units: 3, done: false, checkGlycemia: true },
              { label: 'Queue de digestion lente', delayMinutes: 180, units: 2, done: false, checkGlycemia: true },
            ],
          },
        ]}
      />
    );

    expect(screen.getByText(/Dose réellement prise: 10U/i)).toBeTruthy();
    expect(screen.getByText(/Dose suggérée: 15.5U/i)).toBeTruthy();
    expect(screen.getByText(/Plan d’injection: 10U au total/i)).toBeTruthy();
  });

  it('rescales the persisted split plan when the dose is edited later', () => {
    const today = new Date().toISOString();

    render(
      <Wrapper
        initialJournal={[
          {
            id: 'meal-2',
            date: today,
            mealType: 'repas',
            aliments: [{ name: 'Whopper' }],
            totalGlucides: 112,
            glycPre: 1.9,
            doseSuggeree: 15.5,
            doseReelle: 10,
            doseActual: 10,
            bolusType: 'etendu',
            splitImmediate: 5,
            splitDelayed: 5,
            splitDelayMinutes: 60,
            splitPhases: [
              { label: 'Glucides rapides', delayMinutes: 0, units: 5, done: true, checkGlycemia: false },
              { label: 'Absorption graisses', delayMinutes: 60, units: 3, done: false, checkGlycemia: true },
              { label: 'Queue de digestion lente', delayMinutes: 180, units: 2, done: false, checkGlycemia: true },
            ],
          },
        ]}
      />
    );

    fireEvent.click(screen.getAllByTitle(/Modifier la dose/i)[0]);
    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('✓'));

    expect(screen.getByText(/Dose réellement prise: 8U/i)).toBeTruthy();
    expect(screen.getByText(/Plan d’injection: 8U au total/i)).toBeTruthy();
    expect(screen.getByText(/4u — Glucides rapides/i)).toBeTruthy();
    expect(screen.getByText(/2.5u — Absorption graisses/i)).toBeTruthy();
    expect(screen.getByText(/1.5u — Queue de digestion lente/i)).toBeTruthy();
  });
});
