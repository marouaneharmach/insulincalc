import { describe, expect, it } from 'vitest';
import type { GlucoseReading } from '../../types';
import { roundTo } from '../../units';
import {
  AGP_PERCENTILE_KEYS,
  agpSummary,
  computeAGP,
  normalizeBucketMinutes,
  smoothProfile,
  type AGPBucket,
  type AGPProfile,
} from '../agp';

const DAYS = 14;
const STEP_MIN = 30;
const BASE = 1.2;
const AMPLITUDE = 0.4;
/** Décalage journalier symétrique autour de 0 : -0.13, -0.11 … +0.13 (pas 0.02). */
const dayOffset = (d: number): number => 0.02 * (d - (DAYS - 1) / 2);
const expectedBase = (hour: number): number => BASE + AMPLITUDE * Math.sin((2 * Math.PI * hour) / 24);

/** 14 jours à partir du 1er octobre 2026 (heure locale), une lecture toutes les 30 min. */
function makeReadings(days = DAYS, stepMin = STEP_MIN): GlucoseReading[] {
  const out: GlucoseReading[] = [];
  for (let d = 0; d < days; d++) {
    for (let m = 0; m < 24 * 60; m += stepMin) {
      const at = new Date(2026, 9, 1 + d, Math.floor(m / 60), m % 60, 0, 0);
      out.push({ value: expectedBase(m / 60) + dayOffset(d), at, kind: 'cgm', entryId: `d${d}-m${m}` });
    }
  }
  return out;
}

/** Une lecture par heure sur une seule journée, valeur = f(heure). */
function hourlyDay(valueOf: (hour: number) => number, hours: number[] = Array.from({ length: 24 }, (_, h) => h)): GlucoseReading[] {
  return hours.map((h) => ({ value: valueOf(h), at: new Date(2026, 9, 5, h, 0, 0, 0), kind: 'spot', entryId: `h${h}` }));
}

/** Percentile de référence (interpolation linéaire) écrit indépendamment du module. */
function refPercentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * (rank - lo);
}

/** Tolérance d'un arrondi à 2 décimales. */
const ROUND_TOL = 0.0051;

function expectNear(received: number | null, expected: number, tol = ROUND_TOL): void {
  expect(received).not.toBeNull();
  expect(Math.abs((received as number) - expected)).toBeLessThanOrEqual(tol);
}

function expectMonotonic(bucket: AGPBucket): void {
  const values = AGP_PERCENTILE_KEYS.map((k) => bucket[k]);
  if (bucket.n === 0) {
    values.forEach((v) => expect(v).toBeNull());
    return;
  }
  values.forEach((v) => expect(v).not.toBeNull());
  for (let i = 1; i < values.length; i++) {
    expect(values[i] as number).toBeGreaterThanOrEqual(values[i - 1] as number);
  }
}

function expectTwoDecimals(profile: AGPProfile): void {
  for (const b of profile.buckets) {
    for (const k of AGP_PERCENTILE_KEYS) {
      const v = b[k];
      if (v != null) expect(roundTo(v, 2)).toBe(v);
    }
  }
}

