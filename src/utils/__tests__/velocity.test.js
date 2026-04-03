import { describe, it, expect } from 'vitest';
import { calcVelocity, classifyVelocity, adjustDoseForVelocity } from '../velocity.js';

describe('velocity', () => {
  it('should calculate velocity in g/L/h', () => {
    expect(calcVelocity(1.8, 1.4, 120)).toBeCloseTo(0.2);
  });

  it('should return null with missing data', () => {
    expect(calcVelocity(1.8, null, 120)).toBeNull();
    expect(calcVelocity(1.8, 1.4, 0)).toBeNull();
  });

  it('should classify falling_fast', () => {
    expect(classifyVelocity(-0.5)).toBe('falling_fast');
  });

  it('should classify stable', () => {
    expect(classifyVelocity(0.05)).toBe('stable');
    expect(classifyVelocity(-0.10)).toBe('stable');
  });

  it('should classify rising_fast', () => {
    expect(classifyVelocity(0.5)).toBe('rising_fast');
  });

  it('should zero correction on rapid drop', () => {
    expect(adjustDoseForVelocity(2.0, 'falling_fast')).toBe(0);
  });

  it('should reduce correction 50% on moderate drop', () => {
    expect(adjustDoseForVelocity(2.0, 'falling')).toBe(1.0);
  });

  it('should increase correction 20% on rapid rise (rounded to 0.5)', () => {
    expect(adjustDoseForVelocity(2.0, 'rising_fast')).toBe(2.5);
  });
});
