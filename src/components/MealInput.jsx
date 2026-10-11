import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { deriveFatLevel } from '../utils/foodRecognition';

const FAT_LEVELS = [
  { value: 'aucun', labelKey: 'cl_aucune', fallback: 'Aucun' },
  { value: 'faible', labelKey: null, fallback: 'Faible' },
  { value: 'moyen', labelKey: null, fallback: 'Moyen' },
  { value: 'élevé', labelKey: null, fallback: 'Élevé' },
];

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Traduction avec repli : `t` renvoie la clé elle-même lorsqu'elle est absente. */
function tr(t, key, fallback) {
  const value = t?.(key);
  return value && value !== key ? value : fallback;
}

export default function MealInput({
  totalCarbs, setTotalCarbs,
  fatLevel, setFatLevel,
  foods = [],
  selections = [],
  toggleFood,
  customFoods = [],
  onPhotoMeal,
  onSaveCustomFood,
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
  const [editingItem, setEditingItem] = useState(null); // AI edit modal state
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [saveAsCustom, setSaveAsCustom] = useState(false);
  const cameraRef = useRef(null);
  const albumRef = useRef(null);
  const modalCloseRef = useRef(null);
  const uid = useId();
  const ids = {
    title: `${uid}-title`,
    carbs: `${uid}-carbs`,
    fatLabel: `${uid}-fat`,
    search: `${uid}-search`,
    modalTitle: `${uid}-modal-title`,
    editCarbs: `${uid}-edit-carbs`,
    editFat: `${uid}-edit-fat`,
    editWeight: `${uid}-edit-weight`,
  };

  // Modale d'édition IA : focus initial sur le premier bouton + fermeture par Échap.
  useEffect(() => {
    if (!editingItem) return undefined;
    modalCloseRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditingItem(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editingItem]);

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
      setPhotoError(err.message || tr(t, 'erreurReconnaissance', 'Erreur lors de la reconnaissance'));
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
  const labelClass = `text-xs uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const inputClass = `w-full p-2.5 rounded-xl border outline-none text-sm transition focus-visible:ring-2 focus-visible:ring-teal-500 ${isDark ? 'bg-slate-700 border-slate-600 text-white focus:border-teal-500' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-teal-400'}`;
  const modalInputClass = `w-full text-center font-bold p-2 rounded-xl border outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-200 text-slate-900'}`;
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const tealText = isDark ? 'text-teal-400' : 'text-teal-700';
  const purpleText = isDark ? 'text-purple-400' : 'text-purple-700';
  const iconBtnClass = `px-3 py-2.5 rounded-xl border transition outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
    isDark
      ? 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600'
      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
  }`;

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
  const carbsWord = t?.('cl_glucides') || 'glucides';
  const fatGramsWord = t?.('fatGramsLabel') || 'g de lipides';
  const estimationIA = t?.('estimationIA') || 'estimation IA';
  const fatLevelLabel = t('cl_niveauGras') || 'Niveau de gras';

  const renderFatSelector = (groupId) => (
    <div>
      <p id={groupId} className={labelClass}>{fatLevelLabel}</p>
      <div className="flex gap-1" role="group" aria-labelledby={groupId}>
        {Object.entries(fatLabels).map(([val, label]) => (
          <button
            key={val}
            type="button"
            aria-pressed={fatLevel === val}
            onClick={() => setFatLevel(val)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition border outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
              fatLevel === val
                ? 'border-purple-400 bg-purple-50 text-purple-800' + (isDark ? ' !bg-purple-900/30 !text-purple-300' : '')
                : isDark
                  ? 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className={cardClass} aria-labelledby={ids.title}>
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between mb-2">
        <h3 id={ids.title} className={`text-xs uppercase tracking-wider font-semibold ${tealText}`}>
          🍽 {t('monRepas') || 'Repas'}
        </h3>
        <div
          role="group"
          aria-label={tr(t, 'modeSaisie', 'Mode de saisie')}
          className={`flex rounded-xl overflow-hidden border ${isDark ? 'border-slate-600' : 'border-gray-200'}`}
        >
          <button
            type="button"
            aria-pressed={mode === 'assiste'}
            onClick={() => setMode('assiste')}
            className={`px-3 py-1 text-xs font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400 ${
              mode === 'assiste'
                ? 'bg-teal-600 text-white'
                : isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-50 text-gray-600'
            }`}
          >
            {t('cl_modeAssiste') || 'Aliments'}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'expert'}
            onClick={() => setMode('expert')}
            className={`px-3 py-1 text-xs font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400 ${
              mode === 'expert'
                ? 'bg-teal-600 text-white'
                : isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-50 text-gray-600'
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
            <label htmlFor={ids.carbs} className={labelClass}>{t('cl_glucidesTotal') || 'Glucides totaux (g)'}</label>
            <input
              id={ids.carbs}
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

          {renderFatSelector(`${ids.fatLabel}-expert`)}
        </div>
      )}

      {/* Assisted mode: food search + photo */}
      {mode === 'assiste' && (
        <div className="space-y-3">
          {/* Search + photo button */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <label htmlFor={ids.search} className="sr-only">{t('rechercherAliment') || 'Rechercher un aliment...'}</label>
              <input
                id={ids.search}
                type="search"
                autoComplete="off"
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
                      type="button"
                      onMouseDown={() => handleSelectFood(food)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-start text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
                        isDark ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-50 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{food.name}</span>
                      <span className={`ml-2 text-xs font-bold shrink-0 ${tealText}`}>
                        {food.carbs}g
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              title={t('prendreUnePhoto') || 'Prendre une photo'}
              aria-label={t('prendreUnePhoto') || 'Prendre une photo'}
              className={iconBtnClass}
            >
              <span aria-hidden="true">📷</span>
            </button>
            <button
              type="button"
              onClick={() => albumRef.current?.click()}
              title={t('choisirDepuisAlbum') || "Choisir depuis l'album"}
              aria-label={t('choisirDepuisAlbum') || "Choisir depuis l'album"}
              className={iconBtnClass}
            >
              <span aria-hidden="true">🖼️</span>
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhotoCapture} className="hidden" tabIndex={-1} aria-hidden="true" />
            <input ref={albumRef} type="file" accept="image/*"
              onChange={handlePhotoCapture} className="hidden" tabIndex={-1} aria-hidden="true" />
          </div>

          {/* Photo preview + recognition results */}
          {mealPhoto && (
            <div>
              <div className="relative">
                <img src={mealPhoto} alt={t?.('photoRepas') || 'Photo repas'} className="w-full h-32 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  aria-label={t?.('effacer') || 'Effacer'}
                  title={t?.('effacer') || 'Effacer'}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white text-xs flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>

              {/* Loading */}
              {photoLoading && (
                <div className="flex items-center gap-2 mt-2 py-2" role="status" aria-live="polite">
                  <div className="animate-spin w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full" aria-hidden="true" />
                  <span className={`text-xs ${mutedClass}`}>
                    {t('analyseEnCours') || 'Analyse en cours...'}
                  </span>
                </div>
              )}

              {/* Error */}
              {photoError && !photoLoading && (
                <div role="alert" className={`mt-2 p-3 rounded-xl border ${isDark ? 'border-red-800 bg-red-900/20' : 'border-red-200 bg-red-50'}`}>
                  <p className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                    ❌ {tr(t, 'erreurReconnaissance', 'Erreur de reconnaissance')}
                  </p>
                  <p className={`text-xs mt-1 break-all ${isDark ? 'text-red-300/80' : 'text-red-700/80'}`}>
                    {photoError}
                  </p>
                </div>
              )}

              {/* No results (but no error) */}
              {photoResults !== null && photoResults.length === 0 && !photoLoading && !photoError && (
                <div role="status" className={`mt-2 p-3 rounded-xl text-center border border-dashed ${isDark ? 'border-slate-600 bg-slate-700/30' : 'border-gray-200 bg-gray-50'}`}>
                  <p className={`text-sm ${mutedClass}`}>
                    😕 {t('aucunAlimentReconnu') || 'Aucun aliment reconnu'}
                  </p>
                  <p className={`text-xs mt-1 ${mutedClass}`}>
                    {t('essayerAutrePhoto') || 'Essayez avec une autre photo ou ajoutez manuellement'}
                  </p>
                </div>
              )}

              {/* Recognition results */}
              {photoResults !== null && photoResults.length > 0 && !photoLoading && (
                <div className="mt-2">
                  <p className={`text-xs mb-1.5 ${mutedClass}`}>
                    {photoResults.length} {t?.('alimentsDetectes') || 'aliment(s) détecté(s)'} — {t?.('tapPourAjouter') || 'Tapez pour ajouter au repas'}
                  </p>
                  <div className="space-y-1">
                    {photoResults.map((item, i) => {
                      const canAdd = item.mapped || item.estimatedCarbs != null;
                      const carbsDisplay = item.mapped ? item.localFood.carbs : item.estimatedCarbs;
                      const fatDisplay = item.mapped ? null : item.estimatedFat;
                      const isImplausible = item.estimatedCarbs != null && (item.estimatedCarbs > 150 || item.estimatedFat > 80);

                      return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (item.mapped) {
                            toggleFood(item.localFood);
                          } else if (item.estimatedCarbs != null) {
                            // Open edit modal for AI-estimated food
                            setEditingItem(item);
                            setEditCarbs(String(Math.round(item.estimatedCarbs)));
                            setEditFat(String(Math.round(item.estimatedFat ?? 0)));
                            setEditWeight(String(item.estimatedWeight ?? ''));
                            setSaveAsCustom(false);
                          }
                        }}
                        disabled={!canAdd}
                        className={`w-full flex items-center gap-2 p-2 rounded-xl text-start transition outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                          canAdd
                            ? isDark ? 'hover:bg-teal-900/20 border border-slate-700' : 'hover:bg-teal-50 border border-gray-100'
                            : 'opacity-60 cursor-not-allowed border border-dashed ' + (isDark ? 'border-slate-700' : 'border-gray-200')
                        }`}
                      >
                        {/* Confidence badge */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          item.confidence >= 80 ? 'bg-emerald-100 text-emerald-800' :
                          item.confidence >= 50 ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {item.confidence}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className={`text-sm font-medium capitalize truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                              {item.nameFr || item.name}
                            </p>
                            {/* Source badge */}
                            {item.mapped ? (
                              <span className="text-xs px-1 py-0.5 rounded bg-teal-100 text-teal-800 shrink-0">DB</span>
                            ) : item.estimatedCarbs != null ? (
                              <span className="text-xs px-1 py-0.5 rounded bg-purple-100 text-purple-800 shrink-0" title={estimationIA}>IA</span>
                            ) : null}
                          </div>
                          {item.mapped ? (
                            <p className={`text-xs truncate ${tealText}`}>
                              → {item.localFood.name} ({item.localFood.carbs}g {carbsWord})
                            </p>
                          ) : item.estimatedCarbs != null ? (
                            <p className={`text-xs ${purpleText}`}>
                              ~{Math.round(item.estimatedCarbs)} g {carbsWord}
                              {item.estimatedFat != null && ` · ~${Math.round(item.estimatedFat)} ${fatGramsWord}`}
                              {isImplausible && (
                                <span className="ml-1 text-amber-600" role="img" aria-label={t?.('valeurImplausible') || 'Valeurs inhabituelles — vérifiez les estimations'}>⚠️</span>
                              )}
                            </p>
                          ) : (
                            <p className={`text-xs ${mutedClass}`}>
                              {t?.('nonTrouveDansBase') || 'non trouvé dans la base'}
                            </p>
                          )}
                        </div>
                        {canAdd && carbsDisplay != null && (
                          <div className="text-end shrink-0">
                            <span className={`text-xs font-bold block ${item.mapped ? tealText : purpleText}`}>
                              + {Math.round(carbsDisplay)}g
                            </span>
                            {fatDisplay != null && (
                              <span className={`text-xs block ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
                                {Math.round(fatDisplay)} {fatGramsWord}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Edit Modal */}
              {editingItem && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setEditingItem(null)}>
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={ids.modalTitle}
                    className={`w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 id={ids.modalTitle} className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {editingItem.nameFr || editingItem.name}
                        <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">{estimationIA}</span>
                      </h3>
                      <button
                        type="button"
                        ref={modalCloseRef}
                        onClick={() => setEditingItem(null)}
                        aria-label={t?.('fermer') || 'Fermer'}
                        className={`text-lg px-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}
                      >
                        <span aria-hidden="true">✕</span>
                      </button>
                    </div>

                    {/* Plausibility warning */}
                    {(parseFloat(editCarbs) > 150 || parseFloat(editFat) > 80) && (
                      <div role="alert" className={`mb-3 p-2 rounded-xl text-xs ${isDark ? 'bg-amber-900/20 text-amber-300 border border-amber-800' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                        ⚠️ {t?.('valeurImplausible') || 'Valeurs inhabituelles — vérifiez les estimations'}
                      </div>
                    )}

                    {/* Editable fields */}
                    <div className="space-y-3">
                      <div>
                        <label htmlFor={ids.editCarbs} className={`text-xs block mb-1 ${mutedClass}`}>
                          {t?.('cl_glucides') || 'Glucides'} (g)
                        </label>
                        <input id={ids.editCarbs} type="number" step="1" min="0" max="500" inputMode="numeric" value={editCarbs}
                          onChange={e => setEditCarbs(e.target.value)}
                          className={`${modalInputClass} text-xl`} />
                      </div>
                      <div>
                        <label htmlFor={ids.editFat} className={`text-xs block mb-1 ${mutedClass}`}>
                          {t?.('totalLipides') || 'Lipides'} (g)
                        </label>
                        <input id={ids.editFat} type="number" step="1" min="0" max="200" inputMode="numeric" value={editFat}
                          onChange={e => setEditFat(e.target.value)}
                          className={`${modalInputClass} text-xl`} />
                      </div>
                      <div>
                        <label htmlFor={ids.editWeight} className={`text-xs block mb-1 ${mutedClass}`}>
                          {t?.('poidsEstime') || 'Poids estimé'} (g)
                        </label>
                        <input id={ids.editWeight} type="number" step="10" min="0" inputMode="numeric" value={editWeight}
                          onChange={e => setEditWeight(e.target.value)}
                          className={`${modalInputClass} text-lg font-normal`} />
                      </div>

                      {/* Save as custom food checkbox */}
                      <label className={`flex items-center gap-2 text-xs cursor-pointer ${mutedClass}`}>
                        <input type="checkbox" checked={saveAsCustom} onChange={e => setSaveAsCustom(e.target.checked)}
                          className="w-4 h-4 rounded" />
                        {t?.('sauvegarderAlimentPerso') || 'Sauvegarder comme aliment personnalisé'}
                      </label>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => setEditingItem(null)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-700'}`}
                      >
                        {t?.('annuler') || 'Annuler'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const carbs = Math.max(0, Math.round(parseFloat(editCarbs) || 0));
                          const fat = Math.max(0, Math.round(parseFloat(editFat) || 0));
                          const weight = Math.round(parseFloat(editWeight) || 0);
                          const aiFood = {
                            id: `ai_${editingItem.nameFr}_${Date.now()}`,
                            name: `${editingItem.nameFr} (IA)`,
                            carbs,
                            fat: deriveFatLevel(fat),
                            gi: editingItem.estimatedGI || 'moyen',
                            unit: weight > 0 ? `~${weight}g (estimation IA)` : '(estimation IA)',
                            qty: 'plat',
                            note: `Estimation IA ajustée — glucides: ${carbs}g, lipides: ${fat}g`,
                            aiEstimated: true,
                          };
                          toggleFood(aiFood);
                          // Save as custom food if checked
                          if (saveAsCustom && onSaveCustomFood) {
                            onSaveCustomFood({
                              ...aiFood,
                              id: `custom_${editingItem.nameFr}_${Date.now()}`,
                              name: editingItem.nameFr,
                              aiEstimated: false,
                            });
                          }
                          setEditingItem(null);
                        }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 transition outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2"
                      >
                        {t?.('ajouterAuRepas') || 'Ajouter au repas'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fat level selector */}
          {renderFatSelector(`${ids.fatLabel}-assiste`)}
        </div>
      )}

      {/* Selected foods list */}
      {selections.length > 0 && (
        <div className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
          <ul className="space-y-1 list-none p-0 m-0" aria-label={t('monRepas') || 'Repas'}>
            {selections.map(s => (
              <li key={s.food.id} className={`flex items-center gap-2 py-1.5 px-2 rounded-xl ${
                isDark ? 'bg-slate-700/50' : 'bg-gray-50'
              }`}>
                <p className={`flex-1 text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {s.food.name}
                </p>
                <span className={`text-xs font-bold ${tealText}`}>
                  {Math.round(s.food.carbs * (s.mult || 1))}g
                </span>
                <button
                  type="button"
                  onClick={() => toggleFood(s.food)}
                  aria-label={`${t('supprimer') || 'Supprimer'} ${s.food.name}`}
                  className={`text-base leading-none px-1.5 py-0.5 rounded transition outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${isDark ? 'text-slate-400 hover:text-red-400' : 'text-gray-500 hover:text-red-600'}`}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>

          {/* Total carbs summary */}
          <div className={`flex items-center justify-between mt-2 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <span className={`text-xs ${mutedClass}`}>
              {t('totalGlucides') || 'Total glucides'}
            </span>
            <span className={`text-lg font-bold ${tealText}`}>
              {selections.reduce((sum, s) => sum + Math.round(s.food.carbs * (s.mult || 1)), 0)}g
            </span>
          </div>

          {/* Total fat summary */}
          {totalFatGrams > 0 && (
            <div className="flex items-center justify-between">
              <span className={`text-xs ${mutedClass}`}>
                {t('totalLipides') || 'Total lipides'}
              </span>
              <span className={`text-lg font-bold ${purpleText}`}>
                ~{totalFatGrams}g
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