describe('computeAGP', () => {
  const readings = makeReadings();
  const profile = computeAGP(readings);

  it('produit 24 tranches de 60 min avec 28 lectures chacune, hour = index', () => {
    expect(profile.bucketMinutes).toBe(60);
    expect(profile.buckets).toHaveLength(24);
    profile.buckets.forEach((b, i) => {
      expect(b.hour).toBe(i);
      expect(b.n).toBe(DAYS * 2);
    });
    expect(profile.readingsCount).toBe(DAYS * 48);
  });

  it('calcule une médiane proche de la sinusoïde attendue', () => {
    for (const b of profile.buckets) {
      // 2 lectures par heure (h et h+0.5) : la médiane approche la valeur à h+0.25.
      expectNear(b.p50, expectedBase(b.hour + 0.25), 0.05);
    }
  });

  it('respecte l’ordre p5 ≤ p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90 ≤ p95 dans chaque tranche', () => {
    profile.buckets.forEach(expectMonotonic);
  });

  it('reproduit un percentile de référence calculé indépendamment', () => {
    for (const b of profile.buckets) {
      const values = readings.filter((r) => r.at.getHours() === b.hour).map((r) => r.value);
      expect(values).toHaveLength(b.n);
      expectNear(b.p10, refPercentile(values, 10));
      expectNear(b.p50, refPercentile(values, 50));
      expectNear(b.p90, refPercentile(values, 90));
    }
  });

  it('arrondit toutes les sorties à 2 décimales', () => {
    expectTwoDecimals(profile);
  });

  it('compte 14 journées avec données et une couverture de 1 sur l’étendue des données', () => {
    expect(profile.daysWithData).toBe(DAYS);
    expect(profile.daysInWindow).toBe(DAYS);
    expect(profile.coverage).toBe(1);
    expect(profile.from).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    expect(profile.to).toEqual(new Date(2026, 9, 14, 23, 30, 0, 0));
  });

  it('donne coverage = 1 et daysInWindow = 14 avec days = 14', () => {
    const now = new Date(2026, 9, 15, 0, 0, 0, 0);
    const p = computeAGP(readings, { days: 14, now });
    expect(p.daysInWindow).toBe(14);
    expect(p.daysWithData).toBe(14);
    expect(p.coverage).toBe(1);
    expect(p.readingsCount).toBe(DAYS * 48);
    expect(p.from).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    expect(p.to).toEqual(now);
  });

  it('exclut les lectures hors fenêtre quand days est fourni', () => {
    const old: GlucoseReading[] = [
      { value: 2.5, at: new Date(2026, 7, 20, 8, 0, 0, 0), kind: 'pre', entryId: 'old-1' },
      { value: 2.6, at: new Date(2026, 7, 20, 20, 0, 0, 0), kind: 'post', entryId: 'old-2' },
    ];
    const withOld = [...old, ...readings];

    const filtered = computeAGP(withOld, { days: 14, now: new Date(2026, 9, 15, 0, 0, 0, 0) });
    expect(filtered.readingsCount).toBe(DAYS * 48);
    expect(filtered.daysWithData).toBe(14);
    expect(filtered.coverage).toBe(1);
    // la valeur 2.5 d'août ne doit pas remonter dans la tranche 8 h
    expect(filtered.buckets[8]?.p95 as number).toBeLessThan(2);

    const unfiltered = computeAGP(withOld);
    expect(unfiltered.readingsCount).toBe(DAYS * 48 + 2);
    expect(unfiltered.daysWithData).toBe(15);
    // 20 août → 14 octobre = 12 + 30 + 14 jours calendaires
    expect(unfiltered.daysInWindow).toBe(56);
    expect(unfiltered.coverage).toBeCloseTo(15 / 56, 6);
    expect(unfiltered.from).toEqual(new Date(2026, 7, 20, 8, 0, 0, 0));
  });

  it('borne la fenêtre à [now - days, now] inclus, lectures futures exclues', () => {
    const now = new Date(2026, 9, 7, 23, 59, 0, 0);
    const p = computeAGP(readings, { days: 7, now });
    expect(p.readingsCount).toBe(7 * 48);
    expect(p.daysWithData).toBe(7);
    expect(p.daysInWindow).toBe(7);
    expect(p.coverage).toBe(1);
  });

  it('renvoie un profil vide (tout null, readingsCount 0) sans lecture', () => {
    const p = computeAGP([]);
    expect(p.buckets).toHaveLength(24);
    p.buckets.forEach((b) => {
      expect(b.n).toBe(0);
      expectMonotonic(b);
    });
    expect(p.readingsCount).toBe(0);
    expect(p.daysWithData).toBe(0);
    expect(p.daysInWindow).toBe(0);
    expect(p.coverage).toBe(0);
    expect(p.from).toBeNull();
    expect(p.to).toBeNull();
  });

  it('produit 48 tranches de 30 min avec des percentiles exacts', () => {
    const p = computeAGP(readings, { bucketMinutes: 30 });
    expect(p.bucketMinutes).toBe(30);
    expect(p.buckets).toHaveLength(48);
    p.buckets.forEach((b, i) => {
      expect(b.hour).toBe(i / 2);
      expect(b.n).toBe(DAYS);
      const base = expectedBase(b.hour);
      // Percentiles analytiques des 14 décalages -0.13 … +0.13 (interpolation linéaire).
      expectNear(b.p5, base - 0.117);
      expectNear(b.p10, base - 0.104);
      expectNear(b.p25, base - 0.065);
      expectNear(b.p50, base);
      expectNear(b.p75, base + 0.065);
      expectNear(b.p90, base + 0.104);
      expectNear(b.p95, base + 0.117);
      expectMonotonic(b);
    });
    expectTwoDecimals(p);
  });

  it('attribue tous les percentiles à la valeur unique quand n = 1', () => {
    const p = computeAGP([{ value: 1.37, at: new Date(2026, 9, 3, 7, 45, 0, 0), kind: 'pre', entryId: 'x' }]);
    const b = p.buckets[7] as AGPBucket;
    expect(b.n).toBe(1);
    AGP_PERCENTILE_KEYS.forEach((k) => expect(b[k]).toBe(1.37));
    expect(p.buckets.filter((x) => x.n > 0)).toHaveLength(1);
    expect(p.daysWithData).toBe(1);
    expect(p.daysInWindow).toBe(1);
    expect(p.coverage).toBe(1);
  });

  it('ignore les lectures invalides (NaN, ≤ 0, date invalide)', () => {
    const bad: GlucoseReading[] = [
      { value: Number.NaN, at: new Date(2026, 9, 3, 7, 0, 0, 0), kind: 'spot', entryId: 'nan' },
      { value: 0, at: new Date(2026, 9, 3, 7, 0, 0, 0), kind: 'spot', entryId: 'zero' },
      { value: -1, at: new Date(2026, 9, 3, 7, 0, 0, 0), kind: 'spot', entryId: 'neg' },
      { value: 1.1, at: new Date(Number.NaN), kind: 'spot', entryId: 'bad-date' },
      { value: 1.1, at: new Date(2026, 9, 3, 7, 0, 0, 0), kind: 'spot', entryId: 'ok' },
    ];
    const p = computeAGP(bad);
    expect(p.readingsCount).toBe(1);
    expect(p.buckets[7]?.n).toBe(1);
    expect(p.buckets[7]?.p50).toBe(1.1);
  });

  it('est indépendant de l’ordre des lectures', () => {
    const shuffled = [...readings].reverse();
    expect(computeAGP(shuffled)).toEqual(profile);
  });

  it('retombe sur 60 min pour un bucketMinutes invalide', () => {
    expect(normalizeBucketMinutes(undefined)).toBe(60);
    expect(normalizeBucketMinutes(30)).toBe(30);
    expect(normalizeBucketMinutes(15)).toBe(15);
    expect(normalizeBucketMinutes(7)).toBe(60);
    expect(normalizeBucketMinutes(0)).toBe(60);
    expect(normalizeBucketMinutes(-30)).toBe(60);
    expect(normalizeBucketMinutes(45.5)).toBe(60);
    expect(computeAGP(readings, { bucketMinutes: 7 }).buckets).toHaveLength(24);
  });
});

