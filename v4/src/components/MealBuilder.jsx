import { useState, useMemo } from 'react';
import FOOD_DB from '../data/foods';
import { QTY_PROFILES, DIGESTION_PROFILES } from '../data/constants';
import { normalizeGlycemia, getGlycemiaStatus, validateCarbs, validateDose } from '../utils/validation';
import DoseAnimation from './DoseAnimation';
import PostMealCorrector from './PostMealCorrector';

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function fuzzyMatch(text, query) {
  const t = stripDiacritics(text.toLowerCase());
  const q = stripDiacritics(query.toLowerCase());
  if (t.includes(q)) return 2;
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti);
    if (idx === -1) return 0;
    ti = idx + 1;
  }
  return 1;
}

function glycColor(v) {
  if (!v || isNaN(v)) return '#94A3B8';
  if (v < 0.7) return '#EF4444';
  if (v < 1.0) return '#F97316';
  if (v <= 1.8) return '#10B981';
  if (v <= 2.0) return '#F59E0B';
  return '#EF4444';
}

export default function MealBuilder({
  glycemia, setGlycemia, selections, toggleFood, updateMult,
  resetMeal, totalCarbs, dominantFat, dominantGI, digestion,
  result, maxDose, onSave, favorites, setFavorites, allFoods,
  gVal, glycOk, glycDisplay, targetGMid, isf, ratio, weight,
  journal, setJournal,
  t, colors, isDark, isRTL
}) {
  const [search, setSearch] = useState('');
  const [openCat, setOpenCat] = useState(null);
  const [actualDose, setActualDose] = useState('');
  const [saved, setSaved] = useState(false);
  const [showFavName, setShowFavName] = useState(false);
  const [favName, setFavName] = useState('');
  const [foodTab, setFoodTab] = useState('recent'); // 'recent' | 'favorites' | 'all'

  // Sort food DB
  const sortedDB = useMemo(() => {
    const sorted = {};
    const keys = Object.keys(FOOD_DB).sort((a, b) => a.localeCompare(b, 'fr'));
    for (const key of keys) {
      sorted[key] = [...FOOD_DB[key]].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    return sorted;
  }, []);

  // Recent foods from journal
  const recentFoods = useMemo(() => {
    const seen = new Set();
    const foods = [];
    const entries = (journal || []).slice(0, 30);
    for (const e of entries) {
      for (const id of (e.alimentIds || [])) {
        if (!seen.has(id) && allFoods[id]) {
          seen.add(id);
          foods.push(allFoods[id]);
        }
        if (foods.length >= 15) break;
      }
      if (foods.length >= 15) break;
    }
    return foods;
  }, [journal, allFoods]);

  // Favorite food items
  const favoriteFoods = useMemo(() => {
    const items = [];
    for (const fav of (favorites || [])) {
      for (const fi of (fav.items || [])) {
        if (allFoods[fi.foodId] && !items.find(f => f.id === fi.foodId)) {
          items.push(allFoods[fi.foodId]);
        }
      }
    }
    return items;
  }, [favorites, allFoods]);

  // Fuzzy filter
  const filteredDB = useMemo(() => {
    if (!search.trim()) return sortedDB;
    const q = search.trim();
    if (q.length < 2) return sortedDB;
    const out = {};
    for (const [cat, foods] of Object.entries(sortedDB)) {
      const scored = foods
        .map(fd => ({ fd, score: Math.max(fuzzyMatch(fd.name, q), fd.note ? fuzzyMatch(fd.note, q) : 0) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score);
      if (scored.length) out[cat] = scored.map(x => x.fd);
    }
    return out;
  }, [search, sortedDB]);

  // Flat search results
  const searchResults = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return [];
    return Object.values(filteredDB).flat().slice(0, 20);
  }, [filteredDB, search]);

  const handleSave = () => {
    if (!result) return;
    const dose = parseFloat(actualDose);
    onSave(isNaN(dose) ? result.total : dose);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const saveFavorite = () => {
    if (!favName.trim() || selections.length === 0) return;
    const fav = {
      id: Date.now(),
      name: favName,
      items: selections.map(s => ({ foodId: s.food.id, mult: s.mult })),
      totalCarbs,
    };
    setFavorites(prev => [fav, ...prev]);
    setShowFavName(false);
    setFavName('');
  };

  // Glycemia status
  const glycStatus = glycOk ? getGlycemiaStatus(gVal) : null;
  // Carbs validation
  const carbsValid = validateCarbs(totalCarbs);
  // Dose validation
  const doseValid = actualDose ? validateDose(actualDose, maxDose, { weight }) : null;

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;

  // Render a food item button
  const renderFoodItem = (food) => {
    const selected = selections.some(s => s.food.id === food.id);
    return (
      <button key={food.id} onClick={() => toggleFood(food)}
        className={`w-full flex items-center gap-2 p-2 rounded-xl text-left transition ${
          selected
            ? 'bg-teal-50 border border-teal-200' + (isDark ? ' !bg-teal-900/20 !border-teal-700' : '')
            : isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'
        }`}>
        <div className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0 ${
          selected ? 'bg-teal-500 border-teal-500 text-white' : isDark ? 'border-slate-600' : 'border-gray-300'
        }`}>
          {selected && '✓'}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{food.name}</p>
          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{food.unit}</p>
        </div>
        <p className={`text-xs font-bold shrink-0 ${selected ? 'text-teal-600' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {food.carbs}g
        </p>
      </button>
    );
  };

  return (
    <div className="px-4 pt-2 space-y-2">
      {/* Glycemia input — full width, accepts mg/dL */}
      <div className={cardClass}>
        <label className={`text-[10px] uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>
          🩸 {t('glycemie')}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number" step="0.01" min="0" placeholder="1.20 ou 120" inputMode="decimal"
            value={glycemia} onChange={e => setGlycemia(e.target.value)}
            className={`flex-1 text-center text-xl font-bold p-3 rounded-xl border-2 outline-none transition ${
              isDark ? 'bg-slate-700 border-slate-600 focus:border-pink-500' : 'bg-gray-50 border-gray-200 focus:border-pink-400'
            }`}
            style={{ color: glycColor(gVal) }}
          />
          <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>g/L</span>
        </div>
        {/* Auto-conversion hint */}
        {glycDisplay && (
          <p className="text-[11px] text-center mt-1 text-blue-500 font-medium">
            🔄 {glycDisplay}
          </p>
        )}
        {/* Status indicator */}
        {glycStatus && (
          <p className="text-[11px] text-center mt-1 font-medium" style={{ color: glycStatus.color }}>
            {glycStatus.label} · {gVal > targetGMid ? '+' : ''}{(gVal - targetGMid).toFixed(2)} g/L vs cible
          </p>
        )}
      </div>

      {/* Current meal selection */}
      {selections.length > 0 && (
        <div className={`rounded-2xl p-3 border-2 shadow-sm ${isDark ? 'bg-slate-800 border-teal-600/40' : 'bg-white border-teal-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              🍽 {t('monRepas')} ({selections.length})
            </p>
            <div className="flex gap-1">
              {!showFavName ? (
                <button onClick={() => setShowFavName(true)} className="text-[10px] px-2 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                  ⭐
                </button>
              ) : (
                <div className="flex gap-1">
                  <input value={favName} onChange={e => setFavName(e.target.value)} placeholder="Nom..."
                    className="text-xs px-2 py-1 rounded-lg border w-20" autoFocus />
                  <button onClick={saveFavorite} className="text-xs px-2 py-1 rounded-lg bg-amber-500 text-white">✓</button>
                </div>
              )}
              <button onClick={resetMeal} className="text-[10px] px-2 py-1 rounded-lg bg-red-50 text-red-500 border border-red-200">
                ✕ {t('vider') || 'Vider'}
              </button>
            </div>
          </div>

          {/* Compact food list */}
          <div className="space-y-0.5">
            {selections.map(s => {
              const profile = QTY_PROFILES[s.food.qty] || QTY_PROFILES['plat'];
              const qtyLabel = profile.find(p => Math.abs(p.m - s.mult) < 0.01)?.l || `×${s.mult}`;
              return (
                <div key={s.food.id} className={`flex items-center gap-1 py-1.5 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                  <p className={`flex-1 text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.food.name}</p>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => updateMult(s.food.id, s.mult - (profile[1]?.m - profile[0]?.m || 0.5))}
                      className={`w-6 h-6 rounded-lg text-xs font-bold ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>−</button>
                    <span className="text-[10px] font-medium w-10 text-center">{qtyLabel}</span>
                    <button onClick={() => updateMult(s.food.id, s.mult + (profile[1]?.m - profile[0]?.m || 0.5))}
                      className={`w-6 h-6 rounded-lg text-xs font-bold ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>+</button>
                  </div>
                  <p className="text-xs font-bold text-teal-600 w-10 text-right">{Math.round(s.food.carbs * s.mult)}g</p>
                  <button onClick={() => toggleFood(s.food)} className="text-gray-400 hover:text-red-400 text-sm ml-1">×</button>
                </div>
              );
            })}
          </div>

          {/* Total + badges */}
          <div className={`flex items-center justify-between mt-2 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className="flex gap-2">
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                IG {dominantGI}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                Gras {dominantFat}
              </span>
            </div>
            <p className="text-lg font-bold text-teal-600">{totalCarbs}g</p>
          </div>
          {carbsValid.warning && (
            <p className="text-[10px] text-amber-500 mt-1">⚠️ {carbsValid.warning}</p>
          )}
        </div>
      )}

      {/* ═══ RESULT + SCHEDULE + SAVE ═══ */}
      {result && (
        <>
          {/* Dose card — centered */}
          <div className={`rounded-2xl p-4 border-2 ${
            result.total > maxDose
              ? 'border-red-300 bg-red-50' + (isDark ? ' !border-red-700 !bg-red-900/20' : '')
              : 'border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50' + (isDark ? ' !border-teal-700 !bg-slate-800' : '')
          }`}>
            {result.total > maxDose && (
              <div className="mb-3 p-2 rounded-xl bg-red-100 border border-red-200 text-red-700 text-xs font-medium">
                ⚠️ Dose &gt; seuil ({maxDose}U) — Vérifiez vos paramètres
              </div>
            )}
            <p className={`text-xs uppercase tracking-wider font-semibold mb-1 text-center ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{t('doseTotale')}</p>
            <div className="flex justify-center">
              <DoseAnimation dose={result.total} bolusType={result.bolusType} isDark={isDark} />
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {[
                { label: t('repas'), val: `${result.bolusRepas}U`, color: 'text-teal-600' },
                { label: t('correction'), val: result.correction > 0 ? `+${result.correction}U` : '—', color: result.correction > 0 ? 'text-amber-500' : 'text-gray-400' },
                { label: t('graisses'), val: result.fatBonus > 0 ? `+${result.fatBonus}U` : '—', color: result.fatBonus > 0 ? 'text-purple-500' : 'text-gray-400' },
              ].map((item, i) => (
                <div key={i} className={`text-center p-1.5 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-white/80'}`}>
                  <p className="text-[9px] uppercase text-gray-400">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>
            {result.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">{w.txt}</p>
                ))}
              </div>
            )}
          </div>

          {/* Injection schedule — cards style */}
          <div className={cardClass}>
            <p className={`text-xs uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              📅 {t('calendrierInjections')}
            </p>
            <div className={`text-[10px] px-3 py-1.5 rounded-lg mb-2 ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
              {DIGESTION_PROFILES[digestion].icon} {DIGESTION_PROFILES[digestion].label} · Pic {DIGESTION_PROFILES[digestion].peakMin}min · Fin {Math.round(DIGESTION_PROFILES[digestion].tail/60*10)/10}h
            </div>
            <div className="space-y-1.5">
              {result.schedule.map((step, i) => (
                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                  step.units != null
                    ? isDark ? 'bg-blue-900/20 border-blue-800/30' : 'bg-blue-50 border-blue-100'
                    : isDark ? 'bg-purple-900/15 border-purple-800/20' : 'bg-purple-50/50 border-purple-100'
                }`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                    style={{ background: step.color + '20', border: `2px solid ${step.color}` }}>
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{step.label}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{step.time}</p>
                    {step.note && <p className={`text-[9px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{step.note}</p>}
                  </div>
                  {step.units != null && (
                    <span className="text-sm font-bold px-3 py-1 rounded-full bg-blue-500 text-white shrink-0">
                      {step.units}U
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Post-meal corrector */}
          <PostMealCorrector
            initialDose={result.total}
            isf={isf}
            targetG={targetGMid}
            digestionKey={digestion}
            journal={journal}
            setJournal={setJournal}
            t={t}
            isDark={isDark}
          />

          {/* Save — dose réelle AVANT enregistrement */}
          <div className={cardClass}>
            <p className={`text-xs uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              💾 {t('enregistrerDonnees')}
            </p>
            <div className="flex items-center justify-center gap-3 mb-3">
              <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('doseReellePrise') || 'Dose injectée'}</label>
              <input
                type="number" step="0.5" min="0"
                placeholder={String(result.total)}
                value={actualDose}
                onChange={e => setActualDose(e.target.value)}
                className={`w-24 text-center text-lg font-bold p-2 rounded-xl border outline-none ${
                  isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-200'
                }`}
              />
              <span className="text-sm text-gray-400">U</span>
            </div>
            {doseValid?.warning && (
              <p className="text-[10px] text-amber-500 text-center mb-2">⚠️ {doseValid.warning}</p>
            )}
            {actualDose && parseFloat(actualDose) !== result.total && (
              <p className="text-[10px] text-center mb-2 text-blue-400">
                Suggéré : {result.total}U — Injecté : {actualDose}U
              </p>
            )}
            <button onClick={handleSave}
              className={`w-full py-3 rounded-2xl font-medium text-sm transition ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-teal-500 hover:bg-teal-600 text-white'
              }`}>
              {saved ? '✅ ' + t('enregistre') : '💾 ' + t('enregistrer')}
            </button>
          </div>
        </>
      )}

      {/* ═══ FOOD SELECTION ═══ */}
      <div className={cardClass}>
        {/* Search bar — always visible at top */}
        <input
          type="search"
          placeholder={`🔍 ${t('rechercherAliment') || 'Rechercher un aliment...'}`}
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            if (e.target.value.trim()) setOpenCat(null);
          }}
          className={`w-full p-3 rounded-xl border outline-none text-sm transition ${
            isDark ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-teal-500' : 'bg-gray-50 border-gray-200 placeholder:text-gray-400 focus:border-teal-400'
          }`}
        />

        {/* Search results — instant display */}
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-0.5">
            <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {searchResults.length} résultat{searchResults.length > 1 ? 's' : ''} pour "{search}"
            </p>
            {searchResults.map(food => renderFoodItem(food))}
          </div>
        )}

        {/* Tab bar: Récents / Favoris / Tous */}
        {!search.trim() && (
          <>
            <div className="flex gap-1 mt-2">
              {[
                { key: 'recent', label: '🕐 Récents', count: recentFoods.length },
                { key: 'favorites', label: '⭐ Favoris', count: favoriteFoods.length },
                { key: 'all', label: '📋 Tous' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setFoodTab(tab.key)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition ${
                    foodTab === tab.key
                      ? 'bg-teal-500 text-white'
                      : isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {tab.label} {tab.count ? `(${tab.count})` : ''}
                </button>
              ))}
            </div>

            {/* Recent foods */}
            {foodTab === 'recent' && (
              <div className="mt-2 space-y-0.5">
                {recentFoods.length === 0 ? (
                  <p className={`text-center text-xs py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Vos aliments récents apparaîtront ici
                  </p>
                ) : (
                  recentFoods.map(food => renderFoodItem(food))
                )}
              </div>
            )}

            {/* Favorite foods */}
            {foodTab === 'favorites' && (
              <div className="mt-2 space-y-0.5">
                {favoriteFoods.length === 0 ? (
                  <p className={`text-center text-xs py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Enregistrez des repas favoris pour les retrouver ici
                  </p>
                ) : (
                  favoriteFoods.map(food => renderFoodItem(food))
                )}
              </div>
            )}

            {/* All foods — by category */}
            {foodTab === 'all' && (
              <div className="mt-2 space-y-1">
                {Object.entries(sortedDB).map(([cat, foods]) => {
                  const isOpen = openCat === cat;
                  return (
                    <div key={cat}>
                      <button
                        onClick={() => setOpenCat(isOpen ? null : cat)}
                        className={`w-full flex items-center justify-between py-1.5 px-1 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}`}
                      >
                        <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{cat}</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{foods.length}</span>
                          <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="ml-1 space-y-0.5">
                          {foods.map(food => renderFoodItem(food))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}
