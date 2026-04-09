// V4.3 — Smart notifications with Safari/private-browsing fallback
let scheduledTimers = [];
let onFallbackNotification = null; // callback for in-app fallback

export function setFallbackHandler(handler) {
  onFallbackNotification = handler;
}

function canUseNativeNotifications() {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  // Safari private browsing: Notification exists but silently fails
  // We can't detect this reliably, so we always fire fallback too
  return true;
}

function fireNotification(title, body, tag) {
  // Try native notification
  if (canUseNativeNotifications()) {
    try {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        tag,
        requireInteraction: true,
      });
    } catch (e) {
      console.warn('[InsulinCalc] Native notification failed:', e);
    }
  }
  // Always fire in-app fallback (visible even when native fails)
  if (onFallbackNotification) {
    onFallbackNotification({ title, body, tag, timestamp: Date.now() });
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

// Schedule multiple notifications based on injection schedule
export function scheduleFromPlan(schedule) {
  cancelAll();

  schedule.forEach((step, index) => {
    const delayMs = step.timeMin * 60 * 1000;
    const actualDelay = Math.max(0, delayMs);

    if (actualDelay === 0 && step.timeMin > 0) return; // past event

    if (step.units === null) {
      // Control step — schedule a reminder
      const timer = setTimeout(() => {
        fireNotification(
          'InsulinCalc — Contrôle glycémie',
          `${step.label}\n${step.note || ''}`,
          `insulincalc-control-${index}`
        );
      }, actualDelay);
      scheduledTimers.push(timer);
    } else if (step.timeMin > 0) {
      // Future injection step (phase 2 of dual bolus)
      const timer = setTimeout(() => {
        fireNotification(
          'InsulinCalc — Injection rappel',
          `${step.label}\n💉 ${step.units} unités\n${step.note || ''}`,
          `insulincalc-injection-${index}`
        );
      }, actualDelay);
      scheduledTimers.push(timer);
    }
  });

  return scheduledTimers.length;
}

// Legacy simple reminder
export function schedulePostMealReminder(minutesDelay = 120) {
  const timer = setTimeout(() => {
    fireNotification(
      'InsulinCalc — Rappel',
      'Pensez à mesurer votre glycémie post-repas',
      'insulincalc-postmeal'
    );
  }, minutesDelay * 60 * 1000);
  scheduledTimers.push(timer);
  return timer;
}

/**
 * Schedule a notification for the delayed part of a split bolus.
 * @param {number} delayMinutes - Minutes from now
 * @param {number} units - Delayed dose units
 */
export function scheduleSplitReminder(delayMinutes, units) {
  const timer = setTimeout(() => {
    fireNotification(
      '💉 Dose différée',
      `Injecter ${units} unités maintenant (2e partie du bolus fractionné)`,
      'split-bolus-reminder'
    );
  }, delayMinutes * 60 * 1000);
  scheduledTimers.push(timer);
}

export function cancelAll() {
  scheduledTimers.forEach(t => clearTimeout(t));
  scheduledTimers = [];
}

export function getActiveReminders() {
  return scheduledTimers.length;
}
