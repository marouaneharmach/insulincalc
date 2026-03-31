import { useState, useMemo, useRef } from 'react';

const FAT_LEVELS = [
  { value: 'aucun', labelKey: 'cl_aucune', fallback: 'Aucun' },
  { value: 'faible', labelKey: null, fallback: 'Faible' },
  { value: 'moyen', labelKey: null, fallback: 'Moyen' },
  { value: 'élevé', labelKey: null, fallback: 'Élevé' },
];

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function MealInput({
  totalCarbs, setTotalCarbs,
  fatLevel, setFatLevel,
  foods = [],
  selections = [],
  toggleFood,
  updateMult,
  customFoods = [],
  onPhotoMeal,
  t, isDark,
  totalFatGrams = 0
}) {
  const [mode, setMode] = useState('assiste'); // 'assiste' | 'expert'
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mealPhoto, setMealPhoto] = useState(null);
  const [photoResults, setPhotoResults] = useState(null); // null=no photo, []=empty results, [...]= results
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const cameraRef = useRef(null);
  const albumRef = useRef(null);

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMealPhoto(url);
    setPhotoResults(null);
    setPhotoError('');
    setPhotoLoading(true);
    try {
      const mapped = onPhotoMeal ? await onPhotoMeal(file) : [];
      setPhotoResults(mapped || []);
    } catch (err) {
      console.error('[PhotoMeal]', err);
      setPhotoError(err.message || 'Erreur lors de la reconnaissance');
      setPhotoResults([]);
    } finally {
      setPhotoLoading(false);
    }
  };

  const clearPhoto = () => {
    setMealPhoto(null);
    setPhotoResults(null);
    setPhotoLoading(false);
    setPhotoError('');
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;
  const labelClass = `text-[10px] uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`;
  const inputClass = `w-full p-2.5 rounded-xl border outline-none text-sm transition ${isDark ? 'bg-slate-700 border-slate-600 text-white focus:border-teal-500' : 'bg-gray-50 border-gray-200 focus:border-teal-400'}`;

  // Combine foods + customFoods for search
  const allFoods = useMemo(() => {
    return [...foods, ...customFoods];
  }, [foods, customFoods]);

  // Filtered suggestions based on search query
  const suggestions = useMemo(() => {
    const q = stripDiacritics(search.trim().toLowerCase());
    if (q.length < 2) return [];
    return allFoods
      .filter(f => stripDiacritics(f.name.toLowerCase()).includes(q))
      .slice(0, 10);
  }, [search, allFoods]);

  const handleSearchFocus = () => setShowSuggestions(true);
  const handleSearchBlur = () => setTimeout(() => setShowSuggestions(false), 150);

  const handleSelectFood = (food) => {
    toggleFood(food);
    setSearch('');
    setShowSuggestions(false);
  };

  const fatLabels = { aucun: t('fatAucun') || 'Aucun', faible: t('fatFaible') || 'Faible', moyen: t('fatMoyen') || 'Moyen', 'élevé': t('fatEleve') || 'Élevé' };

  return (
    <div className={cardClass}>
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between mb-2">
        <label className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
          🍽 {t('monRepas') || 'Repas'}
        </label>
        <div className={`flex rounded-xl overflow-hidden border ${isDark ? 'border-slate-600' : 'border-gray-200'}`}>
          <button
            onClick={() => setMode('assiste')}
            className={`px-3 py-1 text-[11px] font-medium transition ${
              mode === 'assiste'
                ? 'bg-teal-500 text-white'
                : isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-50 text-gray-500'
            }`}
          >
            {t('cl_modeAssiste') || 'Aliments'}
          </button>
          <button
            onClick={() => setMode('expert')}
            className={`px-3 py-1 text-[11px] font-medium transition ${
              mode === 'expert'
                ? 'bg-teal-500 text-white'
                : isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-50 text-gray-500'
            }`}
          >
            {t('cl_modeExpert') || 'Glucides'}
          </button>
        </div>
      </div>

      {/* Expert mode: direct carbs + fat level */}
      {mode === 'expert' && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>{t('cl_glucidesTotal') || 'Glucides totaux (g)'}</label>
            <input
              type="number"
              step="1"
              min="0"
              max="500"
              inputMode="numeric"
              placeholder="0"
              value={totalCarbs}
              onChange={e => setTotalCarbs(e.target.value)}
              className={`${inputClass} text-center text-xl font-bold`}
            />
          </div>

          <div>
            <label className={labelClass}>{t('cl_niveauGras') || 'Niveau de gras'}</label>
            <div className="flex gap-1">
              {Object.entries(fatLabels).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFatLevel(val)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition border ${
                    fatLevel === val
                      ? 'border-purple-400 bg-purple-50 text-purple-700' + (isDark ? ' !bg-purple-900/30 !text-purple-400' : '')
                      : isDark
                        ? 'border-slate-600 bg-slate-700 text-slate-400 hover:bg-slate-600'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assisted mode: food search + photo */}
      {mode === 'assiste' && (
        <div className="space-y-3">
          {/* Search + photo button */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="search"
                placeholder={`🔍 ${t('rechercherAliment') || 'Rechercher un aliment...'}`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                className={`${inputClass}`}
              />
              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className={`absolute z-10 w-full mt-1 rounded-xl border shadow-lg overflow-hidden ${
                  isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'
                }`}>
                  {suggestions.map(food => (
                    <button
                      key={food.id}
                      onMouseDown={() => handleSelectFood(food)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition ${
                        isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-50 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{food.name}</span>
                      <span className={`ml-2 text-xs font-bold shrink-0 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                        {food.carbs}g
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => cameraRef.current?.click()}
              title={t('prendreUnePhoto') || 'Prendre une photo'}
              className={`px-3 py-2.5 rounded-xl border transition ${
                isDark
                  ? 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              📷
            </button>
            <button
              onClick={() => albumRef.current?.click()}
              title={t('choisirDepuisAlbum') || "Choisir depuis l'album"}
              className={`px-3 py-2.5 rounded-xl border transition ${
                isDark
                  ? 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              🖼️
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhotoCapture} className="hidden" />
            <input ref={albumRef} type="file" accept="image/*"
              onChange={handlePhotoCapture} className="hidden" />
          </div>

          {/* Photo preview + recognition results */}
          {mealPhoto && (
            <div>
              <div className="relative">
                <img src={mealPhoto} alt="Photo repas" className="w-full h-32 object-cover rounded-xl" />
                <button onClick={clearPhoto}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">✕</button>
              </div>

              {/* Loading */}
              {photoLoading && (
                <div className="flex items-center gap-2 mt-2 py-2">
                  <div className="animate-spin w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full" />
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('analyseEnCours') || 'Analyse en cours...'}
                  </span>
                </div>
              )}

              {/* Error */}
              {photoError && !photoLoading && (
                <div className={`mt-2 p-3 rounded-xl border ${isDark ? 'border-red-800 bg-red-900/20' : 'border-red-200 bg-red-50'}`}>
                  <p className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    ❌ Erreur reconnaissance
                  </p>
                  <p className={`text-[10px] mt-1 break-all ${isDark ? 'text-red-300/70' : 'text-red-500/70'}`}>
                    {photoError}
                  </p>
                </div>
              )}

              {/* No results (but no error) */}
              {photoResults !== null && photoResults.length === 0 && !photoLoading && !photoError && (
                <div className={`mt-2 p-3 rounded-xl text-center border border-dashed ${isDark ? 'border-slate-600 bg-slate-700/30' : 'border-gray-200 bg-gray-50'}`}>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    😕 {t('aucunAlimentReconnu') || 'Aucun aliment reconnu'}
                  </p>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t('essayerAutrePhoto') || 'Essayez avec une autre photo ou ajoutez manuellement'}
                  </p>
                </div>
              )}

              {/* Recognition results */}
              {photoResults !== null && photoResults.length > 0 && !photoLoading && (
                <div className="mt-2">
                  <p className={`text-[10px] mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {photoResults.length} {t('alimentsDetectes') || 'aliment(s) détecté(s)'} — {t('tapPourAjouter') || 'Tapez pour ajouter au repas'}
                  </p>
                  <div className="space-y-1">
                    {photoResults.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => item.mapped && toggleFood(item.localFood)}
                        disabled={!item.mapped}
                        className={`w-full flex items-center gap-2 p-2 rounded-xl text-left transition ${
                          item.mapped
                            ? isDark ? 'hover:bg-teal-900/20 border border-slate-700' : 'hover:bg-teal-50 border border-gray-100'
                            : 'opacity-50 cursor-not-allowed border border-dashed ' + (isDark ? 'border-slate-700' : 'border-gray-200')
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          item.confidence >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          item.confidence >= 50 ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {item.confidence}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium capitalize truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {item.nameFr || item.name}
                          </p>
                          {item.mapped ? (
                            <p className={`text-[10px] truncate ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                              → {item.localFood.name} ({item.localFood.carbs}g {t('cl_glucides') || 'glucides'})
                            </p>
                          ) : (
                            <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                              {t('nonTrouveDansBase') || 'non trouvé dans la base'}
                            </p>
                          )}
                        </div>
                        {item.mapped && (
                          <span className={`text-xs font-bold shrink-0 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                            + {item.localFood.carbs}g
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fat level selector */}
          <div>
            <label className={labelClass}>{t('cl_niveauGras') || 'Niveau de gras'}</label>
            <div className="flex gap-1">
              {Object.entries(fatLabels).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFatLevel(val)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition border ${
                    fatLevel === val
                      ? 'border-purple-400 bg-purple-50 text-purple-700' + (isDark ? ' !bg-purple-900/30 !text-purple-400' : '')
                      : isDark
                        ? 'border-slate-600 bg-slate-700 text-slate-400 hover:bg-slate-600'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected foods list */}
      {selections.length > 0 && (
        <div className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
          <div className="space-y-1">
            {selections.map(s => (
              <div key={s.food.id} className={`flex items-center gap-2 py-1.5 px-2 rounded-xl ${
                isDark ? 'bg-slate-700/50' : 'bg-gray-50'
              }`}>
                <p className={`flex-1 text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {s.food.name}
                </p>
                <span className={`text-xs font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                  {Math.round(s.food.carbs * (s.mult || 1))}g
                </span>
                <button
                  onClick={() => toggleFood(s.food)}
                  className={`text-sm transition ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Total carbs summary */}
          <div className={`flex items-center justify-between mt-2 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('totalGlucides') || 'Total glucides'}
            </span>
            <span className={`text-lg font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              {selections.reduce((sum, s) => sum + Math.round(s.food.carbs * (s.mult || 1)), 0)}g
            </span>
          </div>

          {/* Total fat summary */}
          {totalFatGrams > 0 && (
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('totalLipides') || 'Total lipides'}
              </span>
              <span className={`text-lg font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                ~{totalFatGrams}g
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
