import { describe, expect, it } from 'vitest';

import { UnitPreference } from '../enums';
import { startOfWeek, toLocalDateString } from '../utils/dates';
import { MAX_ESTIMATE_ONE_RM_REPS, estimateOneRm } from '../utils/one-rm';
import { formatWeight, kgToLb, lbToKg } from '../utils/units';
import { calculateSetVolume, calculateTotalVolume } from '../utils/volume';

describe('shared utils', () => {
  it('calculates per-set and total volume for weighted and timed exercises', () => {
    expect(
      calculateSetVolume({ weight: 100, reps: 5, durationSeconds: null }),
    ).toBe(500);
    expect(
      calculateSetVolume({ weight: 100, reps: 5, durationSeconds: 90 }),
    ).toBe(500);
    expect(
      calculateSetVolume({ weight: null, reps: null, durationSeconds: 90 }),
    ).toBe(0);
    expect(
      calculateSetVolume({ weight: 100, reps: 0, durationSeconds: 45 }),
    ).toBe(0);
    expect(
      calculateSetVolume({ weight: 0, reps: 10, durationSeconds: null }),
    ).toBe(0);
    expect(
      calculateTotalVolume([
        { weight: 100, reps: 5, durationSeconds: null },
        { weight: 80, reps: 8, durationSeconds: null },
        { weight: null, reps: null, durationSeconds: 60 },
      ]),
    ).toBe(1140);
  });

  it('estimates one rep max', () => {
    expect(estimateOneRm(100, 5)).toBeCloseTo(116.6666, 3);
  });

  it('returns zero one rep max for invalid input values', () => {
    expect(estimateOneRm(0, 5)).toBe(0);
    expect(estimateOneRm(100, 0)).toBe(0);
    expect(estimateOneRm(10, 16)).toBe(0);
  });

  it('exports the supported one rep max estimate rep boundary', () => {
    expect(MAX_ESTIMATE_ONE_RM_REPS).toBe(15);
    expect(estimateOneRm(100, MAX_ESTIMATE_ONE_RM_REPS + 1)).toBe(0);
  });

  it('handles the one-rep boundary without returning zero', () => {
    expect(estimateOneRm(100, 1)).toBeCloseTo(103.3333, 3);
  });

  it('formats dates and units for weekly charts', () => {
    expect(toLocalDateString(new Date('2026-02-28T12:00:00.000Z'), 'UTC')).toBe(
      '2026-02-28',
    );
    expect(
      startOfWeek(new Date('2026-02-26T12:00:00.000Z'))
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-02-23');
    expect(
      startOfWeek(new Date('2026-03-01T12:00:00.000Z'))
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-02-23');
    expect(kgToLb(100)).toBeCloseTo(220.46, 2);
    expect(lbToKg(220.46)).toBeCloseTo(100, 1);
    expect(formatWeight(100, UnitPreference.METRIC)).toBe('100.00 kg');
    expect(formatWeight(100, UnitPreference.IMPERIAL)).toContain('lb');
  });

  it('formats dates in non-UTC timezones and falls back to UTC for invalid ones', () => {
    expect(
      toLocalDateString(
        new Date('2026-03-01T04:30:00.000Z'),
        'America/New_York',
      ),
    ).toBe('2026-02-28');
    expect(
      toLocalDateString(new Date('2026-02-28T12:00:00.000Z'), 'Invalid/Zone'),
    ).toBe('2026-02-28');
  });
});