describe('smoothProfile', () => {
  const profile = computeAGP(makeReadings());

  it('conserve la longueur, bucketMinutes, n et hour, et l’ordre des percentiles', () => {
    const s = smoothProfile(profile);
    expect(s.buckets).toHaveLength(profile.buckets.length);
    expect(s.bucketMinutes).toBe(profile.bucketMinutes);
    expect(s.readingsCount).toBe(profile.readingsCount);
    s.buckets.forEach((b, i) => {
      expect(b.n).toBe(profile.buckets[i]?.n);
      expect(b.hour).toBe(profile.buckets[i]?.hour);
      expectMonotonic(b);
      // la sinusoïde est lisse : le lissage ne s'éloigne que peu de l'original
      expectNear(b.p50, profile.buckets[i]?.p50 as number, 0.05);
    });
    expectTwoDecimals(s);
  });

  it('ne modifie pas le profil d’origine et renvoie une copie pour window ≤ 1', () => {
    const before = JSON.stringify(profile);
    const same = smoothProfile(profile, 1);
    expect(JSON.stringify(profile)).toBe(before);
    expect(same).toEqual(profile);
    expect(same.buckets).not.toBe(profile.buckets);
  });

  it('applique une moyenne mobile circulaire (23 h voisine de 0 h)', () => {
    const value = (h: number) => 0.8 + 0.04 * h;
    const s = smoothProfile(computeAGP(hourlyDay(value)), 3);
    // 0 h = moyenne(23 h, 0 h, 1 h) = (1.72 + 0.80 + 0.84) / 3
    expect(s.buckets[0]?.p50).toBeCloseTo(1.12, 2);
    // 23 h = moyenne(22 h, 23 h, 0 h) = (1.68 + 1.72 + 0.80) / 3
    expect(s.buckets[23]?.p50).toBeCloseTo(1.4, 2);
    // au centre, la moyenne mobile d'une droite est la valeur elle-même
    expect(s.buckets[12]?.p50).toBeCloseTo(value(12), 2);
  });

  it('ignore les voisins sans donnée et laisse les tranches vides à null', () => {
    const value = (h: number) => 0.8 + 0.04 * h;
    const hours = Array.from({ length: 12 }, (_, h) => h); // 0 h … 11 h seulement
    const s = smoothProfile(computeAGP(hourlyDay(value, hours)), 3);
    expect(s.buckets[12]?.n).toBe(0);
    expect(s.buckets[12]?.p50).toBeNull();
    expect(s.buckets[23]?.p50).toBeNull();
    // 11 h = moyenne(10 h, 11 h) car 12 h est vide
    expect(s.buckets[11]?.p50).toBeCloseTo((value(10) + value(11)) / 2, 2);
    // 0 h = moyenne(0 h, 1 h) car 23 h est vide
    expect(s.buckets[0]?.p50).toBeCloseTo((value(0) + value(1)) / 2, 2);
  });

  it('élargit une fenêtre paire à l’impair supérieur', () => {
    const value = (h: number) => 0.8 + 0.04 * h;
    const base = computeAGP(hourlyDay(value));
    expect(smoothProfile(base, 4)).toEqual(smoothProfile(base, 5));
  });
});

