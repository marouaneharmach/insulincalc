import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { JournalRepository, LEGACY_JOURNAL_KEY } from '../journalRepo';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

let counter = 0;
const freshRepo = () => new JournalRepository(`test-${Date.now()}-${counter++}`);

describe('JournalRepository', () => {
  let repo: JournalRepository;
  beforeEach(() => { repo = freshRepo(); });

  it('stores entries with a local date key and kind', async () => {
    await repo.put({ id: 1, date: new Date(2026, 9, 11, 0, 30).toISOString(), totalGlucides: 40, doseReelle: 3 });
    const all = await repo.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe('1');
    expect(all[0]?.dateKey).toBe('2026-10-11');
    expect(all[0]?.kind).toBe('meal');
  });

  it('is not capped at 200 entries', async () => {
    const entries = Array.from({ length: 500 }, (_, i) => ({ id: `e${i}`, date: new Date(2026, 0, 1 + (i % 300), 8).toISOString(), glycPre: 1.2 }));
    await repo.putMany(entries);
    expect(await repo.count()).toBe(500);
  });

  it('syncs diffs between two states', async () => {
    const a = { id: 'a', date: new Date(2026, 9, 11, 8).toISOString(), glycPre: 1.1 };
    const b = { id: 'b', date: new Date(2026, 9, 11, 12).toISOString(), glycPre: 1.3 };
    await repo.sync([], [a, b]);
    const b2 = { ...b, glycPost: 1.6 };
    const r = await repo.sync([a, b], [b2]);
    expect(r).toEqual({ upserted: 1, removed: 1 });
    const all = await repo.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.glycPost).toBe(1.6);
  });

  it('lists entries between two day keys', async () => {
    await repo.putMany([
      { id: '1', date: new Date(2026, 9, 1, 8).toISOString(), glycPre: 1 },
      { id: '2', date: new Date(2026, 9, 5, 8).toISOString(), glycPre: 1 },
      { id: '3', date: new Date(2026, 9, 9, 8).toISOString(), glycPre: 1 },
    ]);
    const mid = await repo.listBetween('2026-10-02', '2026-10-08');
    expect(mid.map((e) => e.id)).toEqual(['2']);
  });

  it('imports the legacy localStorage journal once, migrating v4 fields', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_JOURNAL_KEY, JSON.stringify([
      { id: 1700000000000, date: '2026-10-10T12:00:00.000Z', preMealGlycemia: '1.35', doseCalculated: 4, doseInjected: 3.5, totalCarbs: 55, mealType: 'déjeuner' },
      { id: 'bad', date: 'not-a-date', glycPre: 'xx' },
    ]));
    const first = await repo.importLegacyLocalStorage(storage);
    expect(first.skipped).toBe(false);
    expect(first.imported).toBe(2);
    const all = await repo.listAll();
    const migrated = all.find((e) => e.id === '1700000000000');
    expect(migrated?.glycPre).toBe(1.35);
    expect(migrated?.doseSuggeree).toBe(4);
    expect(migrated?.doseReelle).toBe(3.5);
    expect(migrated?.totalGlucides).toBe(55);
    expect(migrated?.schemaVersion).toBe(7);
    const second = await repo.importLegacyLocalStorage(storage);
    expect(second.skipped).toBe(true);
    expect(storage.getItem(LEGACY_JOURNAL_KEY)).not.toBeNull();
  });

  it('importEntries reports added vs updated', async () => {
    await repo.put({ id: 'x', date: new Date(2026, 9, 11, 8).toISOString(), glycPre: 1 });
    const r = await repo.importEntries([
      { id: 'x', date: new Date(2026, 9, 11, 8).toISOString(), glycPre: 1.2 },
      { id: 'y', date: new Date(2026, 9, 11, 9).toISOString(), glycPre: 1.4 },
    ]);
    expect(r).toEqual({ added: 1, updated: 1 });
    expect(await repo.count()).toBe(2);
  });
});
