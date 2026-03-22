import { describe, it, expect } from 'vitest';
import { glycColor, glycLabel, stripDiacritics } from '../colors.js';

describe('glycColor', () => {
  it('returns muted for null', () => expect(glycColor(null)).toBe('#2d3f50'));
  it('returns red for hypo (< 0.7)', () => expect(glycColor(0.5)).toBe('#ef4444'));
  it('returns green for target zone (1.0-1.8)', () => expect(glycColor(1.4)).toBe('#22c55e'));
  it('returns dark red for emergency (> 3.0)', () => expect(glycColor(3.5)).toBe('#dc2626'));
});

describe('glycLabel', () => {
  it('returns dash for null', () => expect(glycLabel(null)).toBe('—'));
  it('returns zone cible for 1.4', () => expect(glycLabel(1.4)).toContain('Zone cible'));
  it('returns urgence for > 3.0', () => expect(glycLabel(3.5)).toContain('URGENCE'));
});

describe('stripDiacritics', () => {
  it('strips accents from French text', () => expect(stripDiacritics('élevé')).toBe('eleve'));
  it('preserves non-accented text', () => expect(stripDiacritics('pain')).toBe('pain'));
});
