import { useState, useId } from 'react';
import { requestNotificationPermission, pendingReminders } from '../app/notificationService';
import { imcCategory } from '../domain/anthropometry';
import { INSULIN_PROFILES, resolveInsulinProfile } from '../domain/insulin/profiles';
import { assessRamadanRisk, buildFastingPlan } from '../domain/ramadan';
import { formatDateTime } from '../domain/time';
import { useLocalStorage } from '../hooks/useLocalStorage';
import DataExport from './DataExport';
import CgmImport from './CgmImport';
import TimeProfiles from './TimeProfiles';
import VersionPanel from './VersionPanel';
import Switch from './ui/Switch';
import { AI_PROVIDERS } from '../app/aiConfig';

function Range({ id, label, value, onChange, min, max, step, format, accent = 'accent-teal-600', isDark }) {
  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const labelClass = `text-xs uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  return (
    <div className={cardClass}>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="flex items-center gap-3">
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={`flex-1 ${accent}`} />
        <output htmlFor={id} className={`text-sm font-bold min-w-[4.5rem] text-center px-2 py-1 rounded-xl tabular-nums ${isDark ? 'bg-slate-700 text-teal-300' : 'bg-teal-50 text-teal-800'}`}>{format(value)}</output>
      </div>
    </div>
  );
}

export default function Settings({
  ratio, setRatio, isf, setIsf, targetGMin, setTargetGMin, targetGMax, setTargetGMax, targetGMid,
  patientName, setPatientName, weight, setWeight, height, setHeight, age, setAge, sex, setSex, imc,
  notifEnabled, setNotifEnabled, theme, setTheme, isDark, locale, setLocale,
  timeProfiles, setTimeProfiles, journal, onImportJournal, onImportProfile, storageMode,
  insulinBasal, setInsulinBasal, insulinRapid, setInsulinRapid, insulinProfileId, setInsulinProfileId, insulinProfile,
  basalDose, setBasalDose, basalReminderTime, setBasalReminderTime,
  postKeto, setPostKeto, slowDigestion, setSlowDigestion, dia, setDia,
  maxDoseU, setMaxDoseU, nightModeEnabled, setNightModeEnabled, nightStart, setNightStart, nightEnd, setNightEnd, nightCorrectionMin, setNightCorrectionMin,
  fastingEnabled, setFastingEnabled, fastingSuhoorReductionPct, setFastingSuhoorReductionPct, fastingBasalReductionPct, setFastingBasalReductionPct,
  groqApiKey, setGroqApiKey, aiConfig,
  diagnostics, updateAvailable, releaseNotes, onCheckForUpdates, onApplyUpdate, t, colors,
}) {
  const [section, setSection] = useState('profil');
  const [notifPermission, setNotifPermission] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'default'));
  const [showKey, setShowKey] = useState(false);
  const [ramadanRisk, setRamadanRisk] = useLocalStorage('ramadanRisk', { severeHypo3m: false, hypoUnawareness: false, recurrentHypo: false, pregnancy: false, kidneyDisease: false, acuteIllness: false });
  const ids = useId();

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const labelClass = `text-xs uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const inputClass = `w-full p-2.5 rounded-xl border outline-none text-sm transition ${isDark ? 'bg-slate-700 border-slate-600 text-white focus:border-teal-400' : 'bg-gray-50 border-gray-200 focus:border-teal-500'}`;
  const subtle = isDark ? 'text-slate-400' : 'text-slate-500';
  const pill = (active) => `shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition ${active ? 'bg-teal-600 text-white' : isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-gray-200'}`;
  const choice = (active) => `flex-1 p-3 rounded-xl border text-sm font-medium transition ${active ? (isDark ? 'border-teal-400 bg-teal-900/30 text-teal-300' : 'border-teal-500 bg-teal-50 text-teal-800') : (isDark ? 'border-slate-600 bg-slate-700 text-slate-300' : 'border-gray-200 bg-gray-50 text-gray-600')}`;

  const sections = [
    { key: 'profil', icon: '👤', label: t('profil') },
    { key: 'medical', icon: '🩺', label: t('profilMedical') },
    { key: 'insulin', icon: '💉', label: t('parametresManuels') },
    { key: 'securite', icon: '🛡️', label: t('secuTitre') },
    { key: 'ramadan', icon: '🌙', label: t('ramadanTitre') },
    { key: 'notif', icon: '🔔', label: t('notifications') },
    { key: 'display', icon: '🎨', label: t('apparence') },
    { key: 'donnees', icon: '💾', label: t('sauvegardeRestauration') },
    { key: 'diagnostic', icon: '🧪', label: t('diagnosticTitre') },
  ];

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') setNotifEnabled(true);
  };

  const detectedProfile = resolveInsulinProfile(insulinRapid);
  const fastingPlan = buildFastingPlan(basalDose, { basalReductionPct: fastingBasalReductionPct, suhoorReductionPct: fastingSuhoorReductionPct });
  const risk = assessRamadanRisk({ type1: true, age: Number(age) || null, ...ramadanRisk });
  const pending = section === 'notif' ? pendingReminders() : [];
  const imcCat = imcCategory(imc);

  return (
    <div className="px-4 pt-2 space-y-2">
      <h1 className={`text-xl font-bold px-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>⚙️ {t('tabParams')}</h1>

      <nav aria-label={t('tabParams')} className="flex gap-2 overflow-x-auto pb-1">
        {sections.map((s) => (
          <button key={s.key} type="button" onClick={() => setSection(s.key)} aria-current={section === s.key ? 'page' : undefined} className={pill(section === s.key)}>
            <span aria-hidden="true">{s.icon}</span> {s.label}
          </button>
        ))}
      </nav>

      {section === 'profil' && (
        <div className="space-y-2">
          <div className={cardClass}>
            <label htmlFor={`${ids}-name`} className={labelClass}>{t('nomPatient')}</label>
            <input id={`${ids}-name`} type="text" placeholder={t('nomPlaceholder')} value={patientName} onChange={(e) => setPatientName(e.target.value)} className={inputClass} autoComplete="given-name" />
          </div>
          <div className={cardClass}>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor={`${ids}-age`} className={labelClass}>{t('age')}</label>
                <input id={`${ids}-age`} type="number" min="1" max="120" inputMode="numeric" placeholder="30" value={age} onChange={(e) => setAge(e.target.value)} className={`${inputClass} text-center`} />
              </div>
              <div>
                <label htmlFor={`${ids}-height`} className={labelClass}>{t('taille')}</label>
                <input id={`${ids}-height`} type="number" min="50" max="250" inputMode="numeric" placeholder="170" value={height} onChange={(e) => setHeight(e.target.value)} className={`${inputClass} text-center`} />
              </div>
              <div>
                <span className={labelClass} id={`${ids}-sex`}>{t('sexe')}</span>
                <div className="flex gap-1" role="group" aria-labelledby={`${ids}-sex`}>
                  {['M', 'F'].map((s) => (
                    <button key={s} type="button" onClick={() => setSex(s)} aria-pressed={sex === s} className={choice(sex === s)}>{s === 'M' ? t('homme') : t('femme')}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className={`text-center p-2 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
                <p className={`text-xs uppercase ${subtle}`}>IMC</p>
                <p className={`text-xl font-bold ${imc ? (imc < 25 ? 'text-emerald-600' : imc < 30 ? 'text-amber-600' : 'text-red-600') : subtle}`}>{imc ?? '—'}</p>
                <p className={`text-xs ${subtle}`}>{imcCat ? t(`IMC_${imcCat}`) : ''}</p>
              </div>
              <div className={`text-center p-2 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
                <label htmlFor={`${ids}-weight`} className={`text-xs uppercase ${subtle}`}>{t('poidsKg')}</label>
                <input id={`${ids}-weight`} type="number" min="20" max="200" step="0.5" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={`w-full text-lg font-bold text-center bg-transparent outline-none ${isDark ? 'text-white' : 'text-slate-700'}`} />
                <p className={`text-xs ${subtle}`}>kg</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'medical' && (
        <div className="space-y-2">
          <div className={cardClass}>
            <label htmlFor={`${ids}-basal`} className={labelClass}>💉 {t('cl_insulineBasale')}</label>
            <input id={`${ids}-basal`} type="text" placeholder="Tresiba, Lantus, Toujeo…" value={insulinBasal} onChange={(e) => setInsulinBasal(e.target.value)} className={inputClass} />
          </div>
          <div className={cardClass}>
            <label htmlFor={`${ids}-rapid`} className={labelClass}>⚡ {t('cl_insulineRapide')}</label>
            <input id={`${ids}-rapid`} type="text" placeholder="NovoRapid, Humalog, Fiasp…" value={insulinRapid} onChange={(e) => setInsulinRapid(e.target.value)} className={inputClass} />
            <label htmlFor={`${ids}-profile`} className={`${labelClass} mt-3`}>{t('profilInsuline')}</label>
            <select id={`${ids}-profile`} value={insulinProfileId ?? ''} onChange={(e) => setInsulinProfileId(e.target.value || null)} className={inputClass} aria-describedby={`${ids}-profile-hint`}>
              <option value="">{t('profilInsulineAuto')}{detectedProfile ? ` : ${detectedProfile.name}` : ''}</option>
              {INSULIN_PROFILES.filter((p) => p.kind !== 'basal').map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {Math.round(p.diaMin / 60 * 10) / 10} h / {t('picMin')} {p.peakMin} min</option>
              ))}
            </select>
            <p id={`${ids}-profile-hint`} className={`text-xs mt-1 ${subtle}`}>{t('profilInsulineDesc')} · {insulinProfile?.name} ({Math.round((insulinProfile?.diaMin ?? 270) / 6) / 10} h, {t('picMin')} {insulinProfile?.peakMin} min)</p>
          </div>
          <Range isDark={isDark} id={`${ids}-basaldose`} label={`📊 ${t('cl_doseBasale')} (U/jour)`} value={basalDose} onChange={setBasalDose} min={0} max={100} step={1} format={(v) => `${v} U`} />
          <div className={cardClass}>
            <label htmlFor={`${ids}-basaltime`} className={labelClass}>⏰ {t('basaleRappelHeure')}</label>
            <div className="flex gap-2">
              <input id={`${ids}-basaltime`} type="time" value={basalReminderTime ?? ''} onChange={(e) => setBasalReminderTime(e.target.value || null)} className={inputClass} />
              {basalReminderTime && <button type="button" onClick={() => setBasalReminderTime(null)} className={`px-3 rounded-xl text-xs ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}>✕</button>}
            </div>
          </div>
          <Range isDark={isDark} id={`${ids}-dia`} label={`⏱ ${t('cl_dureeAction')} (DIA)`} value={dia} onChange={setDia} min={2} max={8} step={0.5} format={(v) => `${v} h`} accent="accent-purple-600" />
          <div className={`${cardClass} space-y-3`}>
            <Switch id={`${ids}-keto`} checked={postKeto} onChange={setPostKeto} label={t('cl_profilPostKeto')} description={t('regimeCetoDesc')} isDark={isDark} />
            <Switch id={`${ids}-slow`} checked={slowDigestion} onChange={setSlowDigestion} label={t('cl_digestionLente')} description={t('digestionLenteDesc')} isDark={isDark} />
          </div>
        </div>
      )}

      {section === 'insulin' && (
        <div className="space-y-2">
          <Range isDark={isDark} id={`${ids}-ratio`} label={t('ratioInsulineGlucides')} value={ratio} onChange={setRatio} min={5} max={25} step={1} format={(v) => `1U/${v}g`} />
          <Range isDark={isDark} id={`${ids}-isf`} label={t('facteurCorrection')} value={isf} onChange={setIsf} min={20} max={100} step={5} format={(v) => `${v} mg/dL`} accent="accent-purple-600" />
          <div className={cardClass}>
            <span className={labelClass}>{t('glycemieCiblePlage')}</span>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label htmlFor={`${ids}-tmin`} className={`text-xs text-center mb-1 block ${subtle}`}>Min</label>
                <div className="flex items-center gap-2">
                  <input id={`${ids}-tmin`} type="range" min={0.6} max={1.2} step={0.1} value={targetGMin} onChange={(e) => { const v = Number(e.target.value); setTargetGMin(v); if (v >= targetGMax) setTargetGMax(Math.min(v + 0.2, 2.0)); }} className="flex-1 accent-emerald-600" />
                  <output className="text-sm font-bold text-emerald-700 w-10 text-center">{targetGMin.toFixed(1)}</output>
                </div>
              </div>
              <div>
                <label htmlFor={`${ids}-tmax`} className={`text-xs text-center mb-1 block ${subtle}`}>Max</label>
                <div className="flex items-center gap-2">
                  <input id={`${ids}-tmax`} type="range" min={1.0} max={2.0} step={0.1} value={targetGMax} onChange={(e) => { const v = Number(e.target.value); setTargetGMax(v); if (v <= targetGMin) setTargetGMin(Math.max(v - 0.2, 0.6)); }} className="flex-1 accent-emerald-600" />
                  <output className="text-sm font-bold text-emerald-700 w-10 text-center">{targetGMax.toFixed(1)}</output>
                </div>
              </div>
            </div>
            <p className={`text-center text-xs font-medium p-1.5 rounded-xl ${isDark ? 'bg-emerald-900/20 text-emerald-300' : 'bg-emerald-50 text-emerald-800'}`}>🎯 {targetGMin.toFixed(1)} — {targetGMax.toFixed(1)} g/L (correction → {targetGMid.toFixed(2)})</p>
          </div>
          <TimeProfiles timeProfiles={timeProfiles} setTimeProfiles={setTimeProfiles} globalRatio={ratio} globalIsf={isf} isDark={isDark} t={t} />
        </div>
      )}

      {section === 'securite' && (
        <div className="space-y-2">
          <div className={cardClass}>
            <label htmlFor={`${ids}-maxdose`} className={labelClass}>🛡️ {t('plafondDose')}</label>
            <input id={`${ids}-maxdose`} type="number" min="1" max="100" step="0.5" inputMode="decimal" value={maxDoseU ?? ''} placeholder="auto" aria-describedby={`${ids}-maxdose-hint`}
              onChange={(e) => setMaxDoseU(e.target.value === '' ? null : Math.max(1, Number(e.target.value)))} className={`${inputClass} text-center text-lg font-bold`} />
            <p id={`${ids}-maxdose-hint`} className={`text-xs mt-1 ${subtle}`}>{t('plafondDoseDesc')}</p>
          </div>
          <div className={`${cardClass} space-y-3`}>
            <Switch id={`${ids}-night`} checked={nightModeEnabled} onChange={setNightModeEnabled} label={`🌑 ${t('modeNuitTitre')}`} description={t('modeNuitDesc')} isDark={isDark} />
            {nightModeEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`${ids}-nstart`} className={labelClass}>{t('modeNuitDebut')}</label>
                  <select id={`${ids}-nstart`} value={nightStart} onChange={(e) => setNightStart(Number(e.target.value))} className={inputClass}>
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${ids}-nend`} className={labelClass}>{t('modeNuitFin')}</label>
                  <select id={`${ids}-nend`} value={nightEnd} onChange={(e) => setNightEnd(Number(e.target.value))} className={inputClass}>
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label htmlFor={`${ids}-nmin`} className={labelClass}>{t('modeNuitSeuil')}</label>
                  <div className="flex items-center gap-3">
                    <input id={`${ids}-nmin`} type="range" min={1.5} max={2.5} step={0.1} value={nightCorrectionMin} onChange={(e) => setNightCorrectionMin(Number(e.target.value))} className="flex-1 accent-slate-600" />
                    <output className={`text-sm font-bold min-w-[4rem] text-center px-2 py-1 rounded-xl tabular-nums ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-800'}`}>{nightCorrectionMin.toFixed(1)} g/L</output>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'ramadan' && (
        <div className="space-y-2">
          <div className={`${cardClass} space-y-3`}>
            <Switch id={`${ids}-fast`} checked={fastingEnabled} onChange={setFastingEnabled} label={`🌙 ${t('ramadanActiver')}`} description={t('ramadanDesc')} isDark={isDark} />
          </div>
          <Range isDark={isDark} id={`${ids}-suhoor`} label={t('ramadanReductionSuhoor')} value={fastingSuhoorReductionPct} onChange={setFastingSuhoorReductionPct} min={25} max={50} step={5} format={(v) => `−${v} %`} accent="accent-indigo-600" />
          <Range isDark={isDark} id={`${ids}-basalred`} label={t('ramadanReductionBasale')} value={fastingBasalReductionPct} onChange={setFastingBasalReductionPct} min={15} max={30} step={5} format={(v) => `−${v} %`} accent="accent-indigo-600" />
          {fastingPlan.basalSuggestedU != null && (
            <p className={`text-sm px-1 ${isDark ? 'text-indigo-200' : 'text-indigo-800'}`}>{t('ramadanBasaleSuggeree', { units: fastingPlan.basalSuggestedU })}</p>
          )}
          <div className={cardClass}>
            <p className={labelClass}>{t('ramadanRisque')} : <span className={risk.category === 'very-high' ? 'text-red-600' : risk.category === 'high' ? 'text-amber-600' : 'text-emerald-600'}>{t(`RAMADAN_RISK_${risk.category}`)}</span></p>
            <div className="space-y-2 mt-2">
              {[['severeHypo3m', 'RAMADAN_REASON_SEVERE_HYPO'], ['hypoUnawareness', 'RAMADAN_REASON_UNAWARENESS'], ['recurrentHypo', 'RAMADAN_REASON_RECURRENT_HYPO'], ['pregnancy', 'RAMADAN_REASON_PREGNANCY'], ['kidneyDisease', 'RAMADAN_REASON_KIDNEY'], ['acuteIllness', 'RAMADAN_REASON_ILLNESS']].map(([k, code]) => (
                <label key={k} className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  <input type="checkbox" checked={Boolean(ramadanRisk[k])} onChange={(e) => setRamadanRisk({ ...ramadanRisk, [k]: e.target.checked })} className="w-5 h-5 rounded" />
                  {t(code)}
                </label>
              ))}
            </div>
            <ul className={`mt-3 space-y-1 text-xs ${subtle}`}>
              {risk.advice.map((code) => <li key={code}>• {t(code)}</li>)}
              {fastingPlan.guidance.map((code) => <li key={code}>• {t(code)}</li>)}
            </ul>
          </div>
        </div>
      )}

      {section === 'notif' && (
        <div className="space-y-2">
          <div className={cardClass}>
            {notifPermission === 'granted' ? (
              <p className="flex items-center gap-2 text-sm text-teal-700"><span aria-hidden="true">✅</span>{t('notifActivees') || 'Notifications activées'}</p>
            ) : notifPermission === 'denied' ? (
              <p className={`px-3 py-2 rounded-xl text-sm ${isDark ? 'bg-amber-900/20 text-amber-200' : 'bg-amber-50 text-amber-800'}`}>⚠️ {t('notifBloquees')}</p>
            ) : (
              <button type="button" onClick={handleRequestPermission} className="w-full py-3 px-4 rounded-xl bg-teal-600 text-white font-medium text-sm">🔔 {t('autoriserNotifications')}</button>
            )}
          </div>
          <div className={cardClass}>
            <Switch id={`${ids}-notif`} checked={notifEnabled} onChange={setNotifEnabled} label={t('rappelPostRepas')} description={t('rappelMesurer')} isDark={isDark} />
          </div>
          <div className={cardClass}>
            <p className={labelClass}>{t('rappelsAVenir')}</p>
            {pending.length === 0 ? <p className={`text-sm ${subtle}`}>{t('aucuneDonnee')}</p> : (
              <ul className="space-y-1">
                {pending.slice(0, 8).map((r) => (
                  <li key={r.id} className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>⏰ {formatDateTime(r.dueAt, locale)} · {t(r.titleCode, r.params)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {section === 'display' && (
        <div className="space-y-2">
          <div className={cardClass}>
            <span className={labelClass} id={`${ids}-theme`}>🎨 {t('apparence')}</span>
            <div className="flex gap-2" role="group" aria-labelledby={`${ids}-theme`}>
              {[['system', t('themeSysteme')], ['light', `☀️ ${t('themeClair')}`], ['dark', `🌙 ${t('themeSombre')}`]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setTheme(v)} aria-pressed={theme === v} className={choice(theme === v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className={cardClass}>
            <span className={labelClass} id={`${ids}-lang`}>🌐 {t('langue')}</span>
            <div className="flex gap-2" role="group" aria-labelledby={`${ids}-lang`}>
              {[{ v: 'fr', l: t('francais') }, { v: 'ar', l: t('arabe') }].map((lang) => (
                <button key={lang.v} type="button" onClick={() => setLocale(lang.v)} aria-pressed={locale === lang.v} lang={lang.v} className={choice(locale === lang.v)}>{lang.l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'donnees' && (
        <div className="space-y-2">
          <DataExport journal={journal} onImportJournal={onImportJournal} onImportProfile={onImportProfile} t={t} isDark={isDark} locale={locale} />
          <CgmImport journal={journal} onImport={onImportJournal} t={t} isDark={isDark} />
          <div className={cardClass}>
            <label htmlFor={`${ids}-groq`} className={labelClass}>🔑 {t('cleApiIa')}</label>
            <div className="flex gap-2">
              <input id={`${ids}-groq`} type={showKey ? 'text' : 'password'} value={groqApiKey} onChange={(e) => setGroqApiKey(e.target.value.trim())} autoComplete="off" spellCheck={false} className={inputClass} aria-describedby={`${ids}-groq-hint`} placeholder="sk-or-… / gsk_…" />
              <button type="button" onClick={() => setShowKey((v) => !v)} aria-pressed={showKey} aria-label={showKey ? 'Masquer' : 'Afficher'} className={`px-3 rounded-xl text-sm ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}>{showKey ? '🙈' : '👁'}</button>
            </div>
            <p id={`${ids}-groq-hint`} className={`text-xs mt-1 ${subtle}`}>{t('cleApiIaDesc')}</p>
            <p role="status" className={`text-xs mt-1 font-medium ${aiConfig?.source === 'none' ? (isDark ? 'text-amber-300' : 'text-amber-700') : (isDark ? 'text-emerald-300' : 'text-emerald-700')}`}>
              {aiConfig?.source === 'environment'
                ? `🔒 ${t('cleApiEnvironnement', { provider: AI_PROVIDERS[aiConfig.provider]?.label ?? aiConfig.provider, model: aiConfig.model })}`
                : aiConfig?.source === 'settings'
                  ? `✅ ${t('cleApiAppareil', { provider: AI_PROVIDERS[aiConfig.provider]?.label ?? aiConfig.provider, model: aiConfig.model })}`
                  : `⚠️ ${t('cleApiAucune')}`}
            </p>
          </div>
          <p className={`text-xs px-1 ${subtle}`}>💾 {storageMode === 'indexeddb' ? 'IndexedDB' : 'localStorage'} · {journal.length} {t('entrees') || 'entrées'}</p>
        </div>
      )}

      {section === 'diagnostic' && (
        <VersionPanel diagnostics={diagnostics} updateAvailable={updateAvailable} releaseNotes={releaseNotes} isDark={isDark} t={t} locale={locale} onCheckForUpdates={onCheckForUpdates} onApplyUpdate={onApplyUpdate} />
      )}

      <p className={`text-center text-xs py-2 ${subtle}`} style={{ color: colors?.muted }}>⚕️ {t('disclaimerFull')}</p>
      <div className="h-8" />
    </div>
  );
}
