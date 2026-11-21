// All calendar maths happens in campus wall-clock time (Asia/Ho_Chi_Minh),
// independent of the browser's time zone. Vietnam has no DST, so a fixed
// UTC+07:00 offset is exact: campus wall fields are the UTC fields of
// (instant + 7h). NEVER use Date#getHours/setHours/getDay etc. on booking
// instants outside this module.

export const CAMPUS_TZ = 'Asia/Ho_Chi_Minh'
export const CAMPUS_OFFSET_MIN = 7 * 60
const OFFSET_MS = CAMPUS_OFFSET_MIN * 60_000
export const DAY_MS = 86_400_000

const shifted = (d: Date | string) => new Date(new Date(d).getTime() + OFFSET_MS)

/** Instant for the given campus wall-clock fields (month is 0-based). */
export function campusDate(y: number, mo: number, day: number, h = 0, m = 0, s = 0) {
  return new Date(Date.UTC(y, mo, day, h, m, s) - OFFSET_MS)
}

export function campusParts(d: Date | string) {
  const x = shifted(d)
  return {
    year: x.getUTCFullYear(),
    month: x.getUTCMonth(),
    day: x.getUTCDate(),
    hour: x.getUTCHours(),
    minute: x.getUTCMinutes(),
    second: x.getUTCSeconds(),
    dow: x.getUTCDay(), // 0 = Sunday
  }
}

export const hourOf = (d: Date | string) => campusParts(d).hour
export const minuteOf = (d: Date | string) => campusParts(d).minute
/** Minutes since campus midnight. */
export const minutesOfDay = (d: Date | string) => {
  const p = campusParts(d)
  return p.hour * 60 + p.minute
}
/** 0 = Sunday … 6 = Saturday, in campus time. */
export const dowOf = (d: Date | string) => campusParts(d).dow

/** Stable YYYY-MM-DD key of the campus day. */
export function dayKey(d: Date | string) {
  const p = campusParts(d)
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`
}

export function startOfDay(d: Date | string) {
  const p = campusParts(d)
  return campusDate(p.year, p.month, p.day)
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY_MS)
}

export function startOfWeek(d: Date) {
  const x = startOfDay(d)
  const dow = (dowOf(x) + 6) % 7 // Monday = 0
  return addDays(x, -dow)
}

/** Campus wall-clock time h:m on the campus day containing d. */
export function at(d: Date, h: number, m = 0) {
  return new Date(startOfDay(d).getTime() + (h * 60 + m) * 60_000)
}

export function sameDay(a: Date | string, b: Date | string) {
  return dayKey(a) === dayKey(b)
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

const pad = (n: number) => String(n).padStart(2, '0')

export function fmtTime(d: Date | string) {
  const p = campusParts(d)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function fmtDow(d: Date | string) {
  return DOW[dowOf(d)]
}

export function fmtDate(d: Date | string) {
  const p = campusParts(d)
  return `${DOW[p.dow]} ${pad(p.day)} ${MON[p.month]}`
}

export function fmtShort(d: Date | string) {
  const p = campusParts(d)
  return `${pad(p.day)} ${MON[p.month]}`
}

export function fmtStamp(d: Date | string) {
  const p = campusParts(d)
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
}

export function fmtRange(start: string | Date, end: string | Date) {
  return `${fmtTime(start)}–${fmtTime(end)}`
}

export function durationMin(start: string | Date, end: string | Date) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

export function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

export function parseHM(s: string) {
  const [h, m] = s.split(':').map(Number)
  return { h: h || 0, m: m || 0 }
}

/** Value for <input type="datetime-local">, in campus time. */
export function toLocalInput(d: Date) {
  const p = campusParts(d)
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** Parse a datetime-local / date input value ("YYYY-MM-DD[THH:mm]") as campus time. */
export function fromLocalInput(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(v)
  if (!m) return null
  return campusDate(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0)
}

/** ISO 8601 string with the campus offset, e.g. 2026-11-23T09:00:00+07:00. */
export function toCampusIso(d: Date) {
  const p = campusParts(d)
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}+07:00`
}

export function overlaps(aStart: string | Date, aEnd: string | Date, bStart: string | Date, bEnd: string | Date) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd)
}

export function isWeekend(d: Date): boolean {
  const day = dowOf(d)
  return day === 0 || day === 6
}

export function ensureWorkday(d: Date): Date {
  const day = dowOf(d)
  if (day === 6) return addDays(d, 2)
  if (day === 0) return addDays(d, 1)
  return new Date(d)
}
