import { BadRequestException } from '@nestjs/common';
import { getZonedDayRange, validateBookingWindow } from './booking-policy.js';

const settings = {
  timezone: 'Asia/Ho_Chi_Minh',
  openTime: '07:00',
  closeTime: '21:00',
  maxDurationMinutes: 240,
  maxAdvanceDays: 90,
};
const now = new Date('2026-10-31T00:00:00.000Z');

describe('validateBookingWindow', () => {
  it('accepts a valid booking in local opening hours', () => {
    expect(() =>
      validateBookingWindow(
        new Date('2026-11-01T02:00:00.000Z'),
        new Date('2026-11-01T04:00:00.000Z'),
        settings,
        now,
      ),
    ).not.toThrow();
  });

  it('rejects a booking outside opening hours', () => {
    expect(() =>
      validateBookingWindow(
        new Date('2026-11-01T14:00:00.000Z'),
        new Date('2026-11-01T15:00:00.000Z'),
        settings,
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a duration over the configured limit', () => {
    expect(() =>
      validateBookingWindow(
        new Date('2026-11-01T01:00:00.000Z'),
        new Date('2026-11-01T06:00:00.000Z'),
        settings,
        now,
      ),
    ).toThrow('Booking duration cannot exceed 240 minutes');
  });

  it('rejects a booking crossing local midnight', () => {
    expect(() =>
      validateBookingWindow(
        new Date('2026-11-01T16:30:00.000Z'),
        new Date('2026-11-01T17:30:00.000Z'),
        { ...settings, closeTime: '23:59' },
        now,
      ),
    ).toThrow('same local calendar day');
  });
});

describe('getZonedDayRange', () => {
  it('returns the UTC range for a Vietnam calendar day', () => {
    const range = getZonedDayRange('2026-11-01', 'Asia/Ho_Chi_Minh');
    expect(range.from.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-11-01T17:00:00.000Z');
  });

  it('rejects an impossible calendar date', () => {
    expect(() => getZonedDayRange('2026-02-30', 'Asia/Ho_Chi_Minh')).toThrow('valid calendar date');
  });
});
