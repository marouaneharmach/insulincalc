// ─── JOURNAL GLYCÉMIQUE — Data Store V4 ─────────────────────────────────────
// Clé localStorage : insulincalc_v4_journal

const STORAGE_KEY = "insulincalc_v4_journal";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* quota exceeded */ }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export function getEntries(days = 30) {
  const entries = readAll();
  if (!days) return entries;
  const cutoff = Date.now() - days * 86400000;
  return entries
    .filter(e => new Date(e.date).getTime() >= cutoff)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getAllEntries() {
  return readAll().sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function addEntry(entry) {
  const entries = readAll();
  const full = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(),
    mealType: "déjeuner",
    preMealGlycemia: null,
    foods: [],
    totalCarbs: 0,
    doseCalculated: 0,
    doseInjected: 0,
    postMealGlycemia: null,
    postMealTime: null,
    correction: null,
    schedule: null,
    notes: "",
    ...entry,
  };
  entries.push(full);
  writeAll(entries);
  return full;
}

export function updateEntry(id, partial) {
  const entries = readAll();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...partial };
  writeAll(entries);
  return entries[idx];
}

export function deleteEntry(id) {
  const entries = readAll();
  const filtered = entries.filter(e => e.id !== id);
  writeAll(filtered);
  return filtered.length < entries.length;
}

// ─── STATS ───────────────────────────────────────────────────────────────────

export function getStats(days = 30) {
  const entries = getEntries(days);

  const glycValues = [];
  entries.forEach(e => {
    if (e.preMealGlycemia != null && !isNaN(e.preMealGlycemia)) {
      glycValues.push(e.preMealGlycemia);
    }
    if (e.postMealGlycemia != null && !isNaN(e.postMealGlycemia)) {
      glycValues.push(e.postMealGlycemia);
    }
  });

  if (glycValues.length === 0) {
    return {
      count: 0,
      measureCount: 0,
      average: 0,
      stdDev: 0,
      timeInRange: 0,
      hypoPercent: 0,
      lowPercent: 0,
      targetPercent: 0,
      highPercent: 0,
      hyperPercent: 0,
      entries,
    };
  }

  const avg = glycValues.reduce((s, v) => s + v, 0) / glycValues.length;
  const variance = glycValues.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / glycValues.length;
  const stdDev = Math.sqrt(variance);

  const hypo = glycValues.filter(v => v < 0.7).length;
  const low = glycValues.filter(v => v >= 0.7 && v < 1.0).length;
  const target = glycValues.filter(v => v >= 1.0 && v <= 1.8).length;
  const high = glycValues.filter(v => v > 1.8 && v <= 2.5).length;
  const hyper = glycValues.filter(v => v > 2.5).length;
  const n = glycValues.length;

  return {
    count: entries.length,
    measureCount: n,
    average: Math.round(avg * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    timeInRange: Math.round((target / n) * 100),
    hypoPercent: Math.round((hypo / n) * 100),
    lowPercent: Math.round((low / n) * 100),
    targetPercent: Math.round((target / n) * 100),
    highPercent: Math.round((high / n) * 100),
    hyperPercent: Math.round((hyper / n) * 100),
    glycValues,
    entries,
  };
}
