import { useState, useMemo } from 'react';
import { calcIOB, calcPostMealCorrection, round05 } from '../utils/calculations';
import { DIGESTION_PROFILES } from '../data/constants';

function glycColor(v) {
  if (!v || isNaN(v)) return '#94A3B8';
  if (v < 0.7) return '#EF4444';
  if (v < 1.0) return '#F97316';
  if (v <= 1.8) return '#10B981';
  if (v <= 2.5) return '#F59E0B';
  return '#EF4444';
}

export default function PostMealCorrector({ initialDose, isf, targetG, digestionKey, journal, setJournal, t, isDark }) {
  const [pmGlycemia, setPmGlycemia] = useState('');
  const [pmTime, setPmTime] = useState('120');
  const [corrDoseOverride, setCorrDoseOverride] = useState('');
  const [saved, setSaved] = useState(false);

  const dp = DIGESTION_PROFILES[digestionKey] || DIGESTION_PROFILES.normal;
  const timeOptions = [
    { v: '60', l: '1h' },
    { v: '90', l: '1h30' },
    { v: '120', l: '2h' },
    { v: '180', l: '3h' },
    { v: '240', l: '4h' },
  ];

  const pmG = parseFloat(pmGlycemia);
  const tMin = parseInt(pmTime);
  const iob = calcIOB(initialDose, tMin, dp.tail);

  const corr = useMemo(() => {
    if (isNaN(pmG) || pmG <= 0 || pmG > 6) return null;
    return calcPostMealCorrection(pmG, targetG, isf, iob);
  }, [pmG, targetG, isf, iob]);

  const handleSaveCorrection = () => {
    if (!corr || corr.units <= 0) return;
    const actualDose = corrDoseOverride !== '' ? parseFloat(corrDoseOverride) : corr.units;
    if (isNaN(actualDose) || actualDose <= 0) return;

    const corrEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      glycPre: pmG.toFixed(2),
      glycPost: '',
      totalCarbs: 0,
      doseSuggested: corr.units,
      doseActual: actualDose,
      aliments: '',
      alimentIds: [],
      mealType: 'injection',
      injectionType: 'correction',
      correctionDetails: {
        glycemia: pmG,
        target: targetG,
        isf,
        iob,
        rawUnits: corr.rawUnits,
        netUnits: corr.units,
        ecartGL: corr.ecartGL,
        timeMinutes: tMin,
      },
    };
    setJournal(prev => [corrEntry, ...prev].slice(0, 200));
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const tl = (k) => (t && t(k)) || k;

  return (
    <div className={cardClass}>
      <p className={`text-xs uppercase tracking-wider font-semibold mb-3 ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>
        🩸 {tl('correcteurPostRepas') || 'Correcteur post-repas'}
      </p>

      {/* Time selector */}
      <div className="mb-3">
        <p className={`text-[10px] uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          ⏱ {tl('tempsEcoule') || 'Temps écoulé depuis le repas'}
        </p>
        <div className="flex gap-1.5">
          {timeOptions.map(opt => (
            <button key={opt.v} onClick={() => setPmTime(opt.v)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition ${
                pmTime === opt.v
                  ? isDark ? 'bg-teal-900/30 border-teal-600 text-teal-400' : 'bg-teal-50 border-teal-300 text-teal-700'
                  : isDark ? 'border-slate-600 bg-slate-700 text-slate-400' : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Glycemia input */}
      <div className="mb-3">
        <p className={`text-[10px] uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          🩸 {tl('glycemiePostRepas') || 'Glycémie post-repas'} (g/L)
        </p>
        <input
          type="number" step="0.01" min="0.3" max="6" placeholder="ex: 1.80"
          value={pmGlycemia}
          onChange={e => { setPmGlycemia(e.target.value); setSaved(false); }}
          className={`w-full text-center text-xl font-bold p-3 rounded-xl border-2 outline-none transition ${
            isDark ? 'bg-slate-700 border-slate-600 focus:border-pink-500' : 'bg-gray-50 border-gray-200 focus:border-pink-400'
          }`}
          style={{ color: glycColor(pmG) }}
        />
      </div>

      {/* IOB + Target display */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className={`text-center p-2 rounded-xl ${isDark ? 'bg-purple-900/20 border border-purple-800/30' : 'bg-purple-50 border border-purple-100'}`}>
          <p className={`text-[10px] uppercase ${isDark ? 'text-purple-400' : 'text-purple-500'}`}>
            {tl('insulineRestante') || 'Insuline restante'}
          </p>
          <p className="text-lg font-bold text-purple-500">{iob} U</p>
          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>à {tMin} min</p>
        </div>
        <div className={`text-center p-2 rounded-xl ${isDark ? 'bg-emerald-900/20 border border-emerald-800/30' : 'bg-emerald-50 border border-emerald-100'}`}>
          <p className={`text-[10px] uppercase ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`}>
            {tl('votreCible') || 'Cible'}
          </p>
          <p className="text-lg font-bold text-emerald-500">{targetG.toFixed(2)} g/L</p>
        </div>
      </div>

      {/* Result */}
      {corr && (() => {
        // Hypo sévère
        if (corr.status === 'ok_low' && pmG < 0.7) return (
          <div className={`p-3 rounded-xl border-2 ${isDark ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-300'}`}>
            <p className="text-sm font-bold text-red-500 mb-1">🚨 HYPOGLYCÉMIE — Agir immédiatement</p>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-red-300' : 'text-red-600'}`}>
              Glycémie critique : <strong>{pmG.toFixed(2)} g/L</strong><br/>
              → Prendre 15g de sucres rapides<br/>
              → Contrôler à nouveau dans 15 minutes<br/>
              → Ne pas injecter d'insuline
            </p>
          </div>
        );

        // Dans la cible / pas de correction
        if (corr.status === 'ok_low') return (
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-emerald-900/20 border-emerald-800/30' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className="text-sm font-bold text-emerald-500 mb-1">✅ {tl('aucuneCorrection') || 'Aucune correction nécessaire'}</p>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Glycémie à <strong>{pmG.toFixed(2)} g/L</strong> — dans la cible ({targetG.toFixed(2)} g/L)<br/>
              IOB : {iob} U · Pas d'injection supplémentaire.
            </p>
          </div>
        );

        // Urgence ≥ 3.0
        if (corr.status === 'urgent_override') return (
          <div className={`p-3 rounded-xl border-2 ${isDark ? 'bg-red-900/40 border-red-600' : 'bg-red-50 border-red-400'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 text-red-500`}>🏥 URGENCE — Correction immédiate</p>
            <p className="text-4xl font-black text-red-500 mb-2">{corr.units}<span className="text-lg text-gray-400 ml-1">U</span></p>
            <CorrectionDetails corr={corr} pmG={pmG} tMin={tMin} iob={iob} isDark={isDark} />
            <p className={`text-[10px] mt-2 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
              → Contrôler dans 45 min. Consultez votre médecin si ≥ 3.0 g/L persiste.
            </p>
            <DoseOverrideAndSave corr={corr} corrDoseOverride={corrDoseOverride} setCorrDoseOverride={setCorrDoseOverride} saved={saved} onSave={handleSaveCorrection} isDark={isDark} t={t} />
          </div>
        );

        // Hyper sévère 2.5-3.0
        if (corr.status === 'high_override') return (
          <div className={`p-3 rounded-xl border-2 ${isDark ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-300'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 text-red-500`}>🚨 Hyperglycémie sévère — Injection recommandée</p>
            <p className="text-4xl font-black text-red-500 mb-2">{corr.units}<span className="text-lg text-gray-400 ml-1">U</span></p>
            <CorrectionDetails corr={corr} pmG={pmG} tMin={tMin} iob={iob} isDark={isDark} />
            <DoseOverrideAndSave corr={corr} corrDoseOverride={corrDoseOverride} setCorrDoseOverride={setCorrDoseOverride} saved={saved} onSave={handleSaveCorrection} isDark={isDark} t={t} />
          </div>
        );

        // Hyper modérée 2.0-2.5
        if (corr.status === 'warn_override') return (
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-orange-900/20 border-orange-700/50' : 'bg-orange-50 border-orange-200'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 text-orange-500`}>⚠️ Hyperglycémie — Injection recommandée</p>
            <p className="text-4xl font-black text-orange-500 mb-2">{corr.units}<span className="text-lg text-gray-400 ml-1">U</span></p>
            <CorrectionDetails corr={corr} pmG={pmG} tMin={tMin} iob={iob} isDark={isDark} />
            <DoseOverrideAndSave corr={corr} corrDoseOverride={corrDoseOverride} setCorrDoseOverride={setCorrDoseOverride} saved={saved} onSave={handleSaveCorrection} isDark={isDark} t={t} />
          </div>
        );

        // Correction normale
        if (corr.units > 0) return (
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-amber-900/20 border-amber-800/30' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              💉 {tl('correctionSuggeree') || 'Correction suggérée'}
            </p>
            <p className="text-4xl font-black mb-2" style={{ color: glycColor(pmG) }}>
              {corr.units}<span className="text-lg text-gray-400 ml-1">U</span>
            </p>
            <CorrectionDetails corr={corr} pmG={pmG} tMin={tMin} iob={iob} isDark={isDark} />
            <DoseOverrideAndSave corr={corr} corrDoseOverride={corrDoseOverride} setCorrDoseOverride={setCorrDoseOverride} saved={saved} onSave={handleSaveCorrection} isDark={isDark} t={t} />
          </div>
        );

        return null;
      })()}
    </div>
  );
}

// Correction breakdown table
function CorrectionDetails({ corr, pmG, tMin, iob, isDark }) {
  const rows = [
    { label: 'Glycémie mesurée', val: `${pmG.toFixed(2)} g/L` },
    { label: 'Écart / cible', val: `+${corr.ecartGL} g/L` },
    { label: 'Correction brute', val: `${corr.rawUnits} U` },
    { label: `IOB déduit (${tMin}min)`, val: `−${iob} U` },
    { label: 'Correction nette', val: `${corr.units} U`, bold: true },
  ];
  return (
    <div className={`rounded-lg p-2 mb-2 ${isDark ? 'bg-slate-700/50' : 'bg-white/80'}`}>
      {rows.map((row, i) => (
        <div key={i} className={`flex justify-between text-[11px] py-0.5 ${
          row.bold ? `font-bold border-t pt-1 mt-1 ${isDark ? 'border-slate-600' : 'border-gray-200'}` : ''
        } ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span>{row.label}</span>
          <span className={row.bold ? 'text-blue-500' : ''}>{row.val}</span>
        </div>
      ))}
    </div>
  );
}

// Dose override + Save button
function DoseOverrideAndSave({ corr, corrDoseOverride, setCorrDoseOverride, saved, onSave, isDark, t }) {
  const tl = (k) => (t && t(k)) || k;
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-2">
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          💉 {tl('doseReelle') || 'Dose réellement injectée'} :
        </p>
        <input
          type="number" step="0.5" min="0"
          placeholder={String(corr.units)}
          value={corrDoseOverride}
          onChange={e => setCorrDoseOverride(e.target.value)}
          className={`w-20 text-center text-sm font-bold p-1.5 rounded-lg border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200'}`}
        />
        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>U</span>
      </div>
      <button onClick={onSave}
        className={`w-full py-2.5 rounded-xl text-sm font-medium transition ${
          saved
            ? 'bg-emerald-500 text-white'
            : 'bg-pink-500 hover:bg-pink-600 text-white'
        }`}>
        {saved ? '✅ Correction enregistrée' : '💉 ' + (tl('enregistrerCorrection') || 'Enregistrer correction dans la timeline')}
      </button>
    </div>
  );
}
