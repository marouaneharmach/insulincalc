import { useState } from 'react';
import { DIGESTION_PROFILES } from '../data/constants';

export default function Onboarding({
  setPatientName,
  setAge,
  setSex,
  setHeight,
  setWeight,
  setRatio,
  setIsf,
  setTargetGMin,
  setTargetGMax,
  setDigestion,
  onComplete,
  t,
  isDark,
  colors,
}) {
  const [step, setStep] = useState(1);

  // Step 2 - Profile
  const [name, setName] = useState('');
  const [age, ageState] = useState('');
  const [sex, sexState] = useState('M');
  const [height, heightState] = useState('');
  const [weight, weightState] = useState('');
  const [digestionLocal, setDigestionLocal] = useState('normal');

  // Step 3 - Insulin parameters
  const [ratio, ratioState] = useState(10);
  const [isf, isfState] = useState(50);
  const [targetGMin, targetGMinState] = useState(0.8);
  const [targetGMax, targetGMaxState] = useState(1.3);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = () => {
    // Save all values
    if (name) setPatientName(name);
    if (age) setAge(parseInt(age));
    setSex(sex);
    if (height) setHeight(parseFloat(height));
    if (weight) setWeight(parseFloat(weight));
    setRatio(ratio);
    setIsf(isf);
    setTargetGMin(targetGMin);
    setTargetGMax(targetGMax);
    if (setDigestion) setDigestion(digestionLocal);

    // Mark onboarding as complete
    onComplete();
  };

  const bgClass = isDark ? 'bg-slate-900' : 'bg-[#F7FAFB]';
  const textClass = isDark ? 'text-slate-200' : 'text-slate-800';
  const cardClass = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const inputClass = isDark
    ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500'
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500';

  return (
    <div dir="ltr" className={`min-h-screen ${bgClass} ${textClass} flex items-center justify-center p-3 font-sans`}>
      <div className="w-full max-w-md">
        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-2 w-2 rounded-full transition-all ${
                n === step ? `bg-[${colors.primary}] w-6` : `bg-slate-300`
              }`}
              style={{ backgroundColor: n === step ? colors.primary : undefined }}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className={`rounded-3xl ${cardClass} border p-6 space-y-6 animate-fade-in`}>
            <div className="text-center space-y-3">
              <div className="text-4xl mb-2">💊</div>
              <h1 className="text-2xl font-bold">InsulinCalc</h1>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('onb_tagline') || 'Calcul intelligent d\'insuline pour diabète type 1'}
              </p>
            </div>

            <div className={`rounded-2xl p-4 ${isDark ? 'bg-blue-950/40 border border-blue-900' : 'bg-blue-50 border border-blue-200'}`}>
              <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                ⚕️ {t('onb_disclaimer') || 'Cet outil ne remplace pas l\'avis médical. Consultez toujours votre médecin.'}
              </p>
            </div>

            <button
              onClick={handleNext}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all"
              style={{ backgroundColor: colors.primary }}
            >
              {t('onb_commencer') || 'Commencer'}
            </button>
          </div>
        )}

        {/* Step 2: Profile */}
        {step === 2 && (
          <div className={`rounded-3xl ${cardClass} border p-6 space-y-4 animate-fade-in`}>
            <h2 className="text-xl font-bold">{t('onb_profil') || 'Votre profil'}</h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {t('onb_prenom') || 'Votre prénom'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('onb_prenom') || 'Votre prénom'}
                  className={`w-full px-3 py-2.5 rounded-lg border ${inputClass} focus:outline-none focus:ring-2 text-sm`}
                  style={{ focusRingColor: colors.primary }}
                />
              </div>

              {/* Age */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {t('onb_age') || 'Âge'}
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => ageState(e.target.value)}
                  placeholder="25"
                  className={`w-full px-3 py-2.5 rounded-lg border ${inputClass} focus:outline-none focus:ring-2 text-sm`}
                />
              </div>

              {/* Sex */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {t('onb_sexe') || 'Sexe'}
                </label>
                <div className="flex gap-2">
                  {['M', 'F'].map((option) => (
                    <button
                      key={option}
                      onClick={() => sexState(option)}
                      className={`flex-1 py-2.5 rounded-lg font-medium transition-all text-sm ${
                        sex === option
                          ? `text-white`
                          : isDark
                          ? 'bg-slate-700 text-slate-300 border border-slate-600'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                      style={{
                        backgroundColor: sex === option ? colors.primary : undefined,
                      }}
                    >
                      {option === 'M' ? 'Homme' : 'Femme'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Height & Weight grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t('onb_taille') || 'Taille (cm)'}
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => heightState(e.target.value)}
                    placeholder="170"
                    className={`w-full px-3 py-2.5 rounded-lg border ${inputClass} focus:outline-none focus:ring-2 text-sm`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t('onb_poids') || 'Poids (kg)'}
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => weightState(e.target.value)}
                    placeholder="70"
                    className={`w-full px-3 py-2.5 rounded-lg border ${inputClass} focus:outline-none focus:ring-2 text-sm`}
                  />
                </div>
              </div>
            </div>

            {/* Digestion habituelle */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t('onb_digestion') || 'Votre digestion habituelle'}
              </label>
              <p className={`text-xs mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('onb_digestion_desc') || 'Influence le timing de vos injections'}
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(DIGESTION_PROFILES).map(([key, dp]) => (
                  <button key={key} onClick={() => setDigestionLocal(key)}
                    className={`p-2 rounded-xl text-center border transition ${
                      digestionLocal === key
                        ? 'border-teal-400 bg-teal-50' + (isDark ? ' !bg-teal-900/30 !border-teal-600' : '')
                        : isDark ? 'border-slate-600 bg-slate-700/50' : 'border-gray-200 bg-gray-50'
                    }`}>
                    <span className="text-lg">{dp.icon}</span>
                    <p className={`text-[10px] font-medium mt-0.5 ${digestionLocal === key ? 'text-teal-600' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>{dp.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handlePrev}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-all text-sm ${
                  isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t('onb_precedent') || 'Précédent'}
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-2.5 rounded-lg font-medium text-white transition-all text-sm"
                style={{ backgroundColor: colors.primary }}
              >
                {t('onb_suivant') || 'Suivant'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Insulin Settings */}
        {step === 3 && (
          <div className={`rounded-3xl ${cardClass} border p-6 space-y-4 animate-fade-in`}>
            <h2 className="text-xl font-bold">{t('onb_params') || 'Paramètres insuline'}</h2>

            <div className="space-y-5">
              {/* Ratio */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium">
                    {t('onb_ratio') || 'Ratio glucides'}
                  </label>
                  <span
                    className="text-sm font-semibold px-2 py-1 rounded-lg"
                    style={{ backgroundColor: `${colors.primary}20`, color: colors.primary }}
                  >
                    1:{ratio}
                  </span>
                </div>
                <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {t('onb_ratio_desc') || '1 unité pour X grammes de glucides'}
                </p>
                <input
                  type="range"
                  min="3"
                  max="30"
                  step="1"
                  value={ratio}
                  onChange={(e) => ratioState(parseInt(e.target.value))}
                  className="w-full"
                  style={{
                    accentColor: colors.primary,
                  }}
                />
              </div>

              {/* ISF */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium">
                    {t('onb_isf') || 'Facteur de sensibilité'}
                  </label>
                  <span
                    className="text-sm font-semibold px-2 py-1 rounded-lg"
                    style={{ backgroundColor: `${colors.primary}20`, color: colors.primary }}
                  >
                    {isf} mg/dL
                  </span>
                </div>
                <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {t('onb_isf_desc') || 'Baisse glycémie (mg/dL) par unité'}
                </p>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={isf}
                  onChange={(e) => isfState(parseInt(e.target.value))}
                  className="w-full"
                  style={{
                    accentColor: colors.primary,
                  }}
                />
              </div>

              {/* Target range */}
              <div>
                <label className="block text-sm font-medium mb-2.5">
                  {t('onb_cible') || 'Glycémie cible (g/L)'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Min
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={targetGMin}
                      onChange={(e) => targetGMinState(parseFloat(e.target.value) || 0.8)}
                      className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:outline-none focus:ring-2 text-sm`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Max
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={targetGMax}
                      onChange={(e) => targetGMaxState(parseFloat(e.target.value) || 1.3)}
                      className={`w-full px-3 py-2 rounded-lg border ${inputClass} focus:outline-none focus:ring-2 text-sm`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Medical disclaimer */}
            <div className={`rounded-2xl p-4 ${isDark ? 'bg-amber-950/40 border border-amber-900' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                ⚕️ {t('valeursEstim') || 'Valeurs estimatives — validez avec votre médecin'}
              </p>
            </div>

            {/* Navigation */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handlePrev}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-all text-sm ${
                  isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t('onb_precedent') || 'Précédent'}
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 py-2.5 rounded-lg font-semibold text-white transition-all text-sm"
                style={{ backgroundColor: colors.primary }}
              >
                {t('onb_terminer') || 'Terminer'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
