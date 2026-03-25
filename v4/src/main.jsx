import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// ─── VERSION MANAGEMENT & CACHE BUSTING ──────────────────────────────────────
const APP_VERSION = '4.3.0';
const VERSION_KEY = 'insulincalc_v4_app_version';

function handleVersionMigration() {
  const storedVersion = localStorage.getItem(VERSION_KEY);

  if (storedVersion !== APP_VERSION) {
    console.log(`[InsulinCalc] Mise à jour ${storedVersion || 'initial'} → ${APP_VERSION}`);

    // Journal migration: add new fields to existing entries if needed
    try {
      const journalStr = localStorage.getItem('insulincalc_v4_journal');
      if (journalStr) {
        const journal = JSON.parse(journalStr);
        const migrated = journal.map(entry => ({
          ...entry,
          injectionType: entry.injectionType || (entry.mealType === 'injection' ? 'manual' : undefined),
          correctionDetails: entry.correctionDetails || undefined,
        }));
        localStorage.setItem('insulincalc_v4_journal', JSON.stringify(migrated));
      }
    } catch (e) {
      console.warn('[InsulinCalc] Journal migration error:', e);
    }

    // Update stored version
    localStorage.setItem(VERSION_KEY, APP_VERSION);

    // Force clear service worker caches for update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
          console.log('[InsulinCalc] Service Worker désinscrit pour mise à jour');
        });
      });
    }

    // Clear all browser caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
          console.log(`[InsulinCalc] Cache "${name}" supprimé`);
        });
      });
    }

    console.log('[InsulinCalc] Migration v' + APP_VERSION + ' terminée. Données utilisateur préservées.');
  }
}

// Run migration before rendering
handleVersionMigration();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
