// ─── BROWSER NOTIFICATION HELPERS ────────────────────────────────────────────

const STORAGE_KEY = 'insulincalc_v1_pendingNotif';
let scheduledTimer = null;

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  const result = await Notification.requestPermission();
  return result;
}

// ─── PERSISTENCE LAYER ──────────────────────────────────────────────────────

export function persistReminder(targetTimestamp) {
  localStorage.setItem(STORAGE_KEY, String(targetTimestamp));
}

export function getScheduledReminder() {
  const val = localStorage.getItem(STORAGE_KEY);
  if (val === null) return null;
  return Number(val);
}

export function clearReminder() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── SW MESSAGING ───────────────────────────────────────────────────────────

function sendToServiceWorker(message) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  }
}

// ─── SCHEDULING ─────────────────────────────────────────────────────────────

export function schedulePostMealReminder(minutesDelay = 120) {
  // Clear any existing scheduled reminder
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }

  const targetTime = Date.now() + minutesDelay * 60 * 1000;

  // Persist to localStorage so the reminder survives page close
  persistReminder(targetTime);

  // Ask the Service Worker to schedule the notification
  sendToServiceWorker({
    type: 'SCHEDULE_NOTIFICATION',
    targetTime,
    title: 'InsulinCalc — Rappel',
    body: 'Pensez à mesurer votre glycémie post-repas',
  });

  // Fallback: in-page setTimeout (works only while page stays open)
  const ms = minutesDelay * 60 * 1000;
  scheduledTimer = setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('InsulinCalc — Rappel', {
        body: 'Pensez à mesurer votre glycémie post-repas',
        icon: '/favicon.ico',
        tag: 'insulincalc-postmeal',
      });
    }
    clearReminder();
    scheduledTimer = null;
  }, ms);

  return scheduledTimer;
}

export function cancelPostMealReminder() {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
  clearReminder();
}

// ─── CHECK PENDING ON APP LOAD ──────────────────────────────────────────────

export function checkPendingNotification() {
  const targetTime = getScheduledReminder();
  if (targetTime === null) return;

  const now = Date.now();

  if (targetTime <= now) {
    // Target time already passed — show notification immediately
    if (Notification.permission === 'granted') {
      new Notification('InsulinCalc — Rappel', {
        body: 'Pensez à mesurer votre glycémie post-repas',
        icon: '/favicon.ico',
        tag: 'insulincalc-postmeal',
      });
    }
    clearReminder();
  } else {
    // Still in the future — re-schedule via SW
    sendToServiceWorker({
      type: 'SCHEDULE_NOTIFICATION',
      targetTime,
      title: 'InsulinCalc — Rappel',
      body: 'Pensez à mesurer votre glycémie post-repas',
    });

    // Also set in-page fallback
    const remaining = targetTime - now;
    if (scheduledTimer) clearTimeout(scheduledTimer);
    scheduledTimer = setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('InsulinCalc — Rappel', {
          body: 'Pensez à mesurer votre glycémie post-repas',
          icon: '/favicon.ico',
          tag: 'insulincalc-postmeal',
        });
      }
      clearReminder();
      scheduledTimer = null;
    }, remaining);
  }
}
