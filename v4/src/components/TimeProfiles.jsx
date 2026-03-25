import { useState } from 'react';

const DEFAULT_PROFILES = [
  { id: 'matin', label: '🌅 Matin', hours: '6h-11h', ratio: null, isf: null },
  { id: 'midi', label: '☀️ Midi', hours: '11h-16h', ratio: null, isf: null },
  { id: 'soir', label: '🌙 Soir', hours: '16h-22h', ratio: null, isf: null },
  { id: 'nuit', label: '🌑 Nuit', hours: '22h-6h', ratio: null, isf: null },
];

export function getActiveProfile(timeProfiles, globalRatio, globalIsf) {
  if (!timeProfiles || timeProfiles.every(p => !p.ratio && !p.isf)) {
    return { ratio: globalRatio, isf: globalIsf, slot: null };
  }
  const h = new Date().getHours();
  let slotId;
  if (h >= 6 && h < 11) slotId = 'matin';
  else if (h >= 11 && h < 16) slotId = 'midi';
  else if (h >= 16 && h < 22) slotId = 'soir';
  else slotId = 'nuit';

  const profile = timeProfiles.find(p => p.id === slotId);
  return {
    ratio: profile?.ratio || globalRatio,
    isf: profile?.isf || globalIsf,
    slot: slotId,
    label: profile?.label || '',
  };
}

export default function TimeProfiles({ timeProfiles, setTimeProfiles, globalRatio, globalIsf, isDark, t }) {
  const [enabled, setEnabled] = useState(timeProfiles?.some(p => p.ratio || p.isf) || false);

  const profiles = timeProfiles?.length === 4 ? timeProfiles : DEFAULT_PROFILES;

  const handleToggle = () => {
    if (enabled) {
      setTimeProfiles(DEFAULT_PROFILES);
      setEnabled(false);
    } else {
      // Initialize with global values
      setTimeProfiles(profiles.map(p => ({ ...p, ratio: globalRatio, isf: globalIsf })));
      setEnabled(true);
    }
  };

  const updateProfile = (id, field, value) => {
    setTimeProfiles(profiles.map(p => p.id === id ? { ...p, [field]: Number(value) } : p));
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const inputClass = `w-16 text-center text-sm font-bold p-1.5 rounded-xl border outline-none transition ${isDark ? 'bg-slate-700 border-slate-600 text-white focus:border-teal-500' : 'bg-gray-50 border-gray-200 focus:border-teal-400'}`;

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            🕐 Profils horaires insuline
          </p>
          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Ajuster vos ratios selon le moment de la journée
          </p>
        </div>
        <button onClick={handleToggle}
          className={`w-12 h-7 rounded-full transition relative ${enabled ? 'bg-teal-500' : isDark ? 'bg-slate-600' : 'bg-gray-300'}`}>
          <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-all ${enabled ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      {enabled && (
        <div className="space-y-2 mt-3">
          <div className="grid grid-cols-4 gap-1 mb-1">
            <span className="text-[9px] text-gray-400 uppercase"></span>
            <span className="text-[9px] text-gray-400 uppercase text-center">Créneau</span>
            <span className="text-[9px] text-gray-400 uppercase text-center">Ratio (1U/Xg)</span>
            <span className="text-[9px] text-gray-400 uppercase text-center">Correction (mg/dL)</span>
          </div>
          {profiles.map(p => (
            <div key={p.id} className={`grid grid-cols-4 gap-1 items-center p-1.5 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
              <span className="text-sm">{p.label.split(' ')[0]}</span>
              <span className={`text-[10px] text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.hours}</span>
              <input type="number" min={1} max={50} value={p.ratio || globalRatio}
                onChange={e => updateProfile(p.id, 'ratio', e.target.value)}
                className={inputClass} />
              <input type="number" min={5} max={200} step={5} value={p.isf || globalIsf}
                onChange={e => updateProfile(p.id, 'isf', e.target.value)}
                className={inputClass} />
            </div>
          ))}
          <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            💡 Valeur vide = utilise le ratio/ISF global ({globalRatio}g / {globalIsf} mg/dL)
          </p>
        </div>
      )}
    </div>
  );
}
