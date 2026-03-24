import { useState, useMemo } from 'react';
import FOOD_DB from '../data/foods';
import { QTY_PROFILES, DIGESTION_PROFILES } from '../data/constants';

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function glycColor(v) {
  if (!v || isNaN(v)) return '#94A3B8';
  if (v < 0.7) return '#EF4444';
  if (v < 1.0) return '#F97316';
  if (v <= 1.8) return '#10B981';
  if (v <= 2.0) return '#F59E0B';
  return '#EF4444';
}

const GI_ICONS = { faible: '🟢', moyen: '🟡', 'élevé': '🔴' };
const FAT_ICONS = { aucun: '', faible: '🟢', moyen: '🟣', 'élevé': '🔶' };

export default function MealBuilder({
  glycemia, setGlycemia, weight, setWeight, selections, toggleFood, updateMult,
  resetMeal, totalCarbs, dominantFat, dominantGI, digestion, setDigestion,
  result, maxDose, onSave, favorites, setFavorites, allFoods,
  wSugg, gVal, glycOk, targetGMid, isf, ratio, t, colors, isDark, isRTL
}) {
  const [search, setSearch] = useState('');
  const [openCat, setOpenCat] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [actualDose, setActualDose] = useState('');
  const [saved, setSaved] = useState(false);
  const [showFavName, setShowFavName] = useState(false);
  const [favName, setFavName] = useState('');

  // Sort food DB
  const sortedDB = useMemo(() => {
    const sorted = {};
    const keys = Object.keys(FOOD_DB).sort((a, b) => a.localeCompare(b, 'fr'));
    for (const key of keys) {
      sorted[key] = [...FOOD_DB[key]].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    return sorted;
  }, []);

  // Filter
  const filteredDB = useMemo(() => {
    if (!search.trim()) return sortedDB;
    const q = stripDiacritics(search.toLowerCase());
    const out = {};
    for (const [cat, foods] of Object.entries(sortedDB)) {
      const f = foods.filter(fd =>
        stripDiacritics(fd.name.toLowerCase()).includes(q) ||
        (fd.note && stripDiacritics(fd.note.toLowerCase()).includes(q))
      );
      if (f.length) out[cat] = f;
    }
    return out;
  }, [search, sortedDB]);

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

  const cardClass = `rounded-2xl p-3 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`;

  return (
    <div className="px-4 pt-2 space-y-2">
      {/* Glycemia + Weight inputs */}
      <div className={cardClass}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`text-[10px] uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>
              🩸 {t('glycemie')} (g/L)
            </label>
            <input
              type="number" step="0.01" min="0.3" max="6" placeholder="1.20" inputMode="decimal"
              value={glycemia} onChange={e => setGlycemia(e.target.value)}
              className={`w-full text-center text-lg font-bold p-2.5 rounded-xl border-2 outline-none transition ${
                isDark ? 'bg-slate-700 border-slate-600 focus:border-pink-500' : 'bg-gray-50 border-gray-200 focus:border-pink-400'
              }`}
              style={{ color: glycColor(gVal) }}
            />
            {glycOk && (
              <p className="text-[11px] text-center mt-1" style={{ color: glycColor(gVal) }}>
                {gVal < 0.7 ? '⚠️ Hypo' : gVal <= 1.8 ? '✅ Cible' : '⚠️ Élevée'} · {gVal > targetGMid ? '+' : ''}{(gVal - targetGMid).toFixed(2)}
              </p>
            )}
          </div>
          <div>
            <label className={`text-[10px] uppercase tracking-wider font-semibold mb-1 block ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`}>
              ⚖️ {t('poidsKg')} (kg)
            </label>
            <input
              type="number" step="0.5" min="20" max="200" placeholder="68" inputMode="decimal"
              value={weight} onChange={e => setWeight(e.target.value)}
              className={`w-full text-center text-lg font-bold p-2.5 rounded-xl border-2 outline-none transition ${
                isDark ? 'bg-slate-700 border-slate-600 focus:border-emerald-500' : 'bg-gray-50 border-gray-200 focus:border-emerald-400'
              }`}
            />
            {wSugg && (
              <p className="text-[11px] text-center mt-1 text-emerald-500">ICR 1/{wSugg.icr}g · ISF {wSugg.isfMg}</p>
            )}
          </div>
        </div>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <div className={cardClass}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>⭐ {t('repasFavoris')}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {favorites.map(fav => (
              <button key={fav.id} onClick={() => {
                const loaded = fav.items.map(i => ({ food: allFoods[i.foodId], mult: i.mult })).filter(s => s.food);
                if (loaded.length > 0) {
                  // Simulate loading by toggling each food
                  loaded.forEach(s => toggleFood(s.food));
                }
              }}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium border ${
                  isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                {fav.name} ({fav.totalCarbs}g)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current meal */}
      {selections.length > 0 && (
        <div className={`rounded-2xl p-3 border-2 shadow-sm ${isDark ? 'bg-slate-800 border-teal-600/40' : 'bg-white border-teal-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              🍽 {t('monRepas')} ({selections.length})
            </p>
            <div className="flex gap-2">
              {!showFavName ? (
                <button onClick={() => setShowFavName(true)} className="text-[10px] px-2 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                  ⭐ {t('enregistrerRepas')}
                </button>
              ) : (
                <div className="flex gap-1">
                  <input value={favName} onChange={e => setFavName(e.target.value)} placeholder="Nom..."
                    className="text-xs px-2 py-1 rounded-lg border w-24" autoFocus />
                  <button onClick={saveFavorite} className="text-xs px-2 py-1 rounded-lg bg-amber-500 text-white">✓</button>
                </div>
              )}
              <button onClick={resetMeal} className={`text-xs px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 ${isDark ? 'bg-red-900/30 text-red-400 border border-red-800/40 hover:bg-red-900/50' : 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'}`}>
                🍽 {t('nouveauRepasBtn') || 'Nouveau repas'}
              </button>
            </div>
          </div>

          {/* Food items */}
          <div className="space-y-1">
            {selections.map(s => {
              const profile = QTY_PROFILES[s.food.qty] || QTY_PROFILES['plat'];
              const qtyLabel = profile.find(p => Math.abs(p.m - s.mult) < 0.01)?.l || `×${s.mult}`;
              return (
                <div key={s.food.id} className={`flex items-center gap-2 py-2 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.food.name}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {GI_ICONS[s.food.gi]} IG {s.food.gi} · {qtyLabel}
                    </p>
                  </div>
                  {/* Qty buttons */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateMult(s.food.id, s.mult - (profile[1]?.m - profile[0]?.m || 0.5))}
                      className={`w-7 h-7 rounded-lg text-sm font-bold ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>−</button>
                    <span className="text-xs font-medium w-12 text-center">{qtyLabel}</span>
                    <button onClick={() => updateMult(s.food.id, s.mult + (profile[1]?.m - profile[0]?.m || 0.5))}
                      className={`w-7 h-7 rounded-lg text-sm font-bold ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>+</button>
                  </div>
                  <p className="text-sm font-bold text-teal-600 w-12 text-right">{Math.round(s.food.carbs * s.mult)}g</p>
                  <button onClick={() => toggleFood(s.food)} className="text-gray-400 hover:text-red-400 text-lg">×</button>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className={`flex items-center justify-between mt-3 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className="flex gap-3">
              <span className={`text-[10px] px-2 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
                {GI_ICONS[dominantGI]} IG {dominantGI}
              </span>
              <span className={`text-[10px] px-2 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
                {FAT_ICONS[dominantFat]} Gras {dominantFat}
              </span>
            </div>
            <p className="text-lg font-bold text-teal-600">{totalCarbs}g</p>
          </div>
        </div>
      )}

      {/* Digestion speed */}
      {selections.length > 0 && (
        <div className={cardClass}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('vitesseDigestion')}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(DIGESTION_PROFILES).map(([key, dp]) => (
              <button key={key} onClick={() => setDigestion(key)}
                className={`p-1.5 rounded-xl text-center border transition ${
                  digestion === key
                    ? 'border-teal-400 bg-teal-50 text-teal-700' + (isDark ? ' !bg-teal-900/30 !text-teal-400 !border-teal-600' : '')
                    : isDark ? 'border-slate-700 bg-slate-700/50 text-slate-400' : 'border-gray-200 bg-gray-50 text-gray-500'
                }`}>
                <span className="text-lg">{dp.icon}</span>
                <p className="text-[10px] font-medium mt-1">{dp.label}</p>
                <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Pic {dp.peakMin}m</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result + Schedule */}
      {result && (
        <>
          {/* Dose card */}
          <div className={`rounded-2xl p-3 border-2 ${
            result.total > maxDose
              ? 'border-red-300 bg-red-50' + (isDark ? ' !border-red-700 !bg-red-900/20' : '')
              : 'border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50' + (isDark ? ' !border-teal-700 !bg-slate-800' : '')
          }`}>
            {result.total > maxDose && (
              <div className="mb-3 p-3 rounded-xl bg-red-100 border border-red-200 text-red-700 text-xs font-medium">
                ⚠️ Dose &gt; seuil ({maxDose}U) — Vérifiez vos paramètres
              </div>
            )}
            <p className={`text-xs uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{t('doseTotale')}</p>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-3xl font-bold text-teal-600">{result.total}</span>
              <span className={`text-lg mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>U</span>
              <span className={`text-xs px-2 py-0.5 rounded-full mb-2 ${
                result.bolusType === 'dual' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'
              }`}>
                {result.bolusType === 'dual' ? '⚡ Dual' : '💉 Standard'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Repas', val: `${result.bolusRepas}U`, color: 'text-teal-600' },
                { label: 'Correction', val: result.correction > 0 ? `+${result.correction}U` : '—', color: result.correction > 0 ? 'text-amber-500' : 'text-gray-400' },
                { label: 'Graisses', val: result.fatBonus > 0 ? `+${result.fatBonus}U` : '—', color: result.fatBonus > 0 ? 'text-purple-500' : 'text-gray-400' },
              ].map((item, i) => (
                <div key={i} className={`text-center p-1.5 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-white/80'}`}>
                  <p className="text-[9px] uppercase text-gray-400">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>
            {result.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">{w.txt}</p>
                ))}
              </div>
            )}
          </div>

          {/* Injection schedule */}
          <div className={cardClass}>
            <p className={`text-xs uppercase tracking-wider font-semibold mb-3 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
              📅 {t('calendrierInjections')}
            </p>
            <div className={`text-[10px] px-3 py-1.5 rounded-lg mb-3 ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
              {DIGESTION_PROFILES[digestion].icon} Digestion {DIGESTION_PROFILES[digestion].label} · Pic {DIGESTION_PROFILES[digestion].peakMin}min · Fin {Math.round(DIGESTION_PROFILES[digestion].tail/60*10)/10}h
            </div>
            <div className="relative">
              <div className={`absolute left-4 top-0 bottom-0 w-0.5 ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
              {result.schedule.map((step, i) => (
                <div key={i} className="relative flex gap-3 pb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 z-10 border-2 ${
                    isDark ? 'border-slate-800' : 'border-white'
                  }`} style={{ background: step.color + '20', borderColor: step.color }}>
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{step.label}</p>
                      {step.units && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {step.units}U
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{step.time}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{step.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className={cardClass}>
            <p className={`text-xs uppercase tracking-wider font-semibold mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('enregistrerDonnees')}
            </p>
            <div className="flex items-center gap-3 mb-3">
              <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('doseReellePrise')}</label>
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

      {/* Food search */}
      <div className={cardClass}>
        <input
          type="search"
          placeholder={t('rechercherAliment')}
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            if (e.target.value.trim()) setOpenCat(null);
          }}
          className={`w-full p-3 rounded-xl border outline-none text-sm transition ${
            isDark ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-teal-500' : 'bg-gray-50 border-gray-200 placeholder:text-gray-400 focus:border-teal-400'
          }`}
        />
      </div>

      {/* Food categories */}
      <div className="space-y-2">
        {Object.entries(filteredDB).map(([cat, foods]) => {
          const isOpen = openCat === cat || search.trim();
          return (
            <div key={cat} className={cardClass}>
              <button
                onClick={() => setOpenCat(openCat === cat ? null : cat)}
                className="w-full flex items-center justify-between"
              >
                <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{cat}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{foods.length}</span>
                  <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </div>
              </button>
              {isOpen && (
                <div className="mt-2 space-y-0.5">
                  {foods.map(food => {
                    const selected = selections.some(s => s.food.id === food.id);
                    return (
                      <button key={food.id} onClick={() => toggleFood(food)}
                        className={`w-full flex items-center gap-2 p-1.5 rounded-xl text-left transition ${
                          selected
                            ? 'bg-teal-50 border border-teal-200' + (isDark ? ' !bg-teal-900/20 !border-teal-700' : '')
                            : isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'
                        }`}>
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs ${
                          selected ? 'bg-teal-500 border-teal-500 text-white' : isDark ? 'border-slate-600' : 'border-gray-300'
                        }`}>
                          {selected && '✓'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{food.name}</p>
                          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {food.unit} · {food.carbs}g · {GI_ICONS[food.gi]}
                          </p>
                        </div>
                        <p className={`text-xs font-bold ${selected ? 'text-teal-600' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {food.carbs}g
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom spacer */}
      <div className="h-8" />
    </div>
  );
}
