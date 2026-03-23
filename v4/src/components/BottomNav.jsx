export default function BottomNav({ tab, setTab, t, colors, isDark, selections }) {
  const tabs = [
    { key: 'home', icon: '🏠', label: t('tabHome') },
    { key: 'repas', icon: '🍽', label: t('tabRepas'), badge: selections?.length || 0 },
    { key: 'timeline', icon: '📋', label: t('tabTimeline') },
    { key: 'settings', icon: '⚙️', label: t('tabParams') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className={`max-w-lg mx-auto px-4 pb-1`}>
        <div className={`flex items-center justify-around rounded-2xl px-2 py-1.5 shadow-lg border ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
        }`} style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
          {tabs.map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all relative ${
                tab === item.key
                  ? 'text-teal-600 bg-teal-50' + (isDark ? ' !text-teal-400 !bg-teal-900/30' : '')
                  : isDark ? 'text-slate-400' : 'text-gray-400'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-teal-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
