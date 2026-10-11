/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import VersionPanel from '../VersionPanel';
import { formatDateTime } from '../../domain/time';

// Le formatage réel dépend du fuseau de la machine : on le rend déterministe.
vi.mock('../../domain/time', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    formatDateTime: vi.fn((d) => (
      new Date(d).toISOString() === '2026-04-11T10:00:00.000Z'
        ? '11/04/2026 11:00'
        : '11/04/2026 12:00'
    )),
  };
});

const dict = {
  diagnosticTitre: 'Diagnostic',
  diagnosticSousTitre: 'Version, build, cache et disponibilité d’une mise à jour',
  miseAJourDisponible: 'Nouvelle version disponible',
  versionActuelle: 'Version actuelle',
  versionInstallee: 'Version installée',
  buildId: 'Build ID',
  dateBuild: 'Date du build',
  serviceWorkerEtat: 'État du service worker',
  versionDisponible: 'Version disponible',
  buildDisponible: 'Build distant',
  cachesActifs: 'Caches actifs',
  derniereVerification: 'Dernière vérification',
  verifierMisesAJour: 'Vérifier les mises à jour',
  forcerMiseAJour: 'Forcer la mise à jour',
  quoiDeNeuf: 'Quoi de neuf',
  aucuneNouvelle: 'Aucune note de version disponible.',
};

const t = (key, params) => {
  const text = dict[key] || key;
  if (!params) return text;
  return Object.entries(params).reduce((acc, [paramKey, value]) => acc.replace(`{${paramKey}}`, value), text);
};

const diagnostics = {
  version: '6.0.1',
  buildId: 'abc1234',
  buildDate: '2026-04-11T10:00:00.000Z',
  remoteVersion: { version: '6.0.2', buildId: 'def5678' },
  lastUpdateCheck: '2026-04-11T11:00:00.000Z',
  serviceWorkerState: 'waiting',
  cacheNames: ['insulincalc-app-abc1234'],
};

describe('VersionPanel', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('rend le panneau de diagnostic sans régression visuelle', () => {
    const { container } = render(
      <VersionPanel
        diagnostics={diagnostics}
        updateAvailable
        releaseNotes={[
          'Suivi explicite de la version installée et du build.',
          'Détection d’une version distante plus récente.',
        ]}
        isDark={false}
        t={t}
        onCheckForUpdates={() => {}}
        onApplyUpdate={() => {}}
      />,
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it('formate les dates avec la locale fournie (fr par défaut)', () => {
    const { rerender } = render(
      <VersionPanel diagnostics={diagnostics} updateAvailable={false} releaseNotes={[]} isDark t={t}
        onCheckForUpdates={() => {}} onApplyUpdate={() => {}} />,
    );
    expect(formatDateTime).toHaveBeenCalledWith(expect.any(Date), 'fr');

    rerender(
      <VersionPanel diagnostics={diagnostics} updateAvailable={false} releaseNotes={[]} isDark t={t} locale="ar"
        onCheckForUpdates={() => {}} onApplyUpdate={() => {}} />,
    );
    expect(formatDateTime).toHaveBeenCalledWith(expect.any(Date), 'ar');
  });

  it('affiche le statut à jour, « Jamais » sans vérification et la note par défaut', () => {
    render(
      <VersionPanel
        diagnostics={{ ...diagnostics, lastUpdateCheck: null }}
        updateAvailable={false}
        releaseNotes={[]}
        isDark={false}
        t={t}
        onCheckForUpdates={() => {}}
        onApplyUpdate={() => {}}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('Version actuelle');
    expect(screen.getByText('Jamais')).toBeTruthy();
    expect(screen.getByText('Aucune note de version disponible.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vérifier les mises à jour' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Forcer la mise à jour' })).toBeTruthy();
  });
});
