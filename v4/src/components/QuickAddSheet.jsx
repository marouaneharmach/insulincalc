import { useState, useMemo } from 'react';
import { calcIOB, calcPostMealCorrection, round05 } from '../utils/calculations';
import { DIGESTION_PROFILES } from '../data/constants';

export default function QuickAddSheet({ type, onClose, setTab, setGlycemia, journal, setJournal, targetGMid, isf, t, colors, isDark }) {
  const [value, setValue] = useState('');
  const [insulinType, setInsulinType] = useState('correction'); // 'correction', 'basal', 'manual'
  const [showCorrectionResult, setShowCorrectionResult] = useState(false);
  const [correctionDoseOverride, setCorrectionDoseOverride] = useState('');

  // Calculate current IOB from today's journal entries
  const currentIOB = useMemo(() => {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    return journal
      .filter(e => e.date && e.date.startsWith(today) && e.doseActual > 0)
      .reduce((sum, entry) => {
        const minutesElapsed = (now - new Date(entry.date).getTime()) / 60000;
        const digProfile = DIGESTION_PROFILES[entry.digestion || 'normal'];
        return sum + calcIOB(entry.doseActual, minutesElapsed, digProfile.tail);
      }, 0);
  }, [journal]);

  // Calculate correction suggestion when glycemia is entered
  const correctionSuggestion = useMemo(() => {
    if (type !== 'glycemia' || !value) return null;
    const gVal = parseFloat(value);
    if (isNaN(gVal) || gVal < 0.3 || gVal > 6.0) return null;
    if (!targetGMid || !isf) return null;

    const result = calcPostMealCorrection(gVal, targetGMid, isf, currentIOB);
    return result;
  }, [type, value, targetGMid, isf, currentIOB]);

  const handleSubmit = () => {
    if (!value) return;

    if (type === 'glycemia') {
      setGlycemia(value);
      const gVal = parseFloat(value);

      // Save glycemia entry
      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        glycPre: gVal.toFixed(2),
        glycPost: '',
        totalCarbs: 0,
        doseSuggested: 0,
        doseActual: 0,
        aliments: '',
        alimentIds: [],
        mealType: 'mesure',
      };
      setJournal(prev => [entry, ...prev].slice(0, 200));

      // If correction is needed and user confirms, also add correction injection
      if (showCorrectionResult && correctionSuggestion && correctionSuggestion.units > 0) {
        const actualCorrDose = correctionDoseOverride !== '' ? parseFloat(correctionDoseOverride) : correctionSuggestion.units;
        const corrEntry = {
          id: Date.now() + 1,
          date: new Date().toISOString(),
          glycPre: gVal.toFixed(2),
          glycPost: '',
          totalCarbs: 0,
          doseSuggested: correctionSuggestion.units,
          doseActual: actualCorrDose,
          aliments: '',
          alimentIds: [],
          mealType: 'injection',
          injectionType: 'correction',
          correctionDetails: {
            glycemia: gVal,
            target: targetGMid,
            isf: isf,
            iob: currentIOB,
            rawUnits: correctionSuggestion.rawUnits,
            netUnits: correctionSuggestion.units,
            ecartGL: correctionSuggestion.ecartGL,
          },
        };
        setTimeout(() => {
          setJournal(prev => [corrEntry, ...prev].slice(0, 200));
        }, 100);
      }
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
        injectionType: insulinType,
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

  // Glycemia status helper
  const getGlycStatus = (gVal) => {
    if (gVal < 0.7) return { label: t('hypoSevere') || 'Hypoglycémie sévère', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800/40' };
    if (gVal < 0.8) return { label: t('hypoMsg') || 'Hypoglycémie', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800/40' };
    if (gVal <= 1.3) return { label: t('zoneCible') || 'Zone cible', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/40' };
    if (gVal <= 1.8) return { label: t('elevee') || 'Élevée', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800/40' };
    if (gVal <= 2.5) return { label: t('hyperglycemieLabel') || 'Hyperglycémie', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800/40' };
    return { label: t('urgenceLabel') || 'Urgence médicale', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-700/50' };
  };

  const gVal = parseFloat(value);
  const glycStatus = type === 'glycemia' && !isNaN(gVal) && gVal >= 0.3 && gVal <= 6.0 ? getGlycStatus(gVal) : null;

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

        <div className="flex items-center gap-3 mb-3">
          <input
            type="number"
            step={config.step}
            min={config.min}
            max={config.max}
            placeholder={config.placeholder}
            value={value}
            onChange={e => { setValue(e.target.value); setShowCorrectionResult(false); }}
            autoFocus
            className={`flex-1 text-2xl font-bold text-center p-3 rounded-2xl border-2 outline-none transition ${
              isDark
                ? 'bg-slate-700 border-slate-600 text-white focus:border-teal-500'
                : 'bg-gray-50 border-gray-200 text-slate-800 focus:border-teal-500'
            }`}
          />
          <span className={`text-lg font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{config.unit}</span>
        </div>

        {/* Glycemia status indicator */}
        {type === 'glycemia' && glycStatus && (
          <div className={`mb-3 px-3 py-2 rounded-xl border ${isDark ? '' : glycStatus.bg} ${glycStatus.border}`}>
            <p className={`text-sm font-medium ${glycStatus.color}`}>{glycStatus.label}</p>

            {/* Correction suggestion */}
            {correctionSuggestion && correctionSuggestion.units > 0 && (
              <div className="mt-2">
                <div className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                  <div>
                    <p className={`text-xs font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                      💉 {t('correctionSuggeree') || 'Correction suggérée'}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {t('ecartCible') || 'Écart'}: +{correctionSuggestion.ecartGL} g/L
                      {currentIOB > 0 && ` · IOB: ${currentIOB.toFixed(1)}U`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-500">{correctionSuggestion.units}U</p>
                  </div>
                </div>

                {!showCorrectionResult ? (
                  <button
                    onClick={() => { setShowCorrectionResult(true); setCorrectionDoseOverride(''); }}
                    className={`w-full mt-2 py-2 rounded-xl text-sm font-medium border transition ${
                      isDark
                        ? 'border-blue-700 text-blue-400 hover:bg-blue-900/30'
                        : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    💉 {t('injecterCorrection') || 'Enregistrer glycémie + injection correction'}
                  </button>
                ) : (
                  <div className={`mt-2 p-2 rounded-lg border ${isDark ? 'bg-emerald-900/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'}`}>
                    <p className={`text-xs font-medium mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      ✓ {t('correctionConfirmee') || 'Correction sera enregistrée dans la timeline'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        💉 {t('doseReelle') || 'Dose réellement injectée'} :
                      </p>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder={String(correctionSuggestion.units)}
                        value={correctionDoseOverride}
                        onChange={e => setCorrectionDoseOverride(e.target.value)}
                        className={`w-20 text-center text-sm font-bold p-1.5 rounded-lg border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-200'}`}
                      />
                      <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>U</span>
                    </div>
                    {correctionDoseOverride !== '' && parseFloat(correctionDoseOverride) !== correctionSuggestion.units && (
                      <p className={`text-[10px] mt-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                        ⚠️ Suggéré : {correctionSuggestion.units}U — Injecté : {correctionDoseOverride}U
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Insulin type selector */}
        {type === 'insulin' && (
          <div className="mb-3 flex gap-2">
            {[
              { key: 'correction', label: t('correctionLabel') || 'Correction', icon: '🎯' },
              { key: 'basal', label: t('basalLabel') || 'Basale', icon: '🕐' },
              { key: 'manual', label: t('manualLabel') || 'Autre', icon: '✏️' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setInsulinType(opt.key)}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-medium border transition ${
                  insulinType === opt.key
                    ? (isDark ? 'bg-blue-900/40 border-blue-600 text-blue-400' : 'bg-blue-50 border-blue-300 text-blue-600')
                    : (isDark ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-gray-50 border-gray-200 text-gray-500')
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* IOB indicator when adding insulin */}
        {type === 'insulin' && currentIOB > 0 && (
          <div className={`mb-3 px-3 py-2 rounded-xl border ${isDark ? 'bg-blue-900/20 border-blue-800/30' : 'bg-blue-50 border-blue-200'}`}>
            <p className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              💉 {t('insulineActive') || 'Insuline active'}: <span className="font-bold">{currentIOB.toFixed(1)}U</span> IOB
            </p>
          </div>
        )}

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
