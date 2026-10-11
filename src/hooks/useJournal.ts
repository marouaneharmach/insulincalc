/**
 * Journal réactif adossé à IndexedDB (Dexie), avec repli localStorage.
 * API compatible avec l'ancien `useLocalStorage('journal')` : `setJournal(updater)`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JournalEntry } from '../domain/types';
import { getJournalRepository, isIndexedDbAvailable, LEGACY_JOURNAL_KEY } from '../data/journalRepo';
import { migrateAllEntries } from '../data/migrations';
import { parseJournal } from '../data/schema';

type Updater = JournalEntry[] | ((prev: JournalEntry[]) => JournalEntry[]);

export type StorageMode = 'indexeddb' | 'localstorage';

function sortDesc(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function readLocalFallback(): JournalEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_JOURNAL_KEY) ?? '[]');
    return parseJournal(migrateAllEntries(raw)).entries;
  } catch {
    return [];
  }
}

function writeLocalFallback(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(LEGACY_JOURNAL_KEY, JSON.stringify(entries));
  } catch {
    /* quota */
  }
}

export function useJournal() {
  const [journal, setJournalState] = useState<JournalEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>('localstorage');
  const journalRef = useRef<JournalEntry[]>([]);
  const modeRef = useRef<StorageMode>('localstorage');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (isIndexedDbAvailable()) {
        try {
          const repo = getJournalRepository();
          await repo.importLegacyLocalStorage();
          const all = await repo.listAll();
          if (!alive) return;
          modeRef.current = 'indexeddb';
          setStorageMode('indexeddb');
          journalRef.current = sortDesc(all);
          setJournalState(journalRef.current);
          setReady(true);
          return;
        } catch (error) {
          console.warn('[InsulinCalc] IndexedDB indisponible, repli localStorage :', error);
        }
      }
      if (!alive) return;
      journalRef.current = sortDesc(readLocalFallback());
      setJournalState(journalRef.current);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback((prev: JournalEntry[], next: JournalEntry[]) => {
    if (modeRef.current === 'indexeddb') {
      getJournalRepository()
        .sync(prev, next)
        .catch((error) => console.warn('[InsulinCalc] Échec de persistance du journal :', error));
    } else {
      writeLocalFallback(next);
    }
  }, []);

  const setJournal = useCallback(
    (updater: Updater) => {
      const prev = journalRef.current;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return;
      journalRef.current = next;
      setJournalState(next);
      persist(prev, next);
    },
    [persist],
  );

  /** Fusionne des entrées importées (sauvegarde, capteur) par identifiant. */
  const importEntries = useCallback(
    (entries: JournalEntry[]) => {
      if (!entries.length) return { added: 0, updated: 0 };
      const prev = journalRef.current;
      const byId = new Map(prev.map((e) => [String(e.id), e]));
      let added = 0;
      let updated = 0;
      for (const e of entries) {
        if (byId.has(String(e.id))) updated += 1;
        else added += 1;
        byId.set(String(e.id), e);
      }
      const next = sortDesc(Array.from(byId.values()));
      journalRef.current = next;
      setJournalState(next);
      persist(prev, next);
      return { added, updated };
    },
    [persist],
  );

  return { journal, setJournal, importEntries, ready, storageMode };
}
