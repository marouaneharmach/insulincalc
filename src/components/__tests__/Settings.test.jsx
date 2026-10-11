/** @vitest-environment jsdom */
import { useState } from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Settings from '../Settings';
import fr from '../../i18n/fr';
import { DEFAULT_RAPID_PROFILE } from '../../domain/insulin/profiles';

const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const t = (key, params) => {
  let msg = fr[key] ?? key;
  if (params) Object.entries(params).forEach(([k, v]) => { msg = msg.replace(`{${k}}`, String(v)); });
  return msg;
};

function Harness(overrides = {}) {
  const [state, setState] = useState({
    ratio: 15, isf: 60, targetGMin: 1.0, targetGMax: 1.2, patientName: 'Test', weight: '70', height: '175', age: '40', sex: 'M',
    notifEnabled: false, theme: 'system', locale: 'fr', timeProfiles: [], insulinBasal: 'Tresiba', insulinRapid: 'NovoRapid', insulinProfileId: null,
    basalDose: 12, basalReminderTime: null, postKeto: false, slowDigestion: false, dia: 4.5, maxDoseU: null,
    nightModeEnabled: true, nightStart: 21, nightEnd: 6, nightCorrectionMin: 1.8, fastingEnabled: false, fastingSuhoorReductionPct: 25, fastingBasalReductionPct: 20, groqApiKey: '',
  });
  const setter = (key) => (v) => setState((s) => ({ ...s, [key]: typeof v === 'function' ? v(s[key]) : v }));
  const setters = Object.fromEntries(Object.keys(state).map((k) => [`set${k.charAt(0).toUpperCase()}${k.slice(1)}`, setter(k)]));
  return (
    <Settings
      {...state} {...setters} targetGMid={1.1} imc={22.9}
      isDark={false} toggleTheme={() => {}} journal={[]} onImportJournal={vi.fn()} onImportProfile={vi.fn()} storageMode="indexeddb"
      insulinProfile={DEFAULT_RAPID_PROFILE} diagnostics={{ version: '7.0.0', buildId: 'test', cacheNames: [] }} updateAvailable={false} releaseNotes={[]}
      onCheckForUpdates={vi.fn()} onApplyUpdate={vi.fn()} t={t} colors={{ muted: '#64748B' }} {...overrides}
    />
  );
}

afterEach(cleanup);

describe('Settings', () => {
  it('affiche les sections et bascule le mode nuit', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: rx(fr.secuTitre) }));
    const nightSwitch = screen.getByRole('switch', { name: rx(fr.modeNuitTitre) });
    expect(nightSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(nightSwitch);
    expect(screen.getByRole('switch', { name: rx(fr.modeNuitTitre) }).getAttribute('aria-checked')).toBe('false');
  });

  it('plafond de dose et profil insuline', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: rx(fr.secuTitre) }));
    const max = screen.getByLabelText(rx(fr.plafondDose));
    fireEvent.change(max, { target: { value: '12' } });
    expect(max.value).toBe('12');
    fireEvent.click(screen.getByRole('button', { name: rx(fr.profilMedical) }));
    const select = screen.getByLabelText(rx(fr.profilInsuline));
    fireEvent.change(select, { target: { value: 'fiasp' } });
    expect(select.value).toBe('fiasp');
  });

  it('mode Ramadan : risque et plan', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: rx(fr.ramadanTitre) }));
    expect(screen.getByText(rx(fr.RAMADAN_RISK_high))).toBeTruthy();
    fireEvent.click(screen.getByLabelText(rx(fr.RAMADAN_REASON_SEVERE_HYPO)));
    expect(screen.getByText(rx(fr['RAMADAN_RISK_very-high']))).toBeTruthy();
    expect(screen.getByText(/9\.5 U/)).toBeTruthy();
  });

  it('clé API saisie localement', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: rx(fr.sauvegardeRestauration) }));
    const key = screen.getByLabelText(rx(fr.cleApiGroq.split(' ')[0]));
    fireEvent.change(key, { target: { value: ' gsk_test ' } });
    expect(key.value).toBe('gsk_test');
    expect(key.getAttribute('type')).toBe('password');
  });
});
