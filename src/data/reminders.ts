/**
 * Rappels persistés (survivent à la fermeture de l'application).
 * Le service de notifications les relit au démarrage et au retour en avant-plan.
 */
import { newId } from '../domain/ids';

export type ReminderKind = 'split' | 'phase' | 'postmeal' | 'basal' | 'hypo-recheck' | 'control';

export interface Reminder {
  id: string;
  kind: ReminderKind;
  dueAt: string;
  createdAt: string;
  /** Code i18n du titre et du corps. */
  titleCode: string;
  bodyCode: string;
  params: Record<string, string | number>;
  entryId?: string | number | null;
  fired: boolean;
  firedAt?: string | null;
  acknowledged?: boolean;
}

export const REMINDERS_KEY = 'insulincalc_v7_reminders';
const MISSED_WINDOW_MS = 6 * 60 * 60 * 1000;

function read(storage: Storage): Reminder[] {
  try {
    const raw = storage.getItem(REMINDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Reminder[]) : [];
  } catch {
    return [];
  }
}

function write(storage: Storage, reminders: Reminder[]): void {
  try {
    storage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  } catch {
    /* quota */
  }
}

export function listReminders(storage: Storage = localStorage): Reminder[] {
  return read(storage);
}

export function scheduleReminder(
  input: Omit<Reminder, 'id' | 'createdAt' | 'fired' | 'firedAt' | 'acknowledged'> & { id?: string },
  storage: Storage = localStorage,
  now: Date = new Date(),
): Reminder {
  const reminder: Reminder = {
    ...input,
    id: input.id ?? newId('rem_'),
    createdAt: now.toISOString(),
    fired: false,
    firedAt: null,
    acknowledged: false,
  };
  const all = read(storage).filter((r) => r.id !== reminder.id);
  all.push(reminder);
  write(storage, all);
  return reminder;
}

export function cancelReminder(id: string, storage: Storage = localStorage): void {
  write(storage, read(storage).filter((r) => r.id !== id));
}

export function cancelRemindersForEntry(entryId: string | number, storage: Storage = localStorage): void {
  write(storage, read(storage).filter((r) => String(r.entryId) !== String(entryId)));
}

/** Rappels échus non encore déclenchés. */
export function dueReminders(now: Date = new Date(), storage: Storage = localStorage): Reminder[] {
  const t = now.getTime();
  return read(storage).filter((r) => !r.fired && new Date(r.dueAt).getTime() <= t);
}

/** Rappels à venir (non échus). */
export function pendingReminders(now: Date = new Date(), storage: Storage = localStorage): Reminder[] {
  const t = now.getTime();
  return read(storage)
    .filter((r) => !r.fired && new Date(r.dueAt).getTime() > t)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

/** Rappels déclenchés récemment mais non acquittés (à afficher dans l'application). */
export function missedReminders(now: Date = new Date(), storage: Storage = localStorage): Reminder[] {
  const t = now.getTime();
  return read(storage).filter((r) => r.fired && !r.acknowledged && t - new Date(r.dueAt).getTime() <= MISSED_WINDOW_MS);
}

export function markFired(ids: string[], now: Date = new Date(), storage: Storage = localStorage): void {
  const set = new Set(ids);
  write(storage, read(storage).map((r) => (set.has(r.id) ? { ...r, fired: true, firedAt: now.toISOString() } : r)));
}

export function acknowledgeReminder(id: string, storage: Storage = localStorage): void {
  write(storage, read(storage).map((r) => (r.id === id ? { ...r, acknowledged: true } : r)));
}

/** Supprime les rappels anciens (> 48 h) pour limiter le stockage. */
export function purgeReminders(now: Date = new Date(), storage: Storage = localStorage, maxAgeMs = 48 * 60 * 60 * 1000): void {
  const t = now.getTime();
  write(storage, read(storage).filter((r) => t - new Date(r.dueAt).getTime() <= maxAgeMs));
}
