export const DAY_MS = 86_400_000

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function startOfWeek(d: Date) {
  const x = startOfDay(d)
  const dow = (x.getDay() + 6) % 7 // Monday = 0
  return addDays(x, -dow)
}

export function at(d: Date, h: number, m = 0) {
  const x = startOfDay(d)
  x.setHours(h, m, 0, 0)
  return x
}

export function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

const pad = (n: number) => String(n).padStart(2, '0')

export function fmtTime(d: Date | string) {
  const x = new Date(d)
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function fmtDow(d: Date) {
  return DOW[d.getDay()]
}

export function fmtDate(d: Date | string) {
  const x = new Date(d)
  return `${DOW[x.getDay()]} ${pad(x.getDate())} ${MON[x.getMonth()]}`
}

export function fmtShort(d: Date | string) {
  const x = new Date(d)
  return `${pad(x.getDate())} ${MON[x.getMonth()]}`
}

export function fmtStamp(d: Date | string) {
  const x = new Date(d)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`
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

export function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function overlaps(aStart: string | Date, aEnd: string | Date, bStart: string | Date, bEnd: string | Date) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd)
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

export function ensureWorkday(d: Date): Date {
  return new Date(d)
}
