/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LAST_SEEN_VERSION_KEY,
  LAST_UPDATE_CHECK_KEY,
  buildVersionUrl,
  compareSemver,
  getLastSeenVersion,
  getLastUpdateCheck,
  isRemoteVersionNewer,
  markUpdateCheck,
  markVersionSeen,
} from '../updateManager';

describe('updateManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('compare les versions semver', () => {
    expect(compareSemver('6.0.1', '6.0.0')).toBe(1);
    expect(compareSemver('6.0.0', '6.0.0')).toBe(0);
    expect(compareSemver('6.0.0', '6.1.0')).toBe(-1);
  });

  it('détecte un build distant plus récent à version égale', () => {
    expect(
      isRemoteVersionNewer(
        { version: '6.0.1', buildId: 'abcdef1' },
        { version: '6.0.1', buildId: '1234567' },
      ),
    ).toBe(true);
  });

  it('ne signale pas de mise à jour si la version distante est plus ancienne', () => {
    expect(
      isRemoteVersionNewer(
        { version: '5.9.9', buildId: 'abcdef1' },
        { version: '6.0.1', buildId: '1234567' },
      ),
    ).toBe(false);
  });

  it('mémorise la version vue et la date de vérification', () => {
    markVersionSeen('6.0.1');
    expect(localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('6.0.1');
    expect(getLastSeenVersion()).toBe('6.0.1');

    markUpdateCheck('2026-04-11T12:30:00.000Z');
    expect(localStorage.getItem(LAST_UPDATE_CHECK_KEY)).toBe('2026-04-11T12:30:00.000Z');
    expect(getLastUpdateCheck()).toBe('2026-04-11T12:30:00.000Z');
  });

  it('construit une URL de version relative au base path courant', () => {
    vi.stubGlobal('window', {
      location: { href: 'https://example.test/insulincalc/' },
    });

    expect(buildVersionUrl('./')).toBe('https://example.test/insulincalc/version.json');
  });
});
