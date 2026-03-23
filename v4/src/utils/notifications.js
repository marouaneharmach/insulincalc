// V4 — Smart notifications tied to injection schedule
let scheduledTimers = [];

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

// V4 NEW: Schedule multiple notifications based on injection schedule
export function scheduleFromPlan(schedule, mealTime = new Date()) {
  cancelAll();

  schedule.forEach((step, index) => {
    const delayMs = step.timeMin * 60 * 1000; // timeMin is relative to meal start
    const actualDelay = Math.max(0, delayMs); // don't schedule past events

    if (step.units === null) {
      // This is a control step — schedule a reminder
      const timer = setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('InsulinCalc — Contrôle glycémie', {
            body: `${step.label}\n${step.note}`,
            icon: '/icon-192.png',
            tag: `insulincalc-control-${index}`,
            requireInteraction: true,
          });
        }
      }, actualDelay);
      scheduledTimers.push(timer);
    } else if (step.timeMin > 0) {
      // Future injection step (phase 2 of dual bolus)
      const timer = setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('InsulinCalc — Injection rappel', {
            body: `${step.label}\n💉 ${step.units} unités\n${step.note}`,
            icon: '/icon-192.png',
            tag: `insulincalc-injection-${index}`,
            requireInteraction: true,
          });
        }
      }, actualDelay);
      scheduledTimers.push(timer);
    }
  });

  return scheduledTimers.length;
}

// Legacy simple reminder (kept for backward compat)
export function schedulePostMealReminder(minutesDelay = 120) {
  const timer = setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('InsulinCalc — Rappel', {
        body: 'Pensez à mesurer votre glycémie post-repas',
        icon: '/icon-192.png',
        tag: 'insulincalc-postmeal',
      });
    }
  }, minutesDelay * 60 * 1000);
  scheduledTimers.push(timer);
  return timer;
}

export function cancelAll() {
  scheduledTimers.forEach(t => clearTimeout(t));
  scheduledTimers = [];
}

// V4 NEW: Get active scheduled reminders info
export function getActiveReminders() {
  return scheduledTimers.length;
}
