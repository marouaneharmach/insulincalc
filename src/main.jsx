import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { APP_VERSION } from './version';
import { needsMigration } from './data/migrations';

// Le journal est migré par useJournal (IndexedDB) ; ici on ne trace que la version installée.
const VERSION_KEY = 'insulincalc_v4_app_version';
try {
  const stored = localStorage.getItem(VERSION_KEY);
  if (stored !== APP_VERSION) {
    if (needsMigration(stored)) console.info(`[InsulinCalc] Mise à niveau ${stored || 'initiale'} → ${APP_VERSION}`);
    localStorage.setItem(VERSION_KEY, APP_VERSION);
  }
} catch {
  /* stockage indisponible */
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
