import { useCallback, useEffect, useState } from 'react';

export const STORAGE_PREFIX = 'insulincalc_v4_';

type Updater<T> = T | ((prev: T) => T);

/** État persisté dans localStorage, synchronisé entre onglets. */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: Updater<T>) => void] {
  const prefixedKey = `${STORAGE_PREFIX}${key}`;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(prefixedKey);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: Updater<T>) => {
      setStoredValue((prev) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        try {
          localStorage.setItem(prefixedKey, JSON.stringify(next));
        } catch {
          /* quota */
        }
        return next;
      });
    },
    [prefixedKey],
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== prefixedKey || e.newValue == null) return;
      try {
        setStoredValue(JSON.parse(e.newValue) as T);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [prefixedKey]);

  return [storedValue, setValue];
}
