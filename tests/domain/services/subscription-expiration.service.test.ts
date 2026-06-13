import { calculateSubscriptionExpiration } from '../../../src/domain/services';

describe('calculateSubscriptionExpiration', () => {
  it('returns null for a free plan', () => {
    const startedAt = new Date('2026-01-15T10:30:00.000Z');

    expect(calculateSubscriptionExpiration(startedAt, null)).toBeNull();
  });

  it('adds one month while preserving the day and time', () => {
    const startedAt = new Date('2026-01-15T10:30:00.000Z');

    const result = calculateSubscriptionExpiration(startedAt, 'MONTHLY');

    expect(result).toEqual(new Date('2026-02-15T10:30:00.000Z'));
  });

  it('uses the last valid day when the target month is shorter', () => {
    const startedAt = new Date('2026-01-31T10:30:00.000Z');

    const result = calculateSubscriptionExpiration(startedAt, 'MONTHLY');

    expect(result).toEqual(new Date('2026-02-28T10:30:00.000Z'));
  });

  it('supports February in a leap year', () => {
    const startedAt = new Date('2028-01-31T10:30:00.000Z');

    const result = calculateSubscriptionExpiration(startedAt, 'MONTHLY');

    expect(result).toEqual(new Date('2028-02-29T10:30:00.000Z'));
  });

  it('adds one year while preserving the date and time', () => {
    const startedAt = new Date('2026-06-12T10:30:00.000Z');

    const result = calculateSubscriptionExpiration(startedAt, 'YEARLY');

    expect(result).toEqual(new Date('2027-06-12T10:30:00.000Z'));
  });

  it('does not mutate the original date', () => {
    const startedAt = new Date('2026-01-31T10:30:00.000Z');
    const originalTimestamp = startedAt.getTime();

    calculateSubscriptionExpiration(startedAt, 'MONTHLY');

    expect(startedAt.getTime()).toBe(originalTimestamp);
  });

  it('uses February 28 when a yearly subscription starts on leap day', () => {
    const startedAt = new Date('2028-02-29T10:30:00.000Z');

    const result = calculateSubscriptionExpiration(startedAt, 'YEARLY');

    expect(result).toEqual(new Date('2029-02-28T10:30:00.000Z'));
  });
});
