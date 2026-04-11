/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import VersionPanel from '../VersionPanel';

describe('VersionPanel', () => {
  it('rend le panneau de diagnostic sans régression visuelle', () => {
    const { container } = render(
      <VersionPanel
        diagnostics={{
          version: '6.0.1',
          buildId: 'abc1234',
          buildDate: '2026-04-11T10:00:00.000Z',
          remoteVersion: { version: '6.0.2', buildId: 'def5678' },
          lastUpdateCheck: '2026-04-11T11:00:00.000Z',
          serviceWorkerState: 'waiting',
          cacheNames: ['insulincalc-app-abc1234'],
        }}
        updateAvailable
        releaseNotes={[
          'Suivi explicite de la version installée et du build.',
          'Détection d’une version distante plus récente.',
        ]}
        isDark={false}
        t={(key, params) => {
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
          const text = dict[key] || key;
          if (!params) return text;
          return Object.entries(params).reduce((acc, [paramKey, value]) => acc.replace(`{${paramKey}}`, value), text);
        }}
        onCheckForUpdates={() => {}}
        onApplyUpdate={() => {}}
      />,
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
