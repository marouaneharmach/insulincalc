/**
 * Service de rappels : planification persistée + déclenchement fiable.
 * Les rappels sont relus au démarrage, au retour en avant-plan et toutes les 30 s ;
 * ils sont affichés via le service worker si possible, sinon Notification, et toujours dans l'application.
 */
import type { JournalEntry } from '../domain/types';
import { newId } from '../domain/ids';
import {
  acknowledgeReminder, cancelRemindersForEntry, dueReminders, markFired, missedReminders, pendingReminders,
  purgeReminders, scheduleReminder, type Reminder,
} from '../data/reminders';

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface InAppNotification { id: string; title: string; body: string; kind: Reminder['kind']; timestamp: number }

interface ServiceOptions {
  getT: () => Translate;
  onInApp: (n: InAppNotification) => void;
  intervalMs?: number;
}

export function canUseNativeNotifications(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

async function showNative(title: string, body: string, tag: string): Promise<boolean> {
  if (!canUseNativeNotifications()) return false;
  const options: NotificationOptions = { body, tag, icon: './icons.svg', badge: './favicon.svg', requireInteraction: true };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, options);
        return true;
      }
    }
    new Notification(title, options);
    return true;
  } catch (error) {
    console.warn('[InsulinCalc] Notification native impossible :', error);
    return false;
  }
}

export function renderReminder(r: Reminder, t: Translate): { title: string; body: string } {
  return { title: t(r.titleCode, r.params) || r.titleCode, body: t(r.bodyCode, r.params) || r.bodyCode };
}

/** Vérifie et déclenche les rappels échus. Renvoie le nombre déclenché. */
export async function processDueReminders(opts: ServiceOptions, now = new Date()): Promise<number> {
  const due = dueReminders(now);
  if (!due.length) return 0;
  const t = opts.getT();
  for (const r of due) {
    const { title, body } = renderReminder(r, t);
    await showNative(title, body, `insulincalc-${r.kind}-${r.id}`);
    opts.onInApp({ id: r.id, title, body, kind: r.kind, timestamp: now.getTime() });
    if (r.kind === 'basal') {
      const next = new Date(r.dueAt);
      next.setDate(next.getDate() + 1);
      scheduleReminder({ kind: 'basal', dueAt: next.toISOString(), titleCode: r.titleCode, bodyCode: r.bodyCode, params: r.params }, localStorage, now);
    }
  }
  markFired(due.map((r) => r.id), now);
  purgeReminders(now);
  return due.length;
}

/** Démarre la boucle de vérification ; renvoie une fonction d'arrêt. */
export function startReminderLoop(opts: ServiceOptions): () => void {
  const interval = opts.intervalMs ?? 30000;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    processDueReminders(opts).catch((e) => console.warn('[InsulinCalc] Rappels :', e));
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') tick();
  };
  tick();
  const id = setInterval(tick, interval);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', tick);
  return () => {
    stopped = true;
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', tick);
  };
}

// ─── Planification métier ────────────────────────────────────────────────────

const plusMinutes = (base: Date, minutes: number) => new Date(base.getTime() + minutes * 60000).toISOString();

/** Rappels d'une entrée de journal : parties différées, phases, contrôle post-repas. */
export function scheduleEntryReminders(entry: JournalEntry, opts: { now?: Date; postMealMinutes?: number } = {}): Reminder[] {
  const now = opts.now ?? new Date();
  const base = new Date(entry.date);
  const start = Number.isNaN(base.getTime()) ? now : base;
  cancelRemindersForEntry(entry.id);
  const out: Reminder[] = [];
  const common = { entryId: entry.id };

  if (entry.bolusType === 'etendu' && Array.isArray(entry.splitPhases)) {
    entry.splitPhases.forEach((phase, index) => {
      if (phase.delayMinutes > 0 && !phase.done) {
        out.push(scheduleReminder({
          ...common, kind: 'phase', dueAt: plusMinutes(start, phase.delayMinutes),
          titleCode: 'REM_PHASE_TITLE', bodyCode: 'REM_PHASE_BODY', params: { phase: index + 1, units: phase.units },
        }, localStorage, now));
      }
    });
  } else if ((entry.bolusType === 'fractionne' || entry.bolusType === 'dual') && (entry.splitDelayed ?? 0) > 0 && (entry.splitDelayMinutes ?? 0) > 0) {
    out.push(scheduleReminder({
      ...common, kind: 'split', dueAt: plusMinutes(start, entry.splitDelayMinutes ?? 0),
      titleCode: 'REM_SPLIT_TITLE', bodyCode: 'REM_SPLIT_BODY', params: { units: entry.splitDelayed ?? 0 },
    }, localStorage, now));
  }

  if ((entry.totalGlucides ?? 0) > 0 || (entry.doseReelle ?? 0) > 0) {
    out.push(scheduleReminder({
      ...common, kind: 'postmeal', dueAt: plusMinutes(start, opts.postMealMinutes ?? 120),
      titleCode: 'REM_POSTMEAL_TITLE', bodyCode: 'REM_POSTMEAL_BODY', params: {},
    }, localStorage, now));
  }
  return out;
}

export function scheduleHypoRecheck(now = new Date(), entryId?: string | number): Reminder {
  return scheduleReminder({
    kind: 'hypo-recheck', dueAt: plusMinutes(now, 15), titleCode: 'REM_HYPO_TITLE', bodyCode: 'REM_HYPO_BODY', params: {}, entryId: entryId ?? null,
  }, localStorage, now);
}

/** Rappel quotidien de basale à l'heure 'HH:MM' (prochaine occurrence). */
export function scheduleDailyBasalReminder(timeHHMM: string | null | undefined, units: number, now = new Date()): Reminder | null {
  const existing = pendingReminders(now).filter((r) => r.kind === 'basal');
  existing.forEach((r) => cancelRemindersForEntry(String(r.entryId ?? '__basal__')));
  // Supprime tout rappel basal planifié (identifiés par kind)
  const stale = pendingReminders(now).filter((r) => r.kind === 'basal');
  if (stale.length) {
    const ids = new Set(stale.map((r) => r.id));
    // réécrit sans eux
    const all = JSON.parse(localStorage.getItem('insulincalc_v7_reminders') ?? '[]') as Reminder[];
    localStorage.setItem('insulincalc_v7_reminders', JSON.stringify(all.filter((r) => !ids.has(r.id))));
  }
  if (!timeHHMM) return null;
  const [h, m] = timeHHMM.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  const due = new Date(now);
  due.setHours(h as number, m as number, 0, 0);
  if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
  return scheduleReminder({
    kind: 'basal', dueAt: due.toISOString(), titleCode: 'REM_BASAL_TITLE', bodyCode: 'REM_BASAL_BODY', params: { units }, entryId: '__basal__',
  }, localStorage, now);
}

export { acknowledgeReminder, missedReminders, pendingReminders, newId };
