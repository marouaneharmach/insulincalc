// ─── BROWSER NOTIFICATION HELPERS ────────────────────────────────────────────

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

export function schedulePostMealReminder(minutesDelay = 120) {
  // Clear any existing scheduled reminder
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }

  const ms = minutesDelay * 60 * 1000;

  scheduledTimer = setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('InsulinCalc — Rappel', {
        body: 'Pensez à mesurer votre glycémie post-repas',
        icon: '/favicon.ico',
        tag: 'insulincalc-postmeal',
      });
    }
    scheduledTimer = null;
  }, ms);

  return scheduledTimer;
}

export function cancelPostMealReminder() {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
}
