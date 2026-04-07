// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { persistReminder, getScheduledReminder, clearReminder } from '../notifications.js';

describe('notification persistence', () => {
  beforeEach(() => localStorage.clear());

  it('should persist reminder to localStorage', () => {
    const targetTime = Date.now() + 120 * 60000;
    persistReminder(targetTime);
    const saved = getScheduledReminder();
    expect(saved).toBe(targetTime);
  });

  it('should clear reminder', () => {
    persistReminder(Date.now() + 60000);
    clearReminder();
    expect(getScheduledReminder()).toBeNull();
  });

  it('should return null when no reminder set', () => {
    expect(getScheduledReminder()).toBeNull();
  });

  it('should overwrite previous reminder when persisting a new one', () => {
    const time1 = Date.now() + 60000;
    const time2 = Date.now() + 120000;
    persistReminder(time1);
    persistReminder(time2);
    expect(getScheduledReminder()).toBe(time2);
  });
});
