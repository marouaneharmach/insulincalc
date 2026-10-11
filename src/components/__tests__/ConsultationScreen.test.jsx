/** @vitest-environment jsdom */
import { useState } from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConsultationScreen from '../ConsultationScreen';
import fr from '../../i18n/fr';
import { DEFAULT_RAPID_PROFILE } from '../../domain/insulin/profiles';

const t = (key, params) => {
  let msg = fr[key] ?? key;
  if (params) Object.entries(params).forEach(([k, v]) => { msg = msg.replace(`{${k}}`, String(v)); });
  return msg;
};

function Harness({ onSave, onLogHypo, journal = [], maxDoseU = null, weight = 70, night = { enabled: false } }) {
  const [glycemia, setGlycemia] = useState('');
  return (
    <ConsultationScreen
      glycemia={glycemia} setGlycemia={setGlycemia}
      ratio={10} isf={50} targetGMin={1.0} targetGMax={1.2}
      postKeto={false} slowDigestion={false} insulinProfile={DEFAULT_RAPID_PROFILE}
      weight={weight} maxDoseU={maxDoseU} night={night} fasting={{ enabled: false }} basalDose={0}
      journal={journal} journalReady selections={{}} foods={[]} customFoods={[]}
      toggleFood={() => {}} updateMult={() => {}} timeProfiles={[]}
      onSaveToJournal={onSave} onLogHypo={onLogHypo} onLogBasal={() => {}} onPhotoMeal={null} onSaveCustomFood={() => {}}
      setTab={() => {}} t={t} isRTL={false} isDark={false} locale="fr"
    />
  );
}

afterEach(cleanup);

describe('ConsultationScreen', () => {
  it('analyse un repas en mode glucides et enregistre la dose réelle', () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.change(screen.getByPlaceholderText('1.10'), { target: { value: '1.45' } });
    fireEvent.click(screen.getByRole('button', { name: /Glucides/i }));
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyser/i }));
    expect(screen.getByText(/Injecter/i)).toBeTruthy();
    // 60/10 = 6 U + correction (1.45-1.20)*100/50 = 0.5 → 6.5 U
    expect(screen.getByDisplayValue('6.5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Confirmer/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const entry = onSave.mock.calls[0][0];
    expect(entry.glycPre).toBe(1.45);
    expect(entry.totalGlucides).toBe(60);
    expect(entry.doseSuggeree).toBe(6.5);
    expect(entry.doseReelle).toBe(6.5);
    expect(Array.isArray(entry.alertes)).toBe(true);
  });

  it('affiche le parcours hypoglycémie sous 0,70 et journalise le resucrage', () => {
    const onLogHypo = vi.fn();
    render(<Harness onSave={vi.fn()} onLogHypo={onLogHypo} />);
    fireEvent.change(screen.getByPlaceholderText('1.10'), { target: { value: '0.62' } });
    expect(screen.getByText(/Traitement de l'hypoglycémie/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(fr.hypoDemarrer.slice(0, 12)) }));
    expect(onLogHypo).toHaveBeenCalledWith(expect.objectContaining({ glycemia: 0.62, carbsG: 15 }));
    expect(screen.getByText(/Resucrage enregistré/i)).toBeTruthy();
  });

  it('demande une confirmation au-delà du plafond de dose', () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} maxDoseU={5} />);
    fireEvent.change(screen.getByPlaceholderText('1.10'), { target: { value: '1.10' } });
    fireEvent.click(screen.getByRole('button', { name: /Glucides/i }));
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyser/i }));
    expect(screen.getByText(new RegExp(fr.SAFETY_MAX_DOSE.split('(')[0].slice(0, 10)))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Confirmer/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('utilise la vitesse mesurée depuis le journal', () => {
    const now = Date.now();
    const journal = [
      { id: 'r1', date: new Date(now - 60 * 60000).toISOString(), mealType: 'mesure', glycPre: 1.9 },
    ];
    render(<Harness onSave={vi.fn()} journal={journal} />);
    fireEvent.change(screen.getByPlaceholderText('1.10'), { target: { value: '1.30' } });
    expect(screen.getByText(/g\/L\/h/)).toBeTruthy();
  });
});
