// v4/src/components/BottomNav3.jsx
const TABS = [
  { key: 'accueil', icon: '🏠', labelKey: 'cl_accueil', fallback: 'Accueil' },
  { key: 'journal', icon: '📋', labelKey: 'cl_journal', fallback: 'Journal' },
  { key: 'reglages', icon: '⚙️', labelKey: 'cl_reglages', fallback: 'Réglages' },
];

export default function BottomNav3({ tab, setTab, t }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around bg-gray-900/95 backdrop-blur border-t border-white/10 py-2 z-50 max-w-[28rem] mx-auto">
      {TABS.map(({ key, icon, labelKey, fallback }) => (
        <button key={key} onClick={() => setTab(key)}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors
            ${tab === key ? 'text-blue-400' : 'text-white/50'}`}>
          <span className="text-xl">{icon}</span>
          <span>{t(labelKey) || fallback}</span>
        </button>
      ))}
    </nav>
  );
}
