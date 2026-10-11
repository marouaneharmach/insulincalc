import { describe, it, expect } from 'vitest';
import { parseJournalEntry, parseJournal, parseBackup, SETTINGS_DEFAULTS, SettingsSchema } from '../schema';
import { migrateEntry, migrateAllEntries, needsMigration } from '../migrations';
import {
  scheduleReminder, dueReminders, pendingReminders, markFired, missedReminders, acknowledgeReminder, cancelRemindersForEntry, purgeReminders, listReminders,
} from '../reminders';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

describe('schema', () => {
  it('normalises numbers and ids', () => {
    const e = parseJournalEntry({ id: 42, date: '2026-10-11T08:00:00', glycPre: '1,35', doseReelle: '4', totalGlucides: '' });
    expect(e?.id).toBe('42');
    expect(e?.glycPre).toBe(1.35);
    expect(e?.doseReelle).toBe(4);
    expect(e?.totalGlucides).toBeNull();
  });
  it('rejects invalid dates and counts them', () => {
    const r = parseJournal([{ id: 1, date: 'nope' }, { id: 2, date: '2026-10-11T08:00:00' }, 'garbage']);
    expect(r.entries).toHaveLength(1);
    expect(r.rejected).toBe(2);
  });
  it('settings defaults are clinically sane', () => {
    expect(SETTINGS_DEFAULTS.ratio).toBe(15);
    expect(SETTINGS_DEFAULTS.nightCorrectionMin).toBe(1.8);
    expect(SettingsSchema.safeParse({ ratio: 999 }).success).toBe(false);
  });
  it('validates backups', () => {
    expect(parseBackup({ version: '7.0.0', exportDate: 'x', profile: {}, journal: [] }).ok).toBe(true);
    expect(parseBackup({ foo: 1 }).ok).toBe(false);
  });
});

describe('migrations', () => {
  it('needsMigration below major 7', () => {
    expect(needsMigration(null)).toBe(true);
    expect(needsMigration('6.0.2')).toBe(true);
    expect(needsMigration('7.0.0')).toBe(false);
  });
  it('maps v4 fields, normalises types and is idempotent', () => {
    const v4 = { id: 1700000000000, date: '2026-10-10T12:00:00.000Z', preMealGlycemia: '1.35', postMealGlycemia: 1.8, totalCarbs: 55, doseCalculated: 4, doseInjected: 3.5 };
    const once = migrateEntry(v4 as never)!;
    expect(once.id).toBe('1700000000000');
    expect(once.glycPre).toBe(1.35);
    expect(once.glycPost).toBe(1.8);
    expect(once.totalGlucides).toBe(55);
    expect(once.doseSuggeree).toBe(4);
    expect(once.doseReelle).toBe(3.5);
    expect(once.doseActual).toBe(3.5);
    expect(once.mealType).toBe('repas');
    expect(once.schemaVersion).toBe(7);
    expect(migrateEntry(once)).toEqual(once);
  });
  it('repairs an invalid date from a numeric id', () => {
    const e = migrateEntry({ id: 1700000000000, date: 'invalid' } as never)!;
    expect(new Date(e.date).getTime()).toBe(1700000000000);
  });
  it('drops null entries', () => {
    expect(migrateAllEntries([null, { id: 'a', date: '2026-10-11T08:00:00' }])).toHaveLength(1);
  });
});

describe('reminders', () => {
  it('schedules, fires, acknowledges and purges', () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 9, 11, 12, 0);
    scheduleReminder({ kind: 'split', dueAt: new Date(2026, 9, 11, 12, 45).toISOString(), titleCode: 'REM_SPLIT_TITLE', bodyCode: 'REM_SPLIT_BODY', params: { units: 3 }, entryId: 'e1' }, storage, now);
    scheduleReminder({ kind: 'postmeal', dueAt: new Date(2026, 9, 11, 14, 0).toISOString(), titleCode: 'REM_POST_TITLE', bodyCode: 'REM_POST_BODY', params: {}, entryId: 'e1' }, storage, now);
    expect(pendingReminders(now, storage)).toHaveLength(2);
    expect(dueReminders(now, storage)).toHaveLength(0);
    const later = new Date(2026, 9, 11, 13, 0);
    const due = dueReminders(later, storage);
    expect(due).toHaveLength(1);
    expect(due[0]?.kind).toBe('split');
    markFired(due.map((r) => r.id), later, storage);
    expect(dueReminders(later, storage)).toHaveLength(0);
    expect(missedReminders(later, storage)).toHaveLength(1);
    acknowledgeReminder(due[0]!.id, storage);
    expect(missedReminders(later, storage)).toHaveLength(0);
    cancelRemindersForEntry('e1', storage);
    expect(listReminders(storage)).toHaveLength(0);
    scheduleReminder({ kind: 'basal', dueAt: new Date(2026, 9, 1, 8, 0).toISOString(), titleCode: 'x', bodyCode: 'y', params: {} }, storage, now);
    purgeReminders(now, storage);
    expect(listReminders(storage)).toHaveLength(0);
  });
});
