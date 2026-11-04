import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { ACTIVE_STATUSES } from '@/lib/store'
import type { Booking, Room, RoomBlock, Settings } from '@/lib/types'
import { addDays, at, daysBetween, durationMin, fmtDuration, fmtTime, overlaps, parseHM, sameDay, startOfDay } from '@/lib/time'
import { cx } from '@/components/ui'

const SLOT = 30
const ROW_H = 22

type Ev =
  | { kind: 'booking'; id: string; start: Date; end: Date; booking: Booking; own: boolean }
  | { kind: 'block'; id: string; start: Date; end: Date; block: RoomBlock }

export interface Selection {
  start: Date
  end: Date
}

export function WeekCalendar({
  room,
  weekStart,
  bookings,
  blocks,
  settings,
  currentUserId,
  selection,
  onSelect,
  onReject,
  mode = 'student',
  who,
  onEventClick,
  activeId,
}: {
  room: Room
  weekStart: Date
  bookings: Booking[]
  blocks: RoomBlock[]
  settings: Settings
  currentUserId: string
  selection: Selection | null
  onSelect: (s: Selection) => void
  onReject: (msg: string) => void
  /** manager mode: view-only grid with student details and clickable bookings (no drag) */
  mode?: 'student' | 'manager'
  who?: (userId: string) => { name: string; code?: string } | undefined
  onEventClick?: (b: Booking, el: HTMLElement) => void
  activeId?: string | null
}) {
  const manager = mode === 'manager'
  const now = new Date()
  const open = parseHM(settings.openTime)
  const close = parseHM(settings.closeTime)
  const startMin = open.h * 60 + open.m
  const endMin = close.h * 60 + close.m
  const slots = Math.max(1, Math.ceil((endMin - startMin) / SLOT))
  const maxSlots = Math.max(1, Math.floor(settings.maxDurationMinutes / SLOT))
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const roomOpen = room.status === 'AVAILABLE'

  const dayState = (d: Date): 'past' | 'today' | 'locked' | 'bookable' | 'beyond' => {
    const lead = daysBetween(now, d)
    if (lead < 0) return 'past'
    if (lead === 0) return 'today'
    if (lead < settings.minAdvanceDays) return 'locked'
    if (lead > settings.maxAdvanceDays) return 'beyond'
    return 'bookable'
  }
  const canBook = (d: Date) => !manager && roomOpen && dayState(d) === 'bookable'

  const slotDate = (d: Date, s: number) => at(d, 0, startMin + s * SLOT)

  const eventsByDay = useMemo(
    () =>
      days.map((d) => {
        const evs: Ev[] = []
        const dayOpen = at(d, open.h, open.m)
        const dayClose = at(d, close.h, close.m)
        for (const b of bookings) {
          if (b.roomId === room.id && sameDay(new Date(b.start), d) && (ACTIVE_STATUSES.includes(b.status) || b.status === 'COMPLETED')) {
            const bStart = new Date(b.start)
            const bEnd = new Date(b.end)
            if (overlaps(bStart, bEnd, dayOpen, dayClose)) {
              evs.push({ kind: 'booking', id: b.id, start: bStart, end: bEnd, booking: b, own: b.userId === currentUserId })
            }
          }
        }
        for (const k of blocks) {
          if (k.active && k.roomId === room.id && sameDay(new Date(k.start), d)) {
            const kStart = new Date(k.start)
            const kEnd = new Date(k.end)
            if (overlaps(kStart, kEnd, dayOpen, dayClose)) {
              evs.push({ kind: 'block', id: k.id, start: kStart, end: kEnd, block: k })
            }
          }
        }
        return evs
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings, blocks, room.id, weekStart.getTime(), currentUserId, open.h, open.m, close.h, close.m],
  )

  const occupied = (di: number, s: number) => {
    if (s < 0 || s >= slots) return true
    const d = days[di]
    const a = slotDate(d, s)
    const b = slotDate(d, s + 1)
    return eventsByDay[di].some((e) => (e.kind === 'block' || ACTIVE_STATUSES.includes(e.booking.status)) && overlaps(e.start, e.end, a, b))
  }

  const [drag, setDrag] = useState<{ day: number; anchor: number; cur: number } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag

  const slotFromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return Math.min(slots - 1, Math.max(0, Math.floor((e.clientY - rect.top) / ROW_H)))
  }

  const clampWalk = (di: number, anchor: number, target: number) => {
    const clampedTarget = Math.min(slots - 1, Math.max(0, target))
    const dir = clampedTarget >= anchor ? 1 : -1
    let s = anchor
    while (s !== clampedTarget) {
      const n = s + dir
      if (n < 0 || n >= slots || occupied(di, n) || Math.abs(n - anchor) + 1 > maxSlots) break
      s = n
    }
    return s
  }

  const onDown = (di: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || manager) return // manager calendar is view-only
    const d = days[di]
    if (!canBook(d)) {
      const st = dayState(d)
      onReject(
        !roomOpen
          ? `Room ${room.code} is ${room.status.toLowerCase()} and cannot be booked.`
          : st === 'past' || st === 'today'
            ? 'Past dates cannot be booked.'
            : `Outside the advance window — book ${settings.minAdvanceDays}–${settings.maxAdvanceDays} days ahead.`,
      )
      return
    }
    const s = slotFromEvent(e)
    if (occupied(di, s)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ day: di, anchor: s, cur: s })
  }

  const onMove = (di: number) => (e: PointerEvent<HTMLDivElement>) => {
    const dr = dragRef.current
    if (!dr || dr.day !== di) return
    const cur = clampWalk(di, dr.anchor, slotFromEvent(e))
    if (cur !== dr.cur) setDrag({ ...dr, cur })
  }

  const onUp = (di: number) => () => {
    const dr = dragRef.current
    if (!dr || dr.day !== di) return
    const a = Math.max(0, Math.min(dr.anchor, dr.cur))
    const b = Math.min(slots, Math.max(dr.anchor, dr.cur) + 1)
    setDrag(null)
    onSelect({ start: slotDate(days[di], a), end: slotDate(days[di], b) })
  }

  // Selection to render: live drag takes precedence over committed selection
  const sel: { day: number; a: number; b: number } | null = drag
    ? { day: drag.day, a: Math.max(0, Math.min(drag.anchor, drag.cur)), b: Math.min(slots, Math.max(drag.anchor, drag.cur) + 1) }
    : selection
      ? (() => {
          const di = days.findIndex((d) => sameDay(d, selection.start))
          if (di < 0) return null
          const toSlot = (x: Date) => Math.max(0, Math.min(slots, (x.getHours() * 60 + x.getMinutes() - startMin) / SLOT))
          return { day: di, a: toSlot(selection.start), b: toSlot(selection.end) }
        })()
      : null

  const minutesTop = (d: Date) => ((d.getHours() * 60 + d.getMinutes() - startMin) / SLOT) * ROW_H
  const hours = Array.from({ length: Math.floor(slots / 2) + 1 }, (_, i) => startMin + i * 60).filter((m) => m <= endMin)
  const gridH = slots * ROW_H
  const curMinutes = now.getHours() * 60 + now.getMinutes()
  const isNowWithinOfficeHours = curMinutes >= startMin && curMinutes <= endMin
  const nowTop = ((curMinutes - startMin) / SLOT) * ROW_H

  return (
    <div className="select-none" data-cursor-zone>
      {/* Day header */}
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-ink">
        <div className="flex items-end px-2 pb-2 font-mono text-[10px] text-steel">{settings.timezone.split(' ')[1]?.replace(/[()]/g, '') ?? 'UTC'}</div>
        {days.map((d) => {
          const st = dayState(d)
          const pendingN = manager ? eventsByDay[days.indexOf(d)].filter((e) => e.kind === 'booking' && e.booking.status === 'PENDING').length : 0
          return (
            <div key={d.toISOString()} className={cx('flex flex-col gap-1 border-l border-rule px-2.5 pt-3 pb-2', st === 'today' && 'bg-ice')}>
              <div className="flex items-center justify-between gap-1">
                <span className={cx('font-mono text-[11px] font-semibold', st === 'bookable' ? 'text-accent' : 'text-steel')}>
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]}
                </span>
                {st === 'today' && <span className="rounded-sm bg-ink px-1 font-mono text-[9px] leading-[1.6] text-paper">TODAY</span>}
                {!manager && st === 'bookable' && roomOpen && <span className="h-1.5 w-1.5 bg-accent" title="Bookable" />}
                {manager && pendingN > 0 && <span className="rounded-sm border border-dashed border-ink px-1 font-mono text-[9px] leading-[1.5] text-ink">{pendingN} PEND</span>}
              </div>
              <div className={cx('font-display text-[24px] leading-none font-w450', st === 'past' ? 'text-steel/60' : 'text-ink')}>{String(d.getDate()).padStart(2, '0')}</div>
              <div className="font-mono text-[10px] text-steel">
                {manager
                  ? st === 'past'
                    ? 'ARCHIVED'
                    : st === 'today'
                      ? 'LIVE'
                      : `T+${daysBetween(now, d)}`
                  : st === 'past'
                    ? 'CLOSED'
                    : st === 'today'
                      ? 'IN USE'
                      : st === 'locked'
                        ? `T-${daysBetween(now, d)} · LOCKED`
                        : st === 'beyond'
                          ? 'NOT YET OPEN'
                          : `T-${daysBetween(now, d)} · OPEN`}
              </div>
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
        <div className="relative" style={{ height: gridH }}>
          {hours.map((m) => (
            <div
              key={m}
              className={cx('absolute right-2 font-mono text-[12px] font-semibold text-ink', m === startMin ? 'translate-y-0.5' : m === endMin ? '-translate-y-[110%]' : '-translate-y-1/2')}
              style={{ top: ((m - startMin) / SLOT) * ROW_H }}
            >
              {String(Math.floor(m / 60)).padStart(2, '0')}:{String(m % 60).padStart(2, '0')}
            </div>
          ))}
        </div>
        {days.map((d, di) => {
          const st = dayState(d)
          const enabled = canBook(d)
          return (
            <div
              key={d.toISOString()}
              className={cx(
                'relative border-l border-rule overflow-hidden',
                manager ? (st === 'past' ? 'hatch' : 'bg-ice') : enabled ? 'cursor-crosshair bg-ice' : 'hatch cursor-not-allowed',
                st === 'today' && 'bg-ice',
              )}
              style={{ height: gridH }}
              onPointerDown={onDown(di)}
              onPointerMove={onMove(di)}
              onPointerUp={onUp(di)}
              onPointerCancel={() => setDrag(null)}
            >
              {/* rules */}
              {Array.from({ length: slots }, (_, s) => (
                <div
                  key={s}
                  className={cx('pointer-events-none absolute inset-x-0 border-t', s % 2 === 0 ? 'border-rule' : 'border-dashed border-rule/60', enabled && 'group')}
                  style={{ top: s * ROW_H, height: ROW_H }}
                />
              ))}

              {/* events */}
              {eventsByDay[di].map((ev) => {
                const evStartMin = ev.start.getHours() * 60 + ev.start.getMinutes()
                const evEndMin = ev.end.getHours() * 60 + ev.end.getMinutes() || 24 * 60
                const clampedStart = Math.max(startMin, Math.min(endMin, evStartMin))
                const clampedEnd = Math.min(endMin, Math.max(clampedStart, evEndMin))
                const top = ((clampedStart - startMin) / SLOT) * ROW_H
                const height = Math.max(ROW_H, ((clampedEnd - clampedStart) / SLOT) * ROW_H)
                return (
                  <EventBlock
                    key={ev.id}
                    ev={ev}
                    top={top}
                    height={height}
                    manager={manager}
                    who={who}
                    onClick={onEventClick}
                    active={activeId === ev.id}
                  />
                )
              })}

              {/* now line */}
              {sameDay(d, now) && isNowWithinOfficeHours && (
                <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: Math.min(gridH, Math.max(0, nowTop)) }}>
                  <span className="-ml-[3px] h-1.5 w-1.5 bg-accent" />
                  <span className="h-px flex-1 bg-accent" />
                </div>
              )}

              {/* selection */}
              {sel && sel.day === di && (
                <div
                  className="pointer-events-none absolute inset-x-1 z-30 flex flex-col justify-between rounded-sm border-[1.5px] border-accent bg-tint/90 px-2 py-1"
                  style={{ top: sel.a * ROW_H + 1, height: (sel.b - sel.a) * ROW_H - 2 }}
                >
                  <div className="font-mono text-[11px] font-semibold text-forest">
                    {fmtTime(slotDate(d, sel.a))}–{fmtTime(slotDate(d, sel.b))}
                  </div>
                  {sel.b - sel.a >= 2 && (
                    <div className="font-mono text-[10px] text-accent">
                      {fmtDuration((sel.b - sel.a) * SLOT)}
                      {drag ? ' · release to book' : ' · selected'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventBlock({
  ev,
  top,
  height,
  manager,
  who,
  onClick,
  active,
}: {
  ev: Ev
  top: number
  height: number
  manager?: boolean
  who?: (userId: string) => { name: string; code?: string } | undefined
  onClick?: (b: Booking, el: HTMLElement) => void
  active?: boolean
}) {
  const compact = height < 40
  if (ev.kind === 'block')
    return (
      <div className="hatch-slate pointer-events-none absolute inset-x-0.5 z-10 overflow-hidden rounded-sm border border-ink px-2 py-1 text-paper" style={{ top: top + 1, height: height - 2 }}>
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.04em]">
          <span className="h-1.5 w-1.5 shrink-0 bg-paper" />
          EVENT BLOCK
        </div>
        {!compact && <div className="mt-0.5 line-clamp-3 text-[12px] leading-tight font-medium">{ev.block.reason}</div>}
        {height > 84 && (
          <div className="mt-1 font-mono text-[10px] text-white/70">
            {fmtTime(ev.start)}–{fmtTime(ev.end)}
          </div>
        )}
      </div>
    )
  const b = ev.booking
  if (manager) {
    const u = who?.(b.userId)
    const tone =
      b.status === 'PENDING'
        ? 'border border-dashed border-ink bg-paper text-ink hover:bg-tint'
        : b.status === 'APPROVED'
          ? 'border border-ink bg-ink text-paper'
          : b.status === 'KEY_CHECKED_OUT'
            ? 'border border-accent bg-accent text-paper'
            : 'border border-rule bg-paper text-steel'
    return (
      <button
        type="button"
        data-booking-id={b.id}
        className={cx(
          'absolute inset-x-1 z-10 flex cursor-pointer flex-col items-start overflow-hidden rounded-sm px-1.5 py-1 text-left transition-shadow',
          tone,
          active && 'z-40 outline-2 outline-offset-1 outline-accent',
        )}
        style={{ top: top + 1, height: height - 2 }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => onClick?.(b, e.currentTarget)}
        title={`${u?.name ?? ''} · ${b.title} · ${b.status}`}
      >
        <span className="flex w-full items-center justify-between gap-1 font-mono text-[11px] leading-[1.3] font-bold">
          <span className="truncate">{u?.code ?? '—'}</span>
          <span className="shrink-0 opacity-70">{b.status === 'PENDING' ? 'PEND' : b.status === 'KEY_CHECKED_OUT' ? 'KEY' : b.status === 'APPROVED' ? 'OK' : 'DONE'}</span>
        </span>
        {!compact && <span className="w-full truncate text-[11px] leading-[1.3] font-semibold">{u?.name}</span>}
        {height > 60 && <span className="line-clamp-2 w-full text-[11px] leading-[1.25] font-normal opacity-85">{b.title}</span>}
        {height > 84 && (
          <span className="mt-auto font-mono text-[10px] opacity-70">
            {fmtTime(ev.start)}–{fmtTime(ev.end)}
          </span>
        )}
      </button>
    )
  }
  const tone = ev.own
    ? b.status === 'PENDING'
      ? 'border border-dashed border-meta bg-paper text-meta'
      : b.status === 'COMPLETED'
        ? 'border border-rule bg-paper text-steel'
        : 'border border-accent bg-accent text-paper'
    : b.status === 'COMPLETED'
      ? 'border border-rule bg-paper/80 text-steel'
      : 'border border-[#b9c0cb] bg-reserved text-graphite'

  if (ev.own) {
    return (
      <button
        type="button"
        data-booking-id={b.id}
        className={cx(
          'pointer-events-auto absolute inset-x-1 z-10 flex cursor-pointer flex-col items-start overflow-hidden rounded-sm px-2 py-1 text-left transition-all hover:brightness-95',
          tone,
          active && 'z-40 ring-2 ring-ink ring-offset-1 shadow-md',
        )}
        style={{ top: top + 1, height: height - 2 }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => onClick?.(b, e.currentTarget)}
        title={`${b.title} · ${b.status} (Click to view details)`}
      >
        <div className="flex w-full items-center justify-between gap-1 font-mono text-[11px] font-bold tracking-[0.02em]">
          <span className="truncate">{b.status === 'KEY_CHECKED_OUT' ? 'YOU · KEY OUT' : `YOU · ${b.status}`}</span>
        </div>
        {!compact && (
          <>
            <div className="font-mono text-[10px] opacity-75">
              {fmtTime(ev.start)}–{fmtTime(ev.end)}
            </div>
            {height > 64 && <div className="mt-0.5 line-clamp-2 text-[11px] leading-tight font-medium">{b.title}</div>}
          </>
        )}
      </button>
    )
  }

  return (
    <div
      className={cx('pointer-events-auto absolute inset-x-1 z-10 overflow-hidden rounded-sm px-2 py-1', tone)}
      style={{ top: top + 1, height: height - 2 }}
      onPointerDown={(e) => e.stopPropagation()}
      title="Reserved"
    >
      <div className="flex items-center justify-between gap-1 font-mono text-[11px] font-bold tracking-[0.02em]">
        <span className="truncate">RESERVED</span>
      </div>
      {!compact && (
        <div className="font-mono text-[10px] opacity-75">
          {fmtTime(ev.start)}–{fmtTime(ev.end)}
        </div>
      )}
    </div>
  )
}

export const firstBookableWeek = (settings: Settings) => startOfDay(addDays(new Date(), settings.minAdvanceDays))
