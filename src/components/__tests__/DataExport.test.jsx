/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DataExport from '../DataExport';
import { SCHEMA_VERSION } from '../../data/schema';

const DICT = {
  sauvegardeRestauration: 'Sauvegarde & Restauration',
  exporter: 'Exporter',
  importer: 'Importer',
  importReussi: 'Import réussi',
  importFormatInvalide: 'Format de fichier invalide.',
  importCorrompu: 'Fichier corrompu : {error}',
};

const t = (key, params) => {
  let msg = DICT[key] || key;
  if (params) Object.entries(params).forEach(([k, v]) => { msg = msg.replace(`{${k}}`, v); });
  return msg;
};

const blobText = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

const makeFile = (content) => new File([content], 'b.json', { type: 'application/json' });

describe('DataExport', () => {
  let capturedBlob;

  beforeEach(() => {
    localStorage.clear();
    capturedBlob = null;
    URL.createObjectURL = vi.fn((blob) => {
      capturedBlob = blob;
      return 'blob:mock';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('exporte un fichier JSON complet sans la clé API', async () => {
    localStorage.setItem('insulincalc_v4_patientName', JSON.stringify('Jane'));
    localStorage.setItem('insulincalc_v4_ratio', JSON.stringify(12));
    localStorage.setItem('insulincalc_v4_custom_foods', JSON.stringify([{ id: 'f1', name: 'Msemen', carbs: 40 }]));
    localStorage.setItem('insulincalc_v4_groqApiKey', JSON.stringify('gsk_secret'));
    localStorage.setItem('insulincalc_v7_reminders', JSON.stringify([{ id: 'rem_1', kind: 'basal' }]));

    const journal = [{ id: 'e1', date: '2026-10-11T08:00:00+01:00', glycPre: 1.2, source: 'manual' }];
    render(<DataExport journal={journal} t={t} isDark={false} locale="fr" />);

    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(capturedBlob.type).toBe('application/json');

    const data = JSON.parse(await blobText(capturedBlob));
    expect(data.app).toBe('InsulinCalc');
    expect(typeof data.version).toBe('string');
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(new Date(data.exportDate).getTime()).not.toBeNaN();
    expect(data.profile.patientName).toBe('Jane');
    expect(data.profile.ratio).toBe(12);
    expect(data.profile.customFoods).toEqual([{ id: 'f1', name: 'Msemen', carbs: 40 }]);
    expect(data.profile).not.toHaveProperty('groqApiKey');
    expect(JSON.stringify(data)).not.toContain('gsk_secret');
    expect(data.journal).toEqual(journal);
    expect(data.reminders).toEqual([{ id: 'rem_1', kind: 'basal' }]);
  });

  it('importe une sauvegarde valide : entrées migrées et profil transmis au parent', async () => {
    const onImportJournal = vi.fn();
    const onImportProfile = vi.fn();
    const backup = {
      version: '4.3.0',
      exportDate: '2026-10-01T10:00:00.000Z',
      profile: { patientName: 'Jane', custom_foods: [{ id: 'f1' }], groqApiKey: 'gsk_secret' },
      journal: [
        { id: 1760000000000, date: '2026-10-01T08:00:00.000Z', preMealGlycemia: '1,35', totalCarbs: '45', doseInjected: 4 },
        { id: 'bad', date: 'not a date' },
      ],
    };

    render(<DataExport journal={[]} onImportJournal={onImportJournal} onImportProfile={onImportProfile} t={t} isDark={false} locale="fr" />);

    const input = screen.getByLabelText('Importer');
    expect(input).toHaveProperty('accept', '.json,application/json');
    fireEvent.change(input, { target: { files: [makeFile(JSON.stringify(backup))] } });

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Import réussi');
    expect(status.textContent).toContain('2 réglages');
    expect(status.textContent).toContain('2 entrées');
    expect(status.textContent).toContain('0 rejetées');

    expect(onImportJournal).toHaveBeenCalledTimes(1);
    const entries = onImportJournal.mock.calls[0][0];
    expect(entries).toHaveLength(2);
    const [migrated, repaired] = entries;
    expect(migrated.id).toBe('1760000000000');
    expect(migrated.glycPre).toBe(1.35);
    expect(migrated.totalGlucides).toBe(45);
    expect(migrated.doseReelle).toBe(4);
    expect(migrated.doseActual).toBe(4);
    expect(migrated.source).toBe('manual');
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(new Date(repaired.date).getTime()).not.toBeNaN();

    expect(onImportProfile).toHaveBeenCalledTimes(1);
    expect(onImportProfile).toHaveBeenCalledWith({ patientName: 'Jane', customFoods: [{ id: 'f1' }] });
    expect(localStorage.getItem('insulincalc_v4_patientName')).toBeNull();
  });

  it('signale un fichier illisible (JSON invalide)', async () => {
    const onImportJournal = vi.fn();
    render(<DataExport journal={[]} onImportJournal={onImportJournal} t={t} isDark />);

    fireEvent.change(screen.getByLabelText('Importer'), { target: { files: [makeFile('{not json')] } });

    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/^Fichier corrompu : .+/);
    expect(onImportJournal).not.toHaveBeenCalled();
  });

  it('signale un JSON valide qui n’est pas une sauvegarde', async () => {
    const onImportJournal = vi.fn();
    render(<DataExport journal={[]} onImportJournal={onImportJournal} t={t} isDark={false} />);

    fireEvent.change(screen.getByLabelText('Importer'), { target: { files: [makeFile(JSON.stringify({ foo: 'bar' }))] } });

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Format de fichier invalide.');
    expect(onImportJournal).not.toHaveBeenCalled();
  });
});
