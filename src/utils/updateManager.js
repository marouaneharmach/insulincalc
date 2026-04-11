import { APP_VERSION, BUILD_ID, BUILD_DATE } from '../version';

export const LAST_SEEN_VERSION_KEY = 'insulincalc_v4_lastSeenVersion';
export const LAST_UPDATE_CHECK_KEY = 'insulincalc_v4_lastUpdateCheck';
export const CACHE_PREFIX = 'insulincalc-app-';

export const CURRENT_RELEASE = {
  version: APP_VERSION,
  buildId: BUILD_ID,
  buildDate: BUILD_DATE,
};

function toNumericParts(version) {
  return String(version || '0.0.0')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function compareSemver(left, right) {
  const a = toNumericParts(left);
  const b = toNumericParts(right);
  const max = Math.max(a.length, b.length);

  for (let index = 0; index < max; index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta !== 0) return Math.sign(delta);
  }

  return 0;
}

export function isRemoteVersionNewer(remote, local = CURRENT_RELEASE) {
  if (!remote?.version) return false;
  const semverCompare = compareSemver(remote.version, local.version);
  if (semverCompare > 0) return true;
  if (semverCompare < 0) return false;
  return Boolean(remote.buildId && local.buildId && remote.buildId !== local.buildId);
}

export function getLastSeenVersion() {
  return localStorage.getItem(LAST_SEEN_VERSION_KEY);
}

export function markVersionSeen(version = APP_VERSION) {
  localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
}

export function markUpdateCheck(dateIso = new Date().toISOString()) {
  localStorage.setItem(LAST_UPDATE_CHECK_KEY, dateIso);
  return dateIso;
}

export function getLastUpdateCheck() {
  return localStorage.getItem(LAST_UPDATE_CHECK_KEY);
}

export function buildVersionUrl(baseUrl = import.meta.env.BASE_URL || './') {
  return new URL(`${baseUrl}version.json`, window.location.href).toString();
}

export async function fetchRemoteVersion(baseUrl = import.meta.env.BASE_URL || './') {
  const response = await fetch(`${buildVersionUrl(baseUrl)}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' },
  });
  if (!response.ok) {
    throw new Error(`Version metadata unavailable (${response.status})`);
  }
  return response.json();
}

export async function registerVersionedServiceWorker(baseUrl = import.meta.env.BASE_URL || './') {
  if (!('serviceWorker' in navigator)) return null;
  const scope = baseUrl;
  const url = `${baseUrl}sw.js?v=${BUILD_ID}`;
  return navigator.serviceWorker.register(url, { scope });
}

export async function getAppCacheNames() {
  if (!('caches' in window)) return [];
  const names = await caches.keys();
  return names.filter((name) => name.startsWith(CACHE_PREFIX));
}

export async function clearOldAppCaches() {
  if (!('caches' in window)) return [];
  const names = await getAppCacheNames();
  await Promise.all(names.filter((name) => name !== `${CACHE_PREFIX}${BUILD_ID}`).map((name) => caches.delete(name)));
  return getAppCacheNames();
}

export async function collectDiagnostics(registration, remoteVersion = null) {
  const cacheNames = await getAppCacheNames();
  const swState = !('serviceWorker' in navigator)
    ? 'unsupported'
    : registration?.waiting
      ? 'waiting'
      : registration?.installing
        ? 'installing'
        : registration?.active
          ? 'active'
          : 'idle';

  return {
    ...CURRENT_RELEASE,
    remoteVersion,
    updateAvailable: isRemoteVersionNewer(remoteVersion),
    lastSeenVersion: getLastSeenVersion(),
    lastUpdateCheck: getLastUpdateCheck(),
    serviceWorkerState: swState,
    cacheNames,
  };
}

export function activateWaitingWorker(registration) {
  if (!registration?.waiting) return false;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

export async function forceRefreshApplication(registration) {
  await registration?.update?.();
  const activatedWaitingWorker = activateWaitingWorker(registration);
  if (!activatedWaitingWorker) {
    await clearOldAppCaches();
    window.location.reload();
  }
}
