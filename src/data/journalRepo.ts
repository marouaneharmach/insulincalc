/**
 * Dépôt du journal sur IndexedDB (Dexie). Journal illimité, indexé par journée locale.
 * Migration unique depuis l'ancien localStorage (insulincalc_v4_journal).
 */
import Dexie, { type Table } from 'dexie';
import type { JournalEntry } from '../domain/types';
import { entryKind, type EntryKind } from '../domain/journal';
import { localDateKey } from '../domain/time';
import { migrateAllEntries } from './migrations';
import { parseJournal } from './schema';

export interface StoredEntry extends JournalEntry {
  id: string;
  dateKey: string;
  kind: EntryKind;
}

export const LEGACY_JOURNAL_KEY = 'insulincalc_v4_journal';
export const JOURNAL_MIGRATED_META = 'journalMigratedFromLocalStorage';

class InsulinCalcDB extends Dexie {
  entries!: Table<StoredEntry, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor(name = 'insulincalc') {
    super(name);
    this.version(1).stores({
      entries: 'id, date, dateKey, kind, source',
      meta: 'key',
    });
  }
}

export function toStored(entry: JournalEntry): StoredEntry {
  return { ...entry, id: String(entry.id), dateKey: localDateKey(entry.date), kind: entryKind(entry) };
}

export class JournalRepository {
  private db: InsulinCalcDB;

  constructor(dbName = 'insulincalc') {
    this.db = new InsulinCalcDB(dbName);
  }

  async listAll(): Promise<StoredEntry[]> {
    return this.db.entries.orderBy('date').reverse().toArray();
  }

  async listBetween(fromKey: string, toKey: string): Promise<StoredEntry[]> {
    return this.db.entries.where('dateKey').between(fromKey, toKey, true, true).toArray();
  }

  async count(): Promise<number> {
    return this.db.entries.count();
  }

  async put(entry: JournalEntry): Promise<StoredEntry> {
    const stored = toStored(entry);
    await this.db.entries.put(stored);
    return stored;
  }

  async putMany(entries: JournalEntry[]): Promise<number> {
    const stored = entries.map(toStored);
    await this.db.entries.bulkPut(stored);
    return stored.length;
  }

  async remove(id: string | number): Promise<void> {
    await this.db.entries.delete(String(id));
  }

  async removeMany(ids: Array<string | number>): Promise<void> {
    await this.db.entries.bulkDelete(ids.map(String));
  }

  async clear(): Promise<void> {
    await this.db.entries.clear();
  }

  /** Applique un nouvel état complet en ne persistant que les différences. */
  async sync(previous: JournalEntry[], next: JournalEntry[]): Promise<{ upserted: number; removed: number }> {
    const prevById = new Map(previous.map((e) => [String(e.id), e]));
    const nextIds = new Set(next.map((e) => String(e.id)));
    const toUpsert = next.filter((e) => prevById.get(String(e.id)) !== e);
    const toRemove = previous.filter((e) => !nextIds.has(String(e.id))).map((e) => String(e.id));
    await this.db.transaction('rw', this.db.entries, async () => {
      if (toUpsert.length) await this.db.entries.bulkPut(toUpsert.map(toStored));
      if (toRemove.length) await this.db.entries.bulkDelete(toRemove);
    });
    return { upserted: toUpsert.length, removed: toRemove.length };
  }

  async getMeta<T = unknown>(key: string): Promise<T | undefined> {
    const row = await this.db.meta.get(key);
    return row?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.meta.put({ key, value });
  }

  /**
   * Importe une fois le journal localStorage v4/v5 (migré et validé), puis marque la migration.
   * Conserve la clé localStorage comme sauvegarde de secours.
   */
  async importLegacyLocalStorage(storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null): Promise<{ imported: number; rejected: number; skipped: boolean }> {
    if (!storage) return { imported: 0, rejected: 0, skipped: true };
    const done = await this.getMeta<boolean>(JOURNAL_MIGRATED_META);
    if (done) return { imported: 0, rejected: 0, skipped: true };
    let raw: unknown = [];
    try {
      raw = JSON.parse(storage.getItem(LEGACY_JOURNAL_KEY) ?? '[]');
    } catch {
      raw = [];
    }
    const migrated = migrateAllEntries(raw);
    const { entries, rejected } = parseJournal(migrated);
    if (entries.length) await this.putMany(entries);
    await this.setMeta(JOURNAL_MIGRATED_META, true);
    return { imported: entries.length, rejected, skipped: false };
  }

  async importEntries(entries: JournalEntry[]): Promise<{ added: number; updated: number }> {
    const existingIds = new Set((await this.db.entries.toCollection().primaryKeys()).map(String));
    let added = 0;
    let updated = 0;
    for (const e of entries) {
      if (existingIds.has(String(e.id))) updated += 1;
      else added += 1;
    }
    await this.putMany(entries);
    return { added, updated };
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async destroy(): Promise<void> {
    await this.db.delete();
  }
}

let defaultRepo: JournalRepository | null = null;

export function getJournalRepository(): JournalRepository {
  if (!defaultRepo) defaultRepo = new JournalRepository();
  return defaultRepo;
}

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB != null;
  } catch {
    return false;
  }
}
