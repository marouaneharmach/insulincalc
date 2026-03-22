import { useState } from 'react';

export function useLocalStorage(key, defaultValue) {
  const fullKey = "insulincalc_v1_" + key;
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(fullKey);
      if (stored === null) return defaultValue;
      return JSON.parse(stored);
    } catch {
      return defaultValue;
    }
  });
  const setAndStore = (newVal) => {
    setValue(prev => {
      const resolved = typeof newVal === "function" ? newVal(prev) : newVal;
      try {
        localStorage.setItem(fullKey, JSON.stringify(resolved));
      } catch { /* quota exceeded */ }
      return resolved;
    });
  };
  return [value, setAndStore];
}
