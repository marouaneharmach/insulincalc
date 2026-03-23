import { useState } from 'react';

export default function QuickAddSheet({ type, onClose, setTab, setGlycemia, journal, setJournal, t, colors, isDark }) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (!value) return;
    
    if (type === 'glycemia') {
      setGlycemia(value);
      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        glycPre: parseFloat(value).toFixed(2),
        glycPost: '',
        totalCarbs: 0,
        doseSuggested: 0,
        doseActual: 0,
        aliments: '',
        alimentIds: [],
        mealType: 'mesure',
      };
      setJournal(prev => [entry, ...prev].slice(0, 200));
    } else if (type === 'insulin') {
      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        glycPre: '',
        glycPost: '',
        totalCarbs: 0,
        doseSuggested: 0,
        doseActual: parseFloat(value),
        aliments: '',
        alimentIds: [],
        mealType: 'injection',
      };
      setJournal(prev => [entry, ...prev].slice(0, 200));
    }
    
    onClose();
  };

  const configs = {
    glycemia: { title: '🩸 ' + t('ajouterGlycemie'), placeholder: '1.20', unit: 'g/L', step: '0.01', min: '0.3', max: '6.0', color: 'pink' },
    insulin: { title: '💉 ' + t('ajouterInsuline'), placeholder: '4.0', unit: 'U', step: '0.5', min: '0.5', max: '50', color: 'blue' },
    activity: { title: '🏃 ' + t('ajouterActivite'), placeholder: '30', unit: 'min', step: '5', min: '5', max: '300', color: 'amber' },
  };

  const config = configs[type] || configs.glycemia;
  const colorMap = { pink: 'bg-pink-500', blue: 'bg-blue-500', amber: 'bg-amber-500' };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-lg rounded-t-3xl p-4 pb-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
        <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>{config.title}</h3>

        <div className="flex items-center gap-3 mb-4">
          <input
            type="number"
            step={config.step}
            min={config.min}
            max={config.max}
            placeholder={config.placeholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            className={`flex-1 text-2xl font-bold text-center p-3 rounded-2xl border-2 outline-none transition ${
              isDark 
                ? 'bg-slate-700 border-slate-600 text-white focus:border-teal-500' 
                : 'bg-gray-50 border-gray-200 text-slate-800 focus:border-teal-500'
            }`}
          />
          <span className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{config.unit}</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 py-3 rounded-2xl font-medium text-sm ${
              isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {t('annuler')}
          </button>
          <button
            onClick={handleSubmit}
            className={`flex-1 py-3 rounded-2xl font-medium text-sm text-white ${colorMap[config.color]} hover:opacity-90 transition`}
          >
            {t('enregistrer')}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
