// v4/src/components/BottomNav3.jsx
const TABS = [
  { key: 'accueil', icon: '🏠', labelKey: 'cl_accueil', fallback: 'Accueil' },
  { key: 'journal', icon: '📋', labelKey: 'cl_journal', fallback: 'Journal' },
  { key: 'rapports', icon: '📈', labelKey: 'tabRapports', fallback: 'Rapports' },
  { key: 'reglages', icon: '⚙️', labelKey: 'cl_reglages', fallback: 'Réglages' },
];

/** Traduction avec repli : `t` renvoie la clé elle-même lorsqu'elle est absente. */
function tr(t, key, fallback) {
  const value = t?.(key);
  return value && value !== key ? value : fallback;
}

export default function BottomNav3({ tab, setTab, t }) {
  return (
    <nav
      aria-label={tr(t, 'navigationPrincipale', 'Navigation principale')}
      className="fixed bottom-0 left-0 right-0 z-50 max-w-[28rem] mx-auto bg-gray-900/95 backdrop-blur border-t border-white/10"
    >
      <ul className="flex justify-around py-2">
        {TABS.map(({ key, icon, labelKey, fallback }) => {
          const active = tab === key;
          return (
            <li key={key} className="flex-1 flex justify-center">
              <button
                type="button"
                onClick={() => setTab(key)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-16 rounded-lg text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  active ? 'text-blue-400 font-semibold' : 'text-white/60 hover:text-white/80'
                }`}
              >
                <span className="text-xl" aria-hidden="true">{icon}</span>
                <span>{t(labelKey) || fallback}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
