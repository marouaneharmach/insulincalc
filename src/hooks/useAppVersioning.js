import { useCallback, useEffect, useState } from 'react';
import { APP_VERSION, RELEASE_NOTES } from '../version';
import {
  CURRENT_RELEASE,
  collectDiagnostics,
  fetchRemoteVersion,
  forceRefreshApplication,
  getLastSeenVersion,
  markUpdateCheck,
  markVersionSeen,
  registerVersionedServiceWorker,
} from '../utils/updateManager';

export function useAppVersioning() {
  const initialLastSeenVersion = getLastSeenVersion();
  const [registration, setRegistration] = useState(null);
  const [remoteVersion, setRemoteVersion] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [diagnostics, setDiagnostics] = useState({
    ...CURRENT_RELEASE,
    remoteVersion: null,
    updateAvailable: false,
    lastSeenVersion: initialLastSeenVersion,
    lastUpdateCheck: null,
    serviceWorkerState: 'idle',
    cacheNames: [],
  });
  const [showWhatsNew, setShowWhatsNew] = useState(() =>
    Boolean(initialLastSeenVersion && initialLastSeenVersion !== APP_VERSION),
  );

  const refreshDiagnostics = useCallback(async (nextRegistration = null, nextRemoteVersion = null) => {
    const snapshot = await collectDiagnostics(nextRegistration, nextRemoteVersion);
    setDiagnostics(snapshot);
    setUpdateAvailable(snapshot.updateAvailable);
  }, []);

  const checkForUpdates = useCallback(async (targetRegistration = registration) => {
    const checkedAt = markUpdateCheck();
    let nextRemoteVersion = null;

    try {
      nextRemoteVersion = await fetchRemoteVersion();
      setRemoteVersion(nextRemoteVersion);
    } catch (error) {
      console.warn('[InsulinCalc] Version check failed:', error);
    }

    await targetRegistration?.update?.().catch((error) => {
      console.warn('[InsulinCalc] Service Worker update failed:', error);
    });

    const snapshot = await collectDiagnostics(targetRegistration, nextRemoteVersion);
    snapshot.lastUpdateCheck = checkedAt;
    setDiagnostics(snapshot);
    setUpdateAvailable(snapshot.updateAvailable);
    return snapshot;
  }, [registration]);

  const applyUpdate = useCallback(async () => {
    await forceRefreshApplication(registration);
  }, [registration]);

  const dismissWhatsNew = useCallback(() => {
    markVersionSeen(APP_VERSION);
    setShowWhatsNew(false);
    setDiagnostics((prev) => ({ ...prev, lastSeenVersion: APP_VERSION }));
  }, []);

  useEffect(() => {
    if (!initialLastSeenVersion) {
      markVersionSeen(APP_VERSION);
    }
  }, [initialLastSeenVersion]);

  useEffect(() => {
    let alive = true;

    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
      collectDiagnostics(null, null).then((snapshot) => {
        if (!alive) return;
        setDiagnostics(snapshot);
        setUpdateAvailable(snapshot.updateAvailable);
      });
      return () => {
        alive = false;
      };
    }

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    registerVersionedServiceWorker()
      .then((nextRegistration) => {
        if (!alive) return;
        setRegistration(nextRegistration);
        const watchInstallingWorker = (worker) => {
          if (!worker) return;
          worker.addEventListener('statechange', async () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              await refreshDiagnostics(nextRegistration, null);
            }
          });
        };

        watchInstallingWorker(nextRegistration.installing);
        nextRegistration.addEventListener('updatefound', () => {
          watchInstallingWorker(nextRegistration.installing);
        });

        refreshDiagnostics(nextRegistration, null);
        checkForUpdates(nextRegistration);
      })
      .catch((error) => {
        console.warn('[InsulinCalc] Service Worker registration failed:', error);
      });

    return () => {
      alive = false;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [checkForUpdates, refreshDiagnostics]);

  return {
    diagnostics,
    releaseNotes: RELEASE_NOTES[APP_VERSION] || [],
    updateAvailable,
    remoteVersion,
    showWhatsNew,
    checkForUpdates,
    applyUpdate,
    dismissWhatsNew,
  };
}
