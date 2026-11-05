import { BadRequestException } from '../common/http-exceptions.js';

export interface BookingPolicySettings {
  timezone: string;
  openTime: string;
  closeTime: string;
  maxDurationMinutes: number;
  maxAdvanceDays: number;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
}

export function validateBookingWindow(
  start: Date,
  end: Date,
  settings: BookingPolicySettings,
  now = new Date(),
) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new BadRequestException('Invalid booking time');
  }
  if (start <= now) throw new BadRequestException('startTime must be in the future');
  if (end <= start) throw new BadRequestException('endTime must be later than startTime');

  const durationMinutes = (end.getTime() - start.getTime()) / 60_000;
  if (durationMinutes > settings.maxDurationMinutes) {
    throw new BadRequestException(
      `Booking duration cannot exceed ${settings.maxDurationMinutes} minutes`,
    );
  }
  if (start.getTime() > now.getTime() + settings.maxAdvanceDays * 86_400_000) {
    throw new BadRequestException(
      `Booking cannot be made more than ${settings.maxAdvanceDays} days in advance`,
    );
  }

  const localStart = localParts(start, settings.timezone);
  const localEnd = localParts(end, settings.timezone);
  if (
    localStart.weekday === 'Sat' ||
    localStart.weekday === 'Sun' ||
    localEnd.weekday === 'Sat' ||
    localEnd.weekday === 'Sun'
  ) {
    throw new BadRequestException('Bookings are only allowed on workdays (Monday–Friday)');
  }

  if (
    localStart.year !== localEnd.year ||
    localStart.month !== localEnd.month ||
    localStart.day !== localEnd.day
  ) {
    throw new BadRequestException('Booking must start and end on the same local calendar day');
  }

  const startMinutes = localStart.hour * 60 + localStart.minute;
  const endMinutes = localEnd.hour * 60 + localEnd.minute;
  if (
    startMinutes < timeToMinutes(settings.openTime) ||
    endMinutes > timeToMinutes(settings.closeTime)
  ) {
    throw new BadRequestException(
      `Booking must be within opening hours ${settings.openTime.trim()}-${settings.closeTime.trim()}`,
    );
  }
}

export function validateStaffBookingWindow(
  start: Date,
  end: Date,
  settings: Pick<BookingPolicySettings, 'timezone' | 'openTime' | 'closeTime'>,
  now = new Date(),
) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new BadRequestException('Invalid booking time');
  }
  if (end <= start) throw new BadRequestException('endTime must be later than startTime');
  if (end <= now) throw new BadRequestException('endTime must be in the future');

  const localStart = localParts(start, settings.timezone);
  const localEnd = localParts(end, settings.timezone);
  if (
    localStart.weekday === 'Sat' ||
    localStart.weekday === 'Sun' ||
    localEnd.weekday === 'Sat' ||
    localEnd.weekday === 'Sun'
  ) {
    throw new BadRequestException('Bookings are only allowed on workdays (Monday–Friday)');
  }

  if (
    localStart.year !== localEnd.year ||
    localStart.month !== localEnd.month ||
    localStart.day !== localEnd.day
  ) {
    throw new BadRequestException('Booking must start and end on the same local calendar day');
  }

  const startMinutes = localStart.hour * 60 + localStart.minute;
  const endMinutes = localEnd.hour * 60 + localEnd.minute;
  if (
    startMinutes < timeToMinutes(settings.openTime) ||
    endMinutes > timeToMinutes(settings.closeTime)
  ) {
    throw new BadRequestException(
      `Booking must be within opening hours ${settings.openTime.trim()}-${settings.closeTime.trim()}`,
    );
  }
}

export function getZonedDayRange(date: string | undefined, timezone: string, now = new Date()) {
  const current = localParts(now, timezone);
  const value = date ?? `${current.year}-${pad(current.month)}-${pad(current.day)}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('date must use YYYY-MM-DD format');
  }
  const [year, month, day] = value.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new BadRequestException('date is not a valid calendar date');
  }
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    date: value,
    from: zonedLocalMidnightToUtc(year, month, day, timezone),
    to: zonedLocalMidnightToUtc(
      next.getUTCFullYear(),
      next.getUTCMonth() + 1,
      next.getUTCDate(),
      timezone,
    ),
  };
}

function localParts(date: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (name: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === name)?.value);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    weekday,
  };
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.trim().split(':').map(Number);
  return hour * 60 + minute;
}

function zonedLocalMidnightToUtc(year: number, month: number, day: number, timezone: string) {
  const targetAsUtc = Date.UTC(year, month - 1, day, 0, 0);
  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seen = localParts(new Date(candidate), timezone);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    candidate += targetAsUtc - seenAsUtc;
  }
  return new Date(candidate);
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}