describe('agpSummary', () => {
  it('renvoie des valeurs finies et cohérentes sur des données synthétiques', () => {
    const summary = agpSummary(computeAGP(makeReadings(), { bucketMinutes: 30 }));
    expect(Number.isFinite(summary.medianMean)).toBe(true);
    expect(Number.isFinite(summary.iqrMean)).toBe(true);
    expect(Number.isFinite(summary.widestHour)).toBe(true);
    // la moyenne d'une sinusoïde sur un cycle complet est nulle → médiane moyenne ≈ 1.2
    expectNear(summary.medianMean, BASE, 0.01);
    // IQR = 2 × 0.065 sur chaque tranche
    expectNear(summary.iqrMean, 0.13, 0.01);
    expect(summary.widestHour as number).toBeGreaterThanOrEqual(0);
    expect(summary.widestHour as number).toBeLessThan(24);
  });

  it('identifie la tranche la plus dispersée (p90 - p10 maximal)', () => {
    const steady = hourlyDay(() => 1.0);
    const spread: GlucoseReading[] = [0.6, 1.0, 1.4, 2.0, 2.6].map((value, i) => ({
      value,
      at: new Date(2026, 9, 5, 14, i * 5, 0, 0),
      kind: 'cgm',
      entryId: `spread-${i}`,
    }));
    const summary = agpSummary(computeAGP([...steady, ...spread]));
    expect(summary.widestHour).toBe(14);
    expect(summary.medianMean).not.toBeNull();
  });

  it('renvoie null partout pour un profil sans donnée', () => {
    expect(agpSummary(computeAGP([]))).toEqual({ medianMean: null, iqrMean: null, widestHour: null });
  });
});
