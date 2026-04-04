import { useState, useRef } from 'react';
import { recognizeFood, mapToLocalFoods, compressImage, deriveFatLevel } from '../utils/foodRecognition';

/**
 * PhotoMeal — Take a photo of a meal, recognize foods via Groq Vision,
 * then let user confirm/adjust and add to meal selection.
 * Supports both DB-mapped foods and AI-estimated foods (unmapped).
 */
export default function PhotoMeal({ allFoods, toggleFood, isDark, t }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'results' | 'error'
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const compressed = await compressImage(file, 400);
    setPhotoPreview(URL.createObjectURL(compressed));
    setStatus('loading');
    setError('');

    try {
      const foodResults = await recognizeFood(file);
      const mapped = mapToLocalFoods(foodResults, allFoods);
      setResults(mapped);
      setStatus('results');
    } catch (err) {
      console.error('[PhotoMeal]', err);
      setError(err.message || 'Erreur lors de la reconnaissance');
      setStatus('error');
    }
  };

  const addFood = (item) => {
    if (item.localFood) {
      toggleFood(item.localFood);
    } else if (item.estimatedCarbs != null) {
      // AI-estimated food not in local DB — create temporary food entry
      const aiFood = {
        id: `ai_${item.nameFr}_${Date.now()}`,
        name: `${item.nameFr} (IA)`,
        carbs: Math.round(item.estimatedCarbs),
        fat: deriveFatLevel(item.estimatedFat),
        gi: 'moyen',
        unit: `~${item.estimatedWeight || '?'}g (estimation IA)`,
        qty: 'plat',
        note: 'Estimation IA — ajustez si besoin',
        aiEstimated: true,
      };
      toggleFood(aiFood);
    }
  };

  const reset = () => {
    setStatus('idle');
    setResults([]);
    setError('');
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;

  return (
    <div className={cardClass}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
          📷 {t?.('photoRepas') || 'Photo du repas'}
        </p>
        {status !== 'idle' && (
          <button onClick={reset}
            className={`text-[10px] px-2 py-1 rounded-lg ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}>
            ✕ Effacer
          </button>
        )}
      </div>

      {/* Idle — camera button */}
      {status === 'idle' && (
        <label className={`flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed cursor-pointer transition ${
          isDark ? 'border-slate-600 hover:border-purple-500 hover:bg-purple-900/10' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
        }`}>
          <span className="text-3xl mb-2">📸</span>
          <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t?.('prendrePhoto') || 'Photographier votre repas'}
          </span>
          <span className={`text-[10px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {t?.('iaReconnaitraAliments') || "L'IA reconnaîtra les aliments"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            className="hidden"
          />
        </label>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div className="text-center py-6">
          {photoPreview && (
            <img src={photoPreview} alt="Repas" className="w-32 h-32 object-cover rounded-xl mx-auto mb-3 border-2 border-purple-300" />
          )}
          <div className="animate-spin w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className={`text-sm ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
            🔍 {t?.('analyseEnCours') || 'Analyse en cours...'}
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Identification des aliments par IA
          </p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="text-center py-4">
          {photoPreview && (
            <img src={photoPreview} alt="Repas" className="w-24 h-24 object-cover rounded-xl mx-auto mb-2 opacity-60" />
          )}
          <p className="text-red-500 text-sm mb-2">❌ {error}</p>
          <button onClick={reset}
            className="text-xs px-4 py-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition">
            🔄 Réessayer
          </button>
        </div>
      )}

      {/* Results */}
      {status === 'results' && (
        <div>
          {photoPreview && (
            <img src={photoPreview} alt="Repas" className="w-full h-40 object-cover rounded-xl mb-3" />
          )}

          {results.length === 0 ? (
            <div className={`p-3 rounded-xl text-center border border-dashed ${isDark ? 'border-slate-600 bg-slate-700/30' : 'border-gray-200 bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                😕 {t?.('aucunAlimentReconnu') || 'Aucun aliment reconnu'}
              </p>
              <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {t?.('essayerAutrePhoto') || 'Essayez avec une autre photo ou ajoutez manuellement'}
              </p>
            </div>
          ) : (
          <>
          <p className={`text-[10px] mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {results.length} {t?.('alimentsDetectes') || 'aliment(s) détecté(s)'} — {t?.('tapPourAjouter') || 'Tapez pour ajouter au repas'}
          </p>

          <div className="space-y-1">
            {results.map((item, i) => {
              const canAdd = item.mapped || item.estimatedCarbs != null;
              const carbsDisplay = item.mapped ? item.localFood.carbs : item.estimatedCarbs;
              const fatDisplay = item.mapped ? null : item.estimatedFat;

              return (
              <button
                key={i}
                onClick={() => addFood(item)}
                disabled={!canAdd}
                className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition ${
                  canAdd
                    ? isDark ? 'hover:bg-teal-900/20 border border-slate-700' : 'hover:bg-teal-50 border border-gray-100'
                    : 'opacity-50 cursor-not-allowed border border-dashed ' + (isDark ? 'border-slate-700' : 'border-gray-200')
                }`}
              >
                {/* Confidence badge */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  item.confidence >= 80 ? 'bg-emerald-100 text-emerald-700' :
                  item.confidence >= 50 ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {item.confidence}%
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium capitalize ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {item.nameFr || item.name}
                  </p>
                  {item.mapped ? (
                    <p className={`text-[10px] ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                      → {item.localFood.name} ({item.localFood.carbs}g glucides)
                    </p>
                  ) : item.estimatedCarbs != null ? (
                    <p className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                      ~{Math.round(item.estimatedCarbs)}g glucides
                      {item.estimatedFat != null && ` · ~${Math.round(item.estimatedFat)}g lipides`}
                      {item.estimatedWeight != null && ` · ~${item.estimatedWeight}g`}
                      {' '}(estimation IA)
                    </p>
                  ) : (
                    <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {item.name} — {t?.('nonTrouveDansBase') || 'non trouvé dans la base'}
                    </p>
                  )}
                </div>

                {canAdd && carbsDisplay != null && (
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-bold block ${item.mapped ? (isDark ? 'text-teal-400' : 'text-teal-600') : (isDark ? 'text-purple-400' : 'text-purple-600')}`}>
                      + {Math.round(carbsDisplay)}g
                    </span>
                    {fatDisplay != null && (
                      <span className={`text-[9px] block ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                        {Math.round(fatDisplay)}g lip.
                      </span>
                    )}
                  </div>
                )}
              </button>
              );
            })}
          </div>
          </>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button onClick={reset}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
              }`}>
              📷 Autre photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
