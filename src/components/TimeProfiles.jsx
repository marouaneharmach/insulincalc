import { useId, useState } from 'react';
import Switch from './ui/Switch';

const DEFAULT_PROFILES = [
  { id: 'matin', label: '🌅 Matin', hours: '6h-11h', ratio: null, isf: null },
  { id: 'midi', label: '☀️ Midi', hours: '11h-16h', ratio: null, isf: null },
  { id: 'soir', label: '🌙 Soir', hours: '16h-22h', ratio: null, isf: null },
  { id: 'nuit', label: '🌑 Nuit', hours: '22h-6h', ratio: null, isf: null },
];

const noTranslate = () => undefined;

/** Traduction avec repli : `t` renvoie la clé elle-même lorsqu'elle est absente. */
function tr(t, key, fallback, params) {
  const value = t?.(key, params);
  return value && value !== key ? value : fallback;
}

export default function TimeProfiles({ timeProfiles, setTimeProfiles, globalRatio, globalIsf, isDark, t = noTranslate }) {
  const [enabled, setEnabled] = useState(timeProfiles?.some(p => p.ratio || p.isf) || false);
  const baseId = useId();

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

  // Libellé du créneau : traduction (matin/midi/soir/nuit) sinon texte stocké sans l'emoji.
  const slotEmoji = (p) => p.label.split(' ')[0];
  const slotName = (p) => t(p.id) || p.label.split(' ').slice(1).join(' ');

  const ratioHeader = t('ratioICR') || 'Ratio (1U/Xg)';
  const isfHeader = t('isfCorrection') || 'Correction (mg/dL)';
  const hintText = tr(
    t,
    'profilsValeurGlobale',
    `Valeur vide = utilise le ratio/ISF global (${globalRatio} g / ${globalIsf} mg/dL)`,
    { ratio: globalRatio, isf: globalIsf },
  );

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const inputClass = `w-16 text-center text-sm font-bold p-1.5 rounded-xl border outline-none transition focus-visible:ring-2 focus-visible:ring-teal-500 ${isDark ? 'bg-slate-700 border-slate-600 text-white focus:border-teal-500' : 'bg-gray-50 border-gray-200 text-slate-800 focus:border-teal-400'}`;
  const headClass = `text-xs uppercase font-semibold ${isDark ? 'text-slate-400' : 'text-gray-500'}`;
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const cellBg = isDark ? 'bg-slate-700/50' : 'bg-gray-50';

  return (
    <div className={cardClass}>
      <Switch
        id={`${baseId}-switch`}
        checked={enabled}
        onChange={handleToggle}
        isDark={isDark}
        label={`🕐 ${t('profilsHoraires') || 'Profils horaires insuline'}`}
        description={t('profilsHorairesDesc') || 'Ajuster vos ratios selon le moment de la journée'}
      />

      {enabled && (
        <div className="space-y-2 mt-3">
          <table className="w-full border-separate border-spacing-y-1">
            <thead>
              <tr>
                <th scope="col" className={`${headClass} text-left px-1.5`}>{t('creneau') || 'Créneau'}</th>
                <th scope="col" className={`${headClass} text-center`}>{ratioHeader}</th>
                <th scope="col" className={`${headClass} text-center`}>{isfHeader}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => {
                const name = slotName(p);
                return (
                  <tr key={p.id}>
                    <th scope="row" className={`${cellBg} text-left font-normal px-1.5 py-1.5 rounded-l-xl`}>
                      <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        <span aria-hidden="true">{slotEmoji(p)} </span>{name}
                      </span>
                      <span className={`block text-xs ${mutedClass}`}>{p.hours}</span>
                    </th>
                    <td className={`${cellBg} text-center py-1.5`}>
                      <input
                        id={`${baseId}-${p.id}-ratio`}
                        type="number" min={1} max={50}
                        inputMode="numeric"
                        aria-label={`${ratioHeader} — ${name}`}
                        value={p.ratio || globalRatio}
                        onChange={e => updateProfile(p.id, 'ratio', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className={`${cellBg} text-center py-1.5 rounded-r-xl`}>
                      <input
                        id={`${baseId}-${p.id}-isf`}
                        type="number" min={5} max={200} step={5}
                        inputMode="numeric"
                        aria-label={`${isfHeader} — ${name}`}
                        value={p.isf || globalIsf}
                        onChange={e => updateProfile(p.id, 'isf', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className={`text-xs ${mutedClass}`}>
            💡 {hintText}
          </p>
        </div>
      )}
    </div>
  );
}
