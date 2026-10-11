import { useId, useState } from 'react';

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
  setInsulinBasal,
  setInsulinRapid,
  onComplete,
  t,
  isDark,
  colors,
  isRTL = false,
}) {
  const [step, setStep] = useState(1);
  const uid = useId();
  const ids = {
    name: `${uid}-name`,
    age: `${uid}-age`,
    sex: `${uid}-sex`,
    height: `${uid}-height`,
    weight: `${uid}-weight`,
    basal: `${uid}-basal`,
    rapid: `${uid}-rapid`,
    ratio: `${uid}-ratio`,
    ratioDesc: `${uid}-ratio-desc`,
    isf: `${uid}-isf`,
    isfDesc: `${uid}-isf-desc`,
    target: `${uid}-target`,
    targetMin: `${uid}-target-min`,
    targetMax: `${uid}-target-max`,
    accept: `${uid}-accept`,
  };

  // Step 1 - Profile
  const [name, setName] = useState('');
  const [age, ageState] = useState('');
  const [sex, sexState] = useState('M');
  const [height, heightState] = useState('');
  const [weight, weightState] = useState('');
  const [insulinBasalLocal, setInsulinBasalLocal] = useState('Tresiba');
  const [insulinRapidLocal, setInsulinRapidLocal] = useState('NovoRapid');

  // Step 2 - Insulin parameters (plages alignées sur Réglages)
  const RATIO_MIN = 5, RATIO_MAX = 25, RATIO_STEP = 1;
  const ISF_MIN = 20, ISF_MAX = 100, ISF_STEP = 5;
  const [ratio, ratioState] = useState(15);
  const [isf, isfState] = useState(60);
  const [targetGMin, targetGMinState] = useState(1.0);
  const [targetGMax, targetGMaxState] = useState(1.2);

  // Step 3 - Disclaimer
  const [accepted, setAccepted] = useState(false);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleComplete = () => {
    if (!accepted) return;
    if (name) setPatientName(name);
    if (age) setAge(parseInt(age));
    setSex(sex);
    if (height) setHeight(parseFloat(height));
    if (weight) setWeight(parseFloat(weight));
    setRatio(ratio);
    setIsf(isf);
    setTargetGMin(targetGMin);
    setTargetGMax(targetGMax);
    if (setInsulinBasal) setInsulinBasal(insulinBasalLocal);
    if (setInsulinRapid) setInsulinRapid(insulinRapidLocal);
    onComplete();
  };

  const bgClass = isDark ? 'bg-slate-900' : 'bg-[#F7FAFB]';
  const textClass = isDark ? 'text-slate-200' : 'text-slate-800';
  const cardClass = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const inputClass = isDark
    ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-500'
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500';
  const focusClass = 'focus:outline-none focus:ring-2 focus:ring-teal-500';
  const labelClass = `block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const stepLabel = t('onb_step') || 'Étape';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={`min-h-screen ${bgClass} ${textClass} flex items-center justify-center p-3 font-sans`}>
      <div className="w-full max-w-md">
        {/* Step indicators */}
        <ol className="flex justify-center gap-2 mb-8 list-none p-0 m-0" aria-label={`${stepLabel} ${step}/3`}>
          {[1, 2, 3].map((n) => (
            <li
              key={n}
              aria-current={n === step ? 'step' : undefined}
              className={`h-2 rounded-full transition-all ${
                n === step ? 'w-6' : 'w-2 bg-slate-300'
              }`}
              style={{ backgroundColor: n === step ? colors.primary : undefined }}
            >
              <span className="sr-only">{stepLabel} {n}</span>
            </li>
          ))}
        </ol>

        {/* Step 1: Profil */}
        {step === 1 && (
          <div className={`rounded-3xl ${cardClass} border p-6 space-y-4 animate-fade-in`}>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">{t('onb_profil') || 'Votre profil'}</h2>
              <p className={`text-xs ${mutedClass}`}>
                {t('onb_profil_desc') || 'Informations de base et type d\'insuline'}
              </p>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label htmlFor={ids.name} className={labelClass}>{t('onb_prenom') || 'Prénom (optionnel)'}</label>
                <input
                  id={ids.name}
                  type="text"
                  autoComplete="given-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('onb_prenom') || 'Votre prénom'}
                  className={`w-full px-3 py-2.5 rounded-lg border ${inputClass} ${focusClass} text-sm`}
                />
              </div>

              {/* Age + Sex grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={ids.age} className={labelClass}>{t('onb_age') || 'Âge'}</label>
                  <input
                    id={ids.age}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => ageState(e.target.value)}
                    placeholder="25"
                    className={`w-full px-3 py-2.5 rounded-lg border ${inputClass} ${focusClass} text-sm`}
                  />
                </div>
                <div>
                  <p id={ids.sex} className={labelClass}>{t('onb_sexe') || 'Sexe'}</p>
                  <div className="flex gap-2" role="group" aria-labelledby={ids.sex}>
                    {['M', 'F'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={sex === option}
                        onClick={() => sexState(option)}
                        className={`flex-1 py-2.5 rounded-lg font-medium transition-all text-sm ${focusClass} ${
                          sex === option
                            ? 'text-white'
                            : isDark
                            ? 'bg-slate-700 text-slate-300 border border-slate-600'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                        style={{ backgroundColor: sex === option ? colors.primary : undefined }}
                      >
                        {option === 'M' ? (t('homme') || 'H') : (t('femme') || 'F')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Height & Weight grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={ids.height} className={labelClass}>{t('onb_taille') || 'Taille (cm)'}</label>
                  <input
                    id={ids.height}
                    type="number"
                    inputMode="decimal"
                    min="50"
                    max="250"
                    value={height}
                    onChange={(e) => heightState(e.target.value)}
                    placeholder="170"
                    className={`w-full px-3 py-2.5 rounded-lg border ${inputClass} ${focusClass} text-sm`}
                  />
                </div>
                <div>
                  <label htmlFor={ids.weight} className={labelClass}>{t('onb_poids') || 'Poids (kg)'}</label>
                  <input
                    id={ids.weight}
                    type="number"
                    inputMode="decimal"
                    min="15"
                    max="300"
                    value={weight}
                    onChange={(e) => weightState(e.target.value)}
                    placeholder="70"
                    className={`w-full px-3 py-2.5 rounded-lg border ${inputClass} ${focusClass} text-sm`}
                  />
                </div>
              </div>

              {/* Insulin types */}
              <div>
                <label htmlFor={ids.basal} className={labelClass}>💉 {t('cl_insulineBasale') || 'Insuline basale'}</label>
                <input
                  id={ids.basal}
                  type="text"
                  value={insulinBasalLocal}
                  onChange={(e) => setInsulinBasalLocal(e.target.value)}
                  placeholder="Tresiba, Lantus, Toujeo…"
                  className={`w-full px-3 py-2.5 rounded-lg border ${inputClass} ${focusClass} text-sm`}
                />
              </div>
              <div>
                <label htmlFor={ids.rapid} className={labelClass}>⚡ {t('cl_insulineRapide') || 'Insuline rapide'}</label>
                <input
                  id={ids.rapid}
                  type="text"
                  value={insulinRapidLocal}
                  onChange={(e) => setInsulinRapidLocal(e.target.value)}
                  placeholder="NovoRapid, Humalog, Apidra…"
                  className={`w-full px-3 py-2.5 rounded-lg border ${inputClass} ${focusClass} text-sm`}
                />
              </div>
            </div>

            {/* Navigation */}
            <button
              type="button"
              onClick={handleNext}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all text-sm ${focusClass}`}
              style={{ backgroundColor: colors.primary }}
            >
              {t('onb_suivant') || 'Suivant'}
            </button>
          </div>
        )}

        {/* Step 2: Paramètres insuline */}
        {step === 2 && (
          <div className={`rounded-3xl ${cardClass} border p-6 space-y-4 animate-fade-in`}>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">{t('onb_params') || 'Paramètres insuline'}</h2>
              <p className={`text-xs ${mutedClass}`}>
                {t('onb_params_desc') || 'Valeurs pré-remplies — modifiables plus tard'}
              </p>
            </div>

            <div className="space-y-5">
              {/* Ratio */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor={ids.ratio} className="text-sm font-medium">
                    {t('onb_ratio') || 'Ratio glucides'}
                  </label>
                  <output
                    htmlFor={ids.ratio}
                    className="text-sm font-semibold px-2 py-1 rounded-lg"
                    style={{ backgroundColor: `${colors.primary}20`, color: colors.primary }}
                  >
                    1:{ratio}
                  </output>
                </div>
                <p id={ids.ratioDesc} className={`text-xs mb-2 ${mutedClass}`}>
                  {t('onb_ratio_desc') || '1 unité pour X grammes de glucides'}
                </p>
                <input
                  id={ids.ratio}
                  type="range"
                  min={RATIO_MIN}
                  max={RATIO_MAX}
                  step={RATIO_STEP}
                  value={ratio}
                  aria-describedby={ids.ratioDesc}
                  aria-valuetext={`1:${ratio}`}
                  onChange={(e) => ratioState(parseInt(e.target.value))}
                  className="w-full"
                  style={{ accentColor: colors.primary }}
                />
              </div>

              {/* ISF */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor={ids.isf} className="text-sm font-medium">
                    {t('onb_isf') || 'Facteur de sensibilité'}
                  </label>
                  <output
                    htmlFor={ids.isf}
                    className="text-sm font-semibold px-2 py-1 rounded-lg"
                    style={{ backgroundColor: `${colors.primary}20`, color: colors.primary }}
                  >
                    {isf} mg/dL
                  </output>
                </div>
                <p id={ids.isfDesc} className={`text-xs mb-2 ${mutedClass}`}>
                  {t('onb_isf_desc') || 'Baisse glycémie (mg/dL) par unité'}
                </p>
                <input
                  id={ids.isf}
                  type="range"
                  min={ISF_MIN}
                  max={ISF_MAX}
                  step={ISF_STEP}
                  value={isf}
                  aria-describedby={ids.isfDesc}
                  aria-valuetext={`${isf} mg/dL`}
                  onChange={(e) => isfState(parseInt(e.target.value))}
                  className="w-full"
                  style={{ accentColor: colors.primary }}
                />
              </div>

              {/* Target range */}
              <fieldset>
                <legend className="block text-sm font-medium mb-2.5">
                  {t('onb_cible') || 'Glycémie cible (g/L)'}
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={ids.targetMin} className={`block text-xs mb-1.5 ${mutedClass}`}>
                      {t('cibleMin') || 'Min (g/L)'}
                    </label>
                    <input
                      id={ids.targetMin}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={targetGMin}
                      onChange={(e) => targetGMinState(parseFloat(e.target.value) || 1.0)}
                      className={`w-full px-3 py-2 rounded-lg border ${inputClass} ${focusClass} text-sm`}
                    />
                  </div>
                  <div>
                    <label htmlFor={ids.targetMax} className={`block text-xs mb-1.5 ${mutedClass}`}>
                      {t('cibleMax') || 'Max (g/L)'}
                    </label>
                    <input
                      id={ids.targetMax}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={targetGMax}
                      onChange={(e) => targetGMaxState(parseFloat(e.target.value) || 1.2)}
                      className={`w-full px-3 py-2 rounded-lg border ${inputClass} ${focusClass} text-sm`}
                    />
                  </div>
                </div>
              </fieldset>
            </div>

            {/* Navigation */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handlePrev}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-all text-sm ${focusClass} ${
                  isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t('onb_precedent') || 'Précédent'}
              </button>
              <button
                type="button"
                onClick={handleNext}
                className={`flex-1 py-2.5 rounded-lg font-medium text-white transition-all text-sm ${focusClass}`}
                style={{ backgroundColor: colors.primary }}
              >
                {t('onb_suivant') || 'Suivant'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Disclaimer */}
        {step === 3 && (
          <div className={`rounded-3xl ${cardClass} border p-6 space-y-5 animate-fade-in`}>
            <div className="text-center space-y-2">
              <div className="text-4xl" aria-hidden="true">⚕️</div>
              <h2 className="text-xl font-bold">{t('onb_disclaimer_title') || 'Avertissement médical'}</h2>
            </div>

            <div className={`rounded-2xl p-4 space-y-3 ${isDark ? 'bg-red-950/30 border border-red-900/40' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm font-semibold ${isDark ? 'text-red-300' : 'text-red-800'}`}>
                {t('onb_disclaimer_head') || 'Cet outil ne remplace pas un suivi médical'}
              </p>
              <ul className={`text-xs space-y-1.5 list-disc list-inside ${isDark ? 'text-red-300' : 'text-red-800'}`}>
                <li>{t('onb_disc_1') || 'Les doses calculées sont des suggestions basées sur vos paramètres.'}</li>
                <li>{t('onb_disc_2') || 'Validez toujours les doses avec votre diabétologue ou médecin traitant.'}</li>
                <li>{t('onb_disc_3') || 'En cas de doute ou symptôme inhabituel, consultez un professionnel de santé.'}</li>
                <li>{t('onb_disc_4') || 'Ne modifiez jamais votre traitement sans avis médical.'}</li>
              </ul>
            </div>

            {/* Mandatory acceptance */}
            <button
              type="button"
              role="checkbox"
              aria-checked={accepted}
              aria-labelledby={ids.accept}
              onClick={() => setAccepted(!accepted)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-start transition ${focusClass} ${
                accepted
                  ? isDark ? 'border-teal-600 bg-teal-900/20' : 'border-teal-400 bg-teal-50'
                  : isDark ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-white'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition ${
                  accepted
                    ? 'bg-teal-500 border-teal-500'
                    : isDark ? 'border-slate-500' : 'border-slate-300'
                }`}
              >
                {accepted && <span className="text-white text-xs font-bold">✓</span>}
              </span>
              <span id={ids.accept} className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {t('onb_accept') || 'Je comprends que cet outil est une aide au calcul et non un dispositif médical certifié. J\'utilise ces données sous ma propre responsabilité.'}
              </span>
            </button>

            {/* Navigation */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrev}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-all text-sm ${focusClass} ${
                  isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t('onb_precedent') || 'Précédent'}
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={!accepted}
                aria-disabled={!accepted}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-white transition-all text-sm ${focusClass} ${
                  !accepted ? 'opacity-40 cursor-not-allowed' : ''
                }`}
                style={{ backgroundColor: !accepted ? (isDark ? '#374151' : '#9ca3af') : colors.primary }}
              >
                {t('onb_terminer') || 'Commencer'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in { animation: none; }
        }
      `}</style>
    </div>
  );
}
