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
  t, isDark
}) {
  const [mode, setMode] = useState('expert'); // 'expert' | 'assiste'
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mealPhoto, setMealPhoto] = useState(null);
  const cameraRef = useRef(null);
  const albumRef = useRef(null);

  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMealPhoto(url);
    if (onPhotoMeal) onPhotoMeal(file);
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

  const fatLabels = { aucun: 'Aucun', faible: 'Faible', moyen: 'Moyen', 'élevé': 'Élevé' };

  return (
    <div className={cardClass}>
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between mb-2">
        <label className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
          🍽 {t('monRepas') || 'Repas'}
        </label>
        <div className={`flex rounded-xl overflow-hidden border ${isDark ? 'border-slate-600' : 'border-gray-200'}`}>
          <button
            onClick={() => setMode('expert')}
            className={`px-3 py-1 text-[11px] font-medium transition ${
              mode === 'expert'
                ? 'bg-teal-500 text-white'
                : isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-50 text-gray-500'
            }`}
          >
            {t('cl_modeExpert') || 'Expert'}
          </button>
          <button
            onClick={() => setMode('assiste')}
            className={`px-3 py-1 text-[11px] font-medium transition ${
              mode === 'assiste'
                ? 'bg-teal-500 text-white'
                : isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-50 text-gray-500'
            }`}
          >
            {t('cl_modeAssiste') || 'Assisté'}
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
              title="Prendre une photo"
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
              title="Choisir depuis l'album"
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

          {/* Photo preview */}
          {mealPhoto && (
            <div className="relative">
              <img src={mealPhoto} alt="Photo repas" className="w-full h-32 object-cover rounded-xl" />
              <button onClick={() => setMealPhoto(null)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">✕</button>
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
        </div>
      )}
    </div>
  );
}
