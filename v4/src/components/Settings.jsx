import { useState } from 'react';
import { DIGESTION_PROFILES } from '../data/constants';
import { requestNotificationPermission } from '../utils/notifications';
import { imcCategory } from '../utils/calculations';
import DataExport from './DataExport';
import TimeProfiles from './TimeProfiles';

export default function Settings({
  ratio, setRatio, isf, setIsf,
  targetGMin, setTargetGMin, targetGMax, setTargetGMax, targetGMid,
  digestion, setDigestion, maxDose, setMaxDose,
  patientName, setPatientName,
  weight, setWeight, height, setHeight, age, setAge, sex, setSex,
  imc,
  notifEnabled, setNotifEnabled,
  isDark, toggleTheme,
  locale, setLocale,
  timeProfiles, setTimeProfiles,
  journal,
  insulinBasal, setInsulinBasal,
  insulinRapid, setInsulinRapid,
  basalDose, setBasalDose,
  postKeto, setPostKeto,
  slowDigestion, setSlowDigestion,
  dia, setDia,
  t, colors
}) {
  const [section, setSection] = useState('profil');
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const labelClass = `text-[10px] uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`;
  const inputClass = `w-full p-2.5 rounded-xl border outline-none text-sm transition ${isDark ? 'bg-slate-700 border-slate-600 text-white focus:border-teal-500' : 'bg-gray-50 border-gray-200 focus:border-teal-400'}`;

  const sections = [
    { key: 'profil', icon: '👤', label: t('profil') },
    { key: 'medical', icon: '🩺', label: t('cl_insulineBasale') ? 'Profil médical' : 'Profil médical' },
    { key: 'insulin', icon: '💉', label: t('parametresManuels') },
    { key: 'notif', icon: '🔔', label: t('notifications') },
    { key: 'display', icon: '🎨', label: t('apparence') },
  ];

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') setNotifEnabled(true);
  };

  return (
    <div className="px-4 pt-2 space-y-2">
      <h1 className={`text-xl font-bold px-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>⚙️ {t('tabParams')}</h1>

      {/* Section tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              section === s.key
                ? 'bg-teal-500 text-white'
                : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-white text-slate-500 border border-gray-200'
            }`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* PROFIL */}
      {section === 'profil' && (
        <div className="space-y-2">
          <div className={cardClass}>
            <label className={labelClass}>{t('nomPatient')}</label>
            <input type="text" placeholder={t('nomPlaceholder')} value={patientName}
              onChange={e => setPatientName(e.target.value)} className={inputClass} />
          </div>
          <div className={cardClass}>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>{t('age')}</label>
                <input type="number" min="1" max="120" placeholder="30" value={age}
                  onChange={e => setAge(e.target.value)} className={`${inputClass} text-center`} />
              </div>
              <div>
                <label className={labelClass}>{t('taille')}</label>
                <input type="number" min="50" max="250" placeholder="170" value={height}
                  onChange={e => setHeight(e.target.value)} className={`${inputClass} text-center`} />
              </div>
              <div>
                <label className={labelClass}>{t('sexe')}</label>
                <div className="flex gap-1">
                  {['M', 'F'].map(s => (
                    <button key={s} onClick={() => setSex(s)}
                      className={`flex-1 p-3 rounded-xl border text-sm font-medium transition ${
                        sex === s
                          ? 'border-teal-400 bg-teal-50 text-teal-700' + (isDark ? ' !bg-teal-900/30 !text-teal-400' : '')
                          : isDark ? 'border-slate-600 bg-slate-700 text-slate-400' : 'border-gray-200 bg-gray-50 text-gray-500'
                      }`}>
                      {s === 'M' ? t('homme') : t('femme')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {imc && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className={`text-center p-2 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
                  <p className="text-[10px] uppercase text-gray-400">IMC</p>
                  <p className={`text-xl font-bold ${imc < 25 ? 'text-emerald-500' : imc < 30 ? 'text-amber-500' : 'text-red-500'}`}>{imc}</p>
                  <p className="text-[10px] text-gray-400">{imcCategory(imc)}</p>
                </div>
                <div className={`text-center p-2 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
                  <p className="text-[10px] uppercase text-gray-400">{t('poidsKg')}</p>
                  <input type="number" min="20" max="200" step="0.5" value={weight}
                    onChange={e => setWeight(e.target.value)}
                    className={`w-full text-lg font-bold text-center bg-transparent outline-none ${isDark ? 'text-white' : 'text-slate-700'}`} />
                  <p className="text-[10px] text-gray-400">kg</p>
                </div>
              </div>
            )}
          </div>
          {/* Digestion habituelle */}
          <div className={cardClass}>
            <label className={labelClass}>🍽 {t('digestionHabituelle') || 'Digestion habituelle'}</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(DIGESTION_PROFILES).map(([key, dp]) => (
                <button key={key} onClick={() => setDigestion(key)}
                  className={`p-2 rounded-xl text-center border transition ${
                    digestion === key
                      ? 'border-teal-400 bg-teal-50' + (isDark ? ' !bg-teal-900/30 !border-teal-600' : '')
                      : isDark ? 'border-slate-700 bg-slate-700/50' : 'border-gray-200 bg-gray-50'
                  }`}>
                  <span className="text-lg">{dp.icon}</span>
                  <p className={`text-[10px] font-medium mt-0.5 ${digestion === key ? 'text-teal-600' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>{dp.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PROFIL MÉDICAL */}
      {section === 'medical' && (
        <div className="space-y-2">
          <div className={cardClass}>
            <label className={labelClass}>💉 {t('cl_insulineBasale')}</label>
            <input type="text" placeholder="Tresiba, Lantus, Toujeo…" value={insulinBasal}
              onChange={e => setInsulinBasal(e.target.value)} className={inputClass} />
          </div>
          <div className={cardClass}>
            <label className={labelClass}>⚡ {t('cl_insulineRapide')}</label>
            <input type="text" placeholder="NovoRapid, Humalog, Apidra…" value={insulinRapid}
              onChange={e => setInsulinRapid(e.target.value)} className={inputClass} />
          </div>
          <div className={cardClass}>
            <label className={labelClass}>📊 {t('cl_doseBasale')} (U/jour)</label>
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={100} step={1} value={basalDose}
                onChange={e => setBasalDose(Number(e.target.value))}
                className="flex-1 accent-teal-500" />
              <span className={`text-sm font-bold min-w-[50px] text-center px-2 py-0.5 rounded-xl ${isDark ? 'bg-slate-700 text-teal-400' : 'bg-teal-50 text-teal-700'}`}>
                {basalDose}U
              </span>
            </div>
          </div>
          <div className={cardClass}>
            <label className={labelClass}>⏱ {t('cl_dureeAction')} (DIA)</label>
            <div className="flex items-center gap-3">
              <input type="range" min={2} max={8} step={0.5} value={dia}
                onChange={e => setDia(Number(e.target.value))}
                className="flex-1 accent-purple-500" />
              <span className={`text-sm font-bold min-w-[55px] text-center px-2 py-0.5 rounded-xl ${isDark ? 'bg-slate-700 text-purple-400' : 'bg-purple-50 text-purple-700'}`}>
                {dia}h
              </span>
            </div>
          </div>
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('cl_profilPostKeto')}</p>
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Régime cétogène antérieur</p>
              </div>
              <button onClick={() => setPostKeto(!postKeto)}
                className={`w-12 h-7 rounded-full transition relative ${postKeto ? 'bg-teal-500' : isDark ? 'bg-slate-600' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-all ${postKeto ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('cl_digestionLente')}</p>
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Digestion plus lente que la normale</p>
              </div>
              <button onClick={() => setSlowDigestion(!slowDigestion)}
                className={`w-12 h-7 rounded-full transition relative ${slowDigestion ? 'bg-teal-500' : isDark ? 'bg-slate-600' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-all ${slowDigestion ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSULIN PARAMS */}
      {section === 'insulin' && (
        <div className="space-y-2">
          <div className={cardClass}>
            <label className={labelClass}>{t('ratioInsulineGlucides')}</label>
            <div className="flex items-center gap-3">
              <input type="range" min={5} max={25} step={1} value={ratio}
                onChange={e => setRatio(Number(e.target.value))}
                className="flex-1 accent-teal-500" />
              <span className={`text-sm font-bold min-w-[70px] text-center px-2 py-0.5 rounded-xl ${isDark ? 'bg-slate-700 text-teal-400' : 'bg-teal-50 text-teal-700'}`}>
                1U/{ratio}g
              </span>
            </div>
          </div>
          <div className={cardClass}>
            <label className={labelClass}>{t('facteurCorrection')}</label>
            <div className="flex items-center gap-3">
              <input type="range" min={20} max={100} step={5} value={isf}
                onChange={e => setIsf(Number(e.target.value))}
                className="flex-1 accent-purple-500" />
              <span className={`text-sm font-bold min-w-[70px] text-center px-2 py-0.5 rounded-xl ${isDark ? 'bg-slate-700 text-purple-400' : 'bg-purple-50 text-purple-700'}`}>
                {isf} mg/dL
              </span>
            </div>
          </div>
          <div className={cardClass}>
            <label className={labelClass}>{t('glycemieCiblePlage')}</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p className={`text-[10px] text-center mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Min</p>
                <div className="flex items-center gap-2">
                  <input type="range" min={0.6} max={1.2} step={0.1} value={targetGMin}
                    onChange={e => { const v = Number(e.target.value); setTargetGMin(v); if (v >= targetGMax) setTargetGMax(Math.min(v + 0.2, 2.0)); }}
                    className="flex-1 accent-emerald-500" />
                  <span className="text-sm font-bold text-emerald-500 w-10 text-center">{targetGMin.toFixed(1)}</span>
                </div>
              </div>
              <div>
                <p className={`text-[10px] text-center mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Max</p>
                <div className="flex items-center gap-2">
                  <input type="range" min={1.0} max={2.0} step={0.1} value={targetGMax}
                    onChange={e => { const v = Number(e.target.value); setTargetGMax(v); if (v <= targetGMin) setTargetGMin(Math.max(v - 0.2, 0.6)); }}
                    className="flex-1 accent-emerald-500" />
                  <span className="text-sm font-bold text-emerald-500 w-10 text-center">{targetGMax.toFixed(1)}</span>
                </div>
              </div>
            </div>
            <div className={`text-center text-xs font-medium p-1.5 rounded-xl ${isDark ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              🎯 {targetGMin.toFixed(1)} — {targetGMax.toFixed(1)} g/L (correction → {targetGMid.toFixed(2)})
            </div>
          </div>
          <div className={cardClass}>
            <label className={`${labelClass} !text-red-400`}>🛡️ {t('seuilAlerte')}</label>
            <div className="flex items-center gap-3">
              <input type="range" min={5} max={50} step={1} value={maxDose}
                onChange={e => setMaxDose(Number(e.target.value))}
                className="flex-1 accent-red-500" />
              <span className={`text-sm font-bold min-w-[50px] text-center px-2 py-0.5 rounded-xl ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
                {maxDose}U
              </span>
            </div>
          </div>
          <TimeProfiles
            timeProfiles={timeProfiles}
            setTimeProfiles={setTimeProfiles}
            globalRatio={ratio}
            globalIsf={isf}
            isDark={isDark}
            t={t}
          />
        </div>
      )}

      {/* NOTIFICATIONS */}
      {section === 'notif' && (
        <div className="space-y-2">
          <div className={cardClass}>
            {notifPermission === 'granted' ? (
              <div className="flex items-center gap-2 text-sm text-teal-600">
                <span>✅</span>
                <span>{t('notifActivees') || 'Notifications activées'}</span>
              </div>
            ) : notifPermission === 'denied' ? (
              <div className={`px-3 py-2 rounded-xl text-sm ${isDark ? 'bg-amber-900/20 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                ⚠️ {t('notifBloquees') || 'Notifications bloquées par le navigateur. Autorisez-les dans les paramètres.'}
              </div>
            ) : (
              <button onClick={handleRequestPermission}
                className="w-full py-2 px-4 rounded-xl bg-teal-500 text-white font-medium text-sm">
                🔔 {t('autoriserNotifications') || 'Autoriser les notifications'}
              </button>
            )}
          </div>
          {notifPermission === 'granted' && (
            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('rappelPostRepas')}</p>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('rappelMesurer')}</p>
                </div>
                <button onClick={() => setNotifEnabled(!notifEnabled)}
                  className={`w-12 h-7 rounded-full transition relative ${notifEnabled ? 'bg-teal-500' : isDark ? 'bg-slate-600' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-all ${notifEnabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            </div>
          )}
          {notifEnabled && notifPermission === 'granted' && (
            <div className={cardClass}>
              <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'} mb-2`}>
                ✅ Les notifications sont liées au planning d'injection de chaque repas.
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Chaque contrôle glycémique prévu dans le calendrier d'injection déclenchera une notification.
                Le timing s'adapte au profil de digestion du repas.
              </p>
              <p className={`text-xs mt-1 italic ${isDark ? 'text-amber-400/70' : 'text-amber-600/70'}`}>
                ⏳ Fonctionnalité en cours de développement — disponible prochainement.
              </p>
            </div>
          )}
        </div>
      )}

      {/* DISPLAY */}
      {section === 'display' && (
        <div className="space-y-2">
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {isDark ? '🌙 ' + t('modeSombre') : '☀️ ' + t('modeClair')}
                </p>
              </div>
              <button onClick={toggleTheme}
                className={`w-12 h-7 rounded-full transition relative ${isDark ? 'bg-indigo-600' : 'bg-amber-400'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-1 transition-all ${isDark ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
          <div className={cardClass}>
            <label className={labelClass}>🌐 {t('langue')}</label>
            <div className="flex gap-2">
              {[{ v: 'fr', l: t('francais') }, { v: 'ar', l: t('arabe') }].map(lang => (
                <button key={lang.v} onClick={() => setLocale(lang.v)}
                  className={`flex-1 p-3 rounded-xl border text-sm font-medium transition ${
                    locale === lang.v
                      ? 'border-teal-400 bg-teal-50 text-teal-700' + (isDark ? ' !bg-teal-900/30 !text-teal-400' : '')
                      : isDark ? 'border-slate-600 bg-slate-700 text-slate-400' : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}>
                  {lang.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Data export/import */}
      <DataExport journal={journal} t={t} isDark={isDark} colors={colors} />

      {/* Medical disclaimer */}
      <div className={`text-center text-[10px] py-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        ⚕️ {t('disclaimerFull')}
      </div>

      <div className="h-8" />
    </div>
  );
}
