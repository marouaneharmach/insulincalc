/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsScreen from '../ReportsScreen';

/** Stub i18n : renvoie la clé, suivie des paramètres sérialisés s'il y en a. */
const t = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);

/** Journal synthétique : 3 repas par jour sur `daysBack` jours (hier inclus, pas aujourd'hui). */
function buildJournal(daysBack = 20) {
  const now = new Date();
  const meals = [
    { hour: 8, slot: 'petit-dejeuner', pre: 1.1, post: 1.6, carbs: 45 },
    { hour: 13, slot: 'dejeuner', pre: 1.3, post: 1.9, carbs: 70 },
    { hour: 20, slot: 'diner', pre: 1.0, post: 1.5, carbs: 60 },
  ];
  const journal = [];
  for (let d = 1; d <= daysBack; d += 1) {
    meals.forEach((m, i) => {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, m.hour, 0, 0, 0);
      const wobble = ((d * 7 + i * 3) % 5) * 0.05;
      journal.push({
        id: `m-${d}-${i}`,
        date: at.toISOString(),
        mealType: 'repas',
        mealSlot: m.slot,
        glycPre: Number((m.pre + wobble).toFixed(2)),
        glycPost: Number((m.post + wobble).toFixed(2)),
        totalGlucides: m.carbs,
        doseSuggeree: 5 + i,
        doseReelle: 5 + i,
        bolusType: 'unique',
        notes: i === 0 ? 'note; "test"' : '',
      });
    });
  }
  return journal;
}

function renderScreen(overrides = {}) {
  return render(
    <ReportsScreen
      journal={buildJournal()}
      targetGMin={1}
      targetGMax={1.4}
      ratio={10}
      isf={40}
      patientName="Patient Test"
      t={t}
      isDark={false}
      locale="fr"
      insulinRapid="NovoRapid"
      basalDose={12}
      {...overrides}
    />,
  );
}

function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('ReportsScreen', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    window.print = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the title, the period selector and metric tiles with percentages', () => {
    renderScreen();

    expect(screen.getByText('rapportsTitre')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'periode14' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'periode30' }).getAttribute('aria-pressed')).toBe('false');

    // Tuile TIR (le libellé apparaît aussi dans la légende de la barre TIR).
    expect(screen.getAllByText('tempsEnCibleLabel').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^\d+(,\d)? %$/).length).toBeGreaterThan(3);
    expect(screen.getAllByText(/objectif [≥<≤] \d+ %/).length).toBe(6);
    expect(screen.getAllByText(/^[✓✗] Objectif (non )?atteint$/).length).toBe(6);

    // Barre TIR accessible.
    expect(screen.getByRole('img', { name: /^tempsEnCibleLabel/ })).toBeTruthy();

    // Lectures et jours sur la fenêtre de 14 jours (13 ou 14 jours selon l'heure).
    expect(screen.getByText(/^lecturesEtJours \{"n":\d+,"days":1[34]\}$/)).toBeTruthy();
  });

  it('renders the AGP chart as an accessible SVG image', () => {
    renderScreen();
    const svg = screen.getByRole('img', { name: /^agpTitre/ });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 360 220');
    // Lectures capillaires à heures fixes : tranches isolées → marqueurs de médiane (cercles) ; des bandes (paths) apparaissent dès que des tranches voisines sont renseignées.
    expect(svg.querySelectorAll('path, circle').length).toBeGreaterThan(0);
    expect(screen.getByText(/^agpCouverture \{"pct":\d+\}$/)).toBeTruthy();
  });

  it('shows the not-enough-data message instead of the chart for a tiny journal', () => {
    renderScreen({ journal: buildJournal(2) });
    expect(screen.queryByRole('img', { name: /^agpTitre/ })).toBeNull();
    expect(screen.getByText('agpPasAssez')).toBeTruthy();
  });

  it('renders the patterns and suggestions sections', () => {
    renderScreen();
    expect(screen.getByText('patternsTitre')).toBeTruthy();
    expect(screen.getByText('suggestionsTitre')).toBeTruthy();
    expect(screen.getByText('suggestionsDisclaimer')).toBeTruthy();
    // Post-prandiales > cible + 0,30 sur la tranche de midi → créneau problématique détecté.
    expect(screen.getAllByText(/PATTERN_PROBLEM_SLOT/).length).toBeGreaterThan(0);
  });

  it('switches the period to 90 days and updates the readings summary and suggestions', () => {
    renderScreen();
    const btn90 = screen.getByRole('button', { name: 'periode90' });
    fireEvent.click(btn90);

    expect(btn90.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'periode14' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('lecturesEtJours {"n":120,"days":20}')).toBeTruthy();

    // 20 jours de bolus ≥ 14 → analyse du traitement disponible.
    expect(screen.getByText('tddMoyenne')).toBeTruthy();
    expect(screen.getByText('basaleEstimee')).toBeTruthy();
    expect(screen.getAllByText(/SUGGEST_RATIO_DECREASE .*"period":"midi"/).length).toBeGreaterThan(0);
  });

  it('exports a CSV of the journal within the period', async () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'periode90' }));
    fireEvent.click(screen.getByRole('button', { name: /exporterCsv/ }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toMatch(/^text\/csv/);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);

    const bytes = new Uint8Array(await readBlob(blob));
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8').decode(bytes);
    const lines = text.trim().split('\r\n');
    expect(lines[0]).toBe('date;heure;type;glycPre;glycPost;totalGlucides;doseSuggeree;doseReelle;bolusType;notes');
    expect(lines.length).toBe(61);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2};\d{2}:\d{2};meal;1,\d+;1,\d+;\d+;\d+;\d+;unique;/);
    expect(text).toContain('"note; ""test"""');
  });

  it('opens and closes the medical print overlay', () => {
    renderScreen();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /exporterRapport/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('rapportMedecin')).toBeTruthy();
    expect(within(dialog).getByText('Patient Test')).toBeTruthy();
    expect(within(dialog).getByText('disclaimerFull')).toBeTruthy();
    expect(within(dialog).getByRole('img', { name: /^agpTitre/ })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'imprimerExporter' }));
    expect(window.print).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog).getByRole('button', { name: 'fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the print overlay with the Escape key', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /exporterRapport/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
