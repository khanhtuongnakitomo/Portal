import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { ACTIVE_STATUSES } from '@/lib/store'
import type { Booking, Room, RoomBlock, Settings } from '@/lib/types'
import { addDays, at, daysBetween, fmtDuration, fmtTime, overlaps, parseHM, sameDay, startOfDay } from '@/lib/time'
import { cx } from '@/components/ui'

const SLOT = 30
export const ROW_H = 28 // 28px per 30-min slot = 56px per hour for maximum comfort

export type Ev =
  | { kind: 'booking'; id: string; start: Date; end: Date; booking: Booking; own: boolean }
  | { kind: 'block'; id: string; start: Date; end: Date; block: RoomBlock }

export interface Selection {
  start: Date
  end: Date
}

export interface EventLayoutItem {
  ev: Ev
  lane: number
  totalLanes: number
}

/**
 * Computes side-by-side lanes for overlapping calendar events within a single day.
 * Multiple competing PENDING bookings will render neatly side-by-side rather than occluding each other.
 */
export function layoutDayEvents(evs: Ev[]): EventLayoutItem[] {
  if (evs.length === 0) return []

  // 1. Sort by start ascending, then duration descending
  const sorted = [...evs].sort((a, b) => {
    const startDiff = a.start.getTime() - b.start.getTime()
    if (startDiff !== 0) return startDiff
    const durA = a.end.getTime() - a.start.getTime()
    const durB = b.end.getTime() - b.start.getTime()
    return durB - durA
  })

  // 2. Partition into clusters of overlapping events
  const clusters: Ev[][] = []
  let currentCluster: Ev[] = []
  let clusterEnd = 0

  for (const ev of sorted) {
    const s = ev.start.getTime()
    const e = ev.end.getTime()

    if (currentCluster.length === 0) {
      currentCluster.push(ev)
      clusterEnd = e
    } else {
      if (s < clusterEnd) {
        currentCluster.push(ev)
        clusterEnd = Math.max(clusterEnd, e)
      } else {
        clusters.push(currentCluster)
        currentCluster = [ev]
        clusterEnd = e
      }
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  // 3. Within each cluster, greedily assign each event to the first available lane
  const result: EventLayoutItem[] = []

  for (const cluster of clusters) {
    const laneEndTimes: number[] = []
    const clusterItems: { ev: Ev; lane: number }[] = []

    for (const ev of cluster) {
      const s = ev.start.getTime()
      const e = ev.end.getTime()

      let assignedLane = -1
      for (let l = 0; l < laneEndTimes.length; l++) {
        if (laneEndTimes[l] <= s) {
          assignedLane = l
          laneEndTimes[l] = e
          break
        }
      }

      if (assignedLane === -1) {
        assignedLane = laneEndTimes.length
        laneEndTimes.push(e)
      }

      clusterItems.push({ ev, lane: assignedLane })
    }

    const totalLanes = Math.max(1, laneEndTimes.length)
    for (const item of clusterItems) {
      result.push({ ev: item.ev, lane: item.lane, totalLanes })
    }
  }

  return result
}

export function isOfficialEvent(b: Booking): boolean {
  const t = (b.title || '').toUpperCase()
  const n = (b.note || '').toLowerCase()
  return (
    t.startsWith('[LECTURE]') ||
    t.startsWith('[WORKSHOP]') ||
    t.startsWith('[EVENT]') ||
    t.startsWith('[EXAM]') ||
    t.startsWith('[CLUB]') ||
    t.startsWith('[FACULTY]') ||
    t.startsWith('[MAINTENANCE]') ||
    n.includes('scheduled') ||
    n.includes('assigned by manager')
  )
}

export function extractEventBadge(title: string): { tag: string; cleanTitle: string } | null {
  const match = title.match(/^\[(LECTURE|WORKSHOP|EVENT|EXAM|CLUB|FACULTY|MAINTENANCE)\]\s*(.*)$/i)
  if (match) {
    return { tag: match[1].toUpperCase(), cleanTitle: match[2].trim() }
  }
  return null
}

export interface RoomColorStyle {
  code: string
  label: string
  dot: string
  badge: string
  solid: string
  event: string
  pending: string
}

export function getRoomColor(code?: string): RoomColorStyle {
  if (code === '602') {
    return {
      code: '602',
      label: 'Room 602',
      dot: 'bg-emerald-600',
      badge: 'bg-emerald-600 text-white',
      solid: 'border-emerald-700 bg-emerald-600 text-white',
      event: 'border-2 border-emerald-600 bg-emerald-500/12 text-emerald-950',
      pending: 'border-2 border-dashed border-emerald-600 bg-emerald-500/12 text-emerald-950 hover:bg-emerald-500/20',
    }
  }
  if (code === '605') {
    return {
      code: '605',
      label: 'Room 605',
      dot: 'bg-violet-600',
      badge: 'bg-violet-600 text-white',
      solid: 'border-violet-700 bg-violet-600 text-white',
      event: 'border-2 border-violet-600 bg-violet-500/12 text-violet-950',
      pending: 'border-2 border-dashed border-violet-600 bg-violet-500/12 text-violet-950 hover:bg-violet-500/20',
    }
  }
  return {
    code: '601',
    label: 'Room 601',
    dot: 'bg-blue-600',
    badge: 'bg-blue-600 text-white',
    solid: 'border-blue-700 bg-blue-600 text-white',
    event: 'border-2 border-blue-600 bg-blue-500/12 text-blue-950',
    pending: 'border-2 border-dashed border-blue-600 bg-blue-500/12 text-blue-950 hover:bg-blue-500/20',
  }
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
  onBlockClick,
  activeId,
  allRooms = false,
  rooms,
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
  /** manager mode: interactive hour grid with drag-to-assign, occupancy bars & clickable bookings/blocks */
  mode?: 'student' | 'manager'
  who?: (userId: string) => { name: string; code?: string } | undefined
  onEventClick?: (b: Booking, el: HTMLElement) => void
  onBlockClick?: (blk: RoomBlock, el: HTMLElement) => void
  activeId?: string | null
  allRooms?: boolean
  rooms?: Room[]
}) {
  const manager = mode === 'manager'
  const now = new Date()
  const open = parseHM(settings.openTime)
  const close = parseHM(settings.closeTime)
  const startMin = open.h * 60 + open.m
  const endMin = close.h * 60 + close.m
  const slots = Math.max(1, Math.ceil((endMin - startMin) / SLOT))
  const maxSlots = Math.max(1, Math.floor(settings.maxDurationMinutes / SLOT))

  // Workdays-only grid: Strictly 5 days (Monday to Friday)
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))
  const roomOpen = allRooms ? (rooms?.some((r) => r.status === 'AVAILABLE') ?? true) : room.status === 'AVAILABLE'

  const roomById = useMemo(() => {
    const m = new Map<string, Room>()
    if (room) m.set(room.id, room)
    rooms?.forEach((r) => m.set(r.id, r))
    return m
  }, [room, rooms])

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
          if (
            (allRooms || b.roomId === room.id) &&
            sameDay(new Date(b.start), d) &&
            (ACTIVE_STATUSES.includes(b.status) || b.status === 'COMPLETED')
          ) {
            const bStart = new Date(b.start)
            const bEnd = new Date(b.end)
            if (overlaps(bStart, bEnd, dayOpen, dayClose)) {
              evs.push({ kind: 'booking', id: b.id, start: bStart, end: bEnd, booking: b, own: b.userId === currentUserId })
            }
          }
        }
        for (const k of blocks) {
          if (k.active && (allRooms || k.roomId === room.id) && sameDay(new Date(k.start), d)) {
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
    [bookings, blocks, room.id, allRooms, weekStart.getTime(), currentUserId, open.h, open.m, close.h, close.m],
  )

  // Layout events into multi-column side-by-side lanes per day
  const eventsWithLayoutByDay = useMemo(() => {
    return eventsByDay.map((evs) => layoutDayEvents(evs))
  }, [eventsByDay])

  /**
   * Slot occupancy logic:
   * - Blocks, APPROVED, and KEY_CHECKED_OUT bookings are hard-occupied.
   * - In Student mode: Another student's PENDING booking is NOT hard-occupied, allowing
   *   competing requests over the same window.
   * - In allRooms mode:
   *   - Manager: always false so manager can drag open hours to assign.
   *   - Student: only true if all rooms are occupied during the slot.
   */
  const occupied = (di: number, s: number) => {
    if (s < 0 || s >= slots) return true
    const d = days[di]
    const a = slotDate(d, s)
    const b = slotDate(d, s + 1)

    if (allRooms) {
      if (manager) return false
      const activeRooms = rooms && rooms.length > 0 ? rooms : [room]
      return activeRooms.every((rm) => {
        if (rm.status !== 'AVAILABLE') return true
        return eventsByDay[di].some((e) => {
          const eRoomId = e.kind === 'booking' ? e.booking.roomId : e.block.roomId
          if (eRoomId !== rm.id) return false
          if (!overlaps(e.start, e.end, a, b)) return false
          if (e.kind === 'block') return true
          const st = e.booking.status
          return st === 'APPROVED' || st === 'KEY_CHECKED_OUT' || (e.own && st === 'PENDING')
        })
      })
    }

    return eventsByDay[di].some((e) => {
      if (!overlaps(e.start, e.end, a, b)) return false
      if (e.kind === 'block') return true
      const st = e.booking.status
      if (st === 'APPROVED' || st === 'KEY_CHECKED_OUT') return true
      if (manager) return false
      // Student mode:
      if (e.own && st === 'PENDING') return true
      if (!e.own && st === 'PENDING') return false // Competing request allowed!
      return false
    })
  }

  // Calculate day-by-day occupancy stats for headers
  const totalRoomCount = allRooms && rooms && rooms.length > 0 ? rooms.length : 1
  const dayOccupancyStats = useMemo(() => {
    const totalSpanHours = ((slots * SLOT) / 60) * totalRoomCount
    return days.map((_, di) => {
      let occSlots = 0
      if (allRooms && rooms && rooms.length > 0) {
        for (const rm of rooms) {
          for (let s = 0; s < slots; s++) {
            const a = slotDate(days[di], s)
            const b = slotDate(days[di], s + 1)
            const isOcc = eventsByDay[di].some((e) => {
              const eRoomId = e.kind === 'booking' ? e.booking.roomId : e.block.roomId
              if (eRoomId !== rm.id) return false
              if (!overlaps(e.start, e.end, a, b)) return false
              if (e.kind === 'block') return true
              const st = e.booking.status
              return st === 'APPROVED' || st === 'KEY_CHECKED_OUT' || (e.own && st === 'PENDING')
            })
            if (isOcc) occSlots++
          }
        }
      } else {
        for (let s = 0; s < slots; s++) {
          if (occupied(di, s)) occSlots++
        }
      }
      const busyH = Math.round((occSlots * SLOT * 10) / 60) / 10
      const freeH = Math.max(0, Math.round((totalSpanHours - busyH) * 10) / 10)
      const pct = Math.min(100, Math.round((busyH / totalSpanHours) * 100))
      return { busyH, freeH, pct }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsByDay, slots, allRooms, rooms])

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
      if (n < 0 || n >= slots || occupied(di, n)) break
      if (!manager && Math.abs(n - anchor) + 1 > maxSlots) break
      s = n
    }
    return s
  }

  const onDown = (di: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const d = days[di]
    const st = dayState(d)

    // Manager mode allows selecting open slots on today or future days
    if (manager) {
      if (st === 'past') {
        onReject('Past dates cannot be assigned.')
        return
      }
      const s = slotFromEvent(e)
      if (occupied(di, s)) return
      e.currentTarget.setPointerCapture(e.pointerId)
      setDrag({ day: di, anchor: s, cur: s })
      return
    }

    // Student mode
    if (!canBook(d)) {
      onReject(
        !roomOpen
          ? allRooms
            ? 'All rooms are currently unavailable for booking.'
            : `Room ${room.code} is ${room.status.toLowerCase()} and cannot be booked.`
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

  const hours = Array.from({ length: Math.floor(slots / 2) + 1 }, (_, i) => startMin + i * 60).filter((m) => m <= endMin)
  const gridH = slots * ROW_H
  const curMinutes = now.getHours() * 60 + now.getMinutes()
  const isNowWithinOfficeHours = curMinutes >= startMin && curMinutes <= endMin
  const nowTop = ((curMinutes - startMin) / SLOT) * ROW_H

  return (
    <div className="select-none" data-cursor-zone>
      {/* Day header (5 Workdays: Mon - Fri) */}
      <div className="grid grid-cols-[68px_repeat(5,minmax(0,1fr))] border-b border-ink">
        <div className="flex flex-col justify-end px-2.5 pb-2.5 font-mono text-[10px] text-steel">
          <span className="font-semibold text-ink">TIME</span>
          <span>{settings.timezone.split(' ')[1]?.replace(/[()]/g, '') ?? 'UTC'}</span>
        </div>
        {days.map((d, di) => {
          const st = dayState(d)
          const pendingN = manager ? eventsByDay[di].filter((e) => e.kind === 'booking' && e.booking.status === 'PENDING').length : 0
          const occ = dayOccupancyStats[di]
          return (
            <div key={d.toISOString()} className={cx('flex flex-col gap-1 border-l border-rule px-2.5 pt-3 pb-2.5', st === 'today' && 'bg-ice')}>
              <div className="flex items-center justify-between gap-1">
                <span className={cx('font-mono text-[11px] font-semibold', st === 'bookable' || (manager && st !== 'past') ? 'text-accent' : 'text-steel')}>
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()]}
                </span>
                {st === 'today' && <span className="rounded-sm bg-ink px-1 font-mono text-[9px] leading-[1.6] text-paper">TODAY</span>}
                {!manager && st === 'bookable' && roomOpen && <span className="h-1.5 w-1.5 bg-accent" title="Bookable" />}
                {manager && pendingN > 0 && (
                  <span className="rounded-sm border border-dashed border-plum bg-plum/[0.08] px-1 font-mono text-[9px] font-bold leading-[1.5] text-plum">
                    {pendingN} PEND
                  </span>
                )}
              </div>
              <div className={cx('font-display text-[26px] leading-none font-w450', st === 'past' ? 'text-steel/60' : 'text-ink')}>
                {String(d.getDate()).padStart(2, '0')}
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-steel">
                <span>
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
                            ? 'NOT OPEN'
                            : `T-${daysBetween(now, d)} · OPEN`}
                </span>
              </div>

              {/* Occupancy Indicator Bar & Counter */}
              <div className="mt-1 flex flex-col gap-1 border-t border-rule/70 pt-1.5">
                <div className="flex items-center justify-between font-mono text-[9px] text-steel">
                  <span className={cx(occ.busyH > 0 && 'font-semibold text-ink')}>{occ.busyH}h BUSY</span>
                  <span>{occ.freeH}h FREE</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-[1px] bg-rule">
                  <div
                    className={cx(
                      'h-full transition-all duration-300',
                      occ.pct > 75 ? 'bg-plum' : occ.pct > 0 ? 'bg-accent' : 'bg-transparent',
                    )}
                    style={{ width: `${occ.pct}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Grid (5 Workdays: Mon - Fri) */}
      <div className="grid grid-cols-[68px_repeat(5,minmax(0,1fr))]">
        {/* Time axis */}
        <div className="relative border-r border-rule bg-paper/50" style={{ height: gridH }}>
          {hours.map((m) => (
            <div
              key={m}
              className={cx(
                'absolute right-2 font-mono text-[12px] font-semibold text-ink',
                m === startMin ? 'translate-y-0.5' : m === endMin ? '-translate-y-[100%]' : '-translate-y-1/2',
              )}
              style={{ top: ((m - startMin) / SLOT) * ROW_H }}
            >
              {String(Math.floor(m / 60)).padStart(2, '0')}:{String(m % 60).padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d, di) => {
          const st = dayState(d)
          const enabled = canBook(d)
          const managerInteractive = manager && st !== 'past'
          return (
            <div
              key={d.toISOString()}
              className={cx(
                'relative border-l border-rule overflow-hidden',
                manager
                  ? (st === 'past' ? 'hatch cursor-not-allowed bg-paper' : 'cursor-crosshair bg-paper hover:bg-tint/[0.04]')
                  : (enabled ? 'cursor-crosshair bg-ice' : 'hatch cursor-not-allowed'),
                st === 'today' && 'bg-ice/40',
              )}
              style={{ height: gridH }}
              onPointerDown={onDown(di)}
              onPointerMove={onMove(di)}
              onPointerUp={onUp(di)}
              onPointerCancel={() => setDrag(null)}
            >
              {/* Rules: solid for hour, dashed for 30-min */}
              {Array.from({ length: slots }, (_, s) => (
                <div
                  key={s}
                  className={cx(
                    'pointer-events-none absolute inset-x-0 border-t',
                    s % 2 === 0 ? 'border-rule' : 'border-dashed border-rule/60',
                    (enabled || managerInteractive) && 'group',
                  )}
                  style={{ top: s * ROW_H, height: ROW_H }}
                />
              ))}

              {/* Events with Multi-lane side-by-side positioning */}
              {eventsWithLayoutByDay[di].map(({ ev, lane, totalLanes }) => {
                const evStartMin = ev.start.getHours() * 60 + ev.start.getMinutes()
                const evEndMin = ev.end.getHours() * 60 + ev.end.getMinutes() || 24 * 60
                const clampedStart = Math.max(startMin, Math.min(endMin, evStartMin))
                const clampedEnd = Math.min(endMin, Math.max(clampedStart, evEndMin))
                const top = ((clampedStart - startMin) / SLOT) * ROW_H
                const height = Math.max(ROW_H, ((clampedEnd - clampedStart) / SLOT) * ROW_H)
                const evRoomId = ev.kind === 'booking' ? ev.booking.roomId : ev.block.roomId
                const evRoom = roomById.get(evRoomId)
                const evRoomCode = evRoom?.code || (evRoomId.includes('602') ? '602' : evRoomId.includes('605') ? '605' : '601')
                return (
                  <EventBlock
                    key={ev.id}
                    ev={ev}
                    top={top}
                    height={height}
                    lane={lane}
                    totalLanes={totalLanes}
                    manager={manager}
                    who={who}
                    onClick={onEventClick}
                    onBlockClick={onBlockClick}
                    onSelectSlot={onSelect}
                    active={activeId === ev.id}
                    roomCode={evRoomCode}
                    allRooms={allRooms}
                  />
                )
              })}

              {/* Now line */}
              {sameDay(d, now) && isNowWithinOfficeHours && (
                <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: Math.min(gridH, Math.max(0, nowTop)) }}>
                  <span className="-ml-[3px] h-2 w-2 rounded-full bg-accent ring-2 ring-paper" />
                  <span className="h-[2px] flex-1 bg-accent" />
                </div>
              )}

              {/* Selection overlay */}
              {sel && sel.day === di && (
                <div
                  className="pointer-events-none absolute inset-x-1 z-30 flex flex-col justify-between rounded-sm border-[2px] border-accent bg-tint/90 px-2.5 py-1.5 shadow-md"
                  style={{ top: sel.a * ROW_H + 1, height: (sel.b - sel.a) * ROW_H - 2 }}
                >
                  <div className="font-mono text-[12px] font-bold text-ink-blue">
                    {fmtTime(slotDate(d, sel.a))}–{fmtTime(slotDate(d, sel.b))}
                  </div>
                  <div className="font-mono text-[10px] font-semibold text-accent">
                    {fmtDuration((sel.b - sel.a) * SLOT)}
                    {manager
                      ? (drag ? ' · Release to assign activity / event' : ' · Selected slot')
                      : (drag ? ' · release to book' : ' · selected')}
                  </div>
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
  lane = 0,
  totalLanes = 1,
  manager,
  who,
  onClick,
  onBlockClick,
  onSelectSlot,
  active,
  roomCode,
}: {
  ev: Ev
  top: number
  height: number
  lane?: number
  totalLanes?: number
  manager?: boolean
  who?: (userId: string) => { name: string; code?: string } | undefined
  onClick?: (b: Booking, el: HTMLElement) => void
  onBlockClick?: (blk: RoomBlock, el: HTMLElement) => void
  onSelectSlot?: (s: Selection) => void
  active?: boolean
  roomCode?: string
  allRooms?: boolean
}) {
  const compact = height < 46
  const rc = getRoomColor(roomCode)

  // Multi-lane width and left offset calculations
  const widthPct = 100 / totalLanes
  const leftPct = lane * widthPct
  const laneStyle = {
    top: top + 1,
    height: height - 2,
    left: `calc(${leftPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  }

  if (ev.kind === 'block') {
    return (
      <div
        className={cx(
          'hatch-slate absolute z-10 overflow-hidden rounded-sm border border-ink px-2 py-1 text-paper transition-all',
          manager ? 'cursor-pointer hover:ring-2 hover:ring-accent pointer-events-auto' : 'pointer-events-none',
          active && 'ring-2 ring-accent ring-offset-1',
        )}
        style={laneStyle}
        onClick={(e) => {
          if (manager && onBlockClick) {
            e.stopPropagation()
            onBlockClick(ev.block, e.currentTarget)
          }
        }}
        title={manager ? `Block: ${roomCode ? `[RM ${roomCode}] ` : ''}${ev.block.reason} (Click to inspect / cancel)` : ev.block.reason}
      >
        <div className="flex items-center justify-between gap-1 font-mono text-[10px] font-bold tracking-[0.04em]">
          <span className="flex items-center gap-1.5 truncate">
            {roomCode && (
              <span className={cx('rounded-[2px] px-1 py-0.2 font-mono text-[9px] font-bold tracking-tight', rc.badge)}>
                RM {roomCode}
              </span>
            )}
            <span className="h-1.5 w-1.5 shrink-0 bg-paper" />
            BLOCK
          </span>
          {manager && <span className="font-mono text-[9px] text-white/80 underline">INSPECT</span>}
        </div>
        {!compact && <div className="mt-0.5 line-clamp-2 text-[12px] leading-tight font-medium text-white">{ev.block.reason}</div>}
        {height > 68 && (
          <div className="mt-1 font-mono text-[10px] text-white/70">
            {fmtTime(ev.start)}–{fmtTime(ev.end)}
          </div>
        )}
      </div>
    )
  }

  const b = ev.booking
  const isEvent = isOfficialEvent(b)
  const badgeInfo = extractEventBadge(b.title)

  if (manager) {
    const u = who?.(b.userId)
    const isPending = b.status === 'PENDING'
    const isKeyOut = b.status === 'KEY_CHECKED_OUT'
    const isApproved = b.status === 'APPROVED'

    // Distinct styling for Manager-scheduled events & color-coded rooms
    const tone = isEvent
      ? rc.event
      : isPending
        ? rc.pending
        : isApproved
          ? rc.solid
          : isKeyOut
            ? 'border-2 border-accent bg-accent text-paper'
            : 'border border-rule bg-paper text-steel'

    return (
      <button
        type="button"
        data-booking-id={b.id}
        className={cx(
          'absolute z-10 flex cursor-pointer flex-col items-start overflow-hidden rounded-sm px-1.5 py-1 text-left transition-all',
          tone,
          active && 'z-40 outline-2 outline-offset-1 outline-accent shadow-md',
        )}
        style={laneStyle}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => onClick?.(b, e.currentTarget)}
        title={`${isEvent ? '[SCHEDULED EVENT] ' : ''}[RM ${roomCode}] ${u?.name ?? ''} · ${b.title} · ${b.status}${totalLanes > 1 ? ` (${totalLanes} competing)` : ''}`}
      >
        {isEvent ? (
          <>
            <span className="flex w-full items-center justify-between gap-1 font-mono text-[10px] font-bold">
              <span className="flex items-center gap-1 truncate">
                <span className={cx('rounded-[2px] px-1 py-0.2 font-mono text-[9px] font-bold tracking-tight', rc.badge)}>
                  RM {roomCode}
                </span>
                <span className="inline-flex items-center gap-1 rounded-[2px] bg-ink px-1 py-0.2 text-[9px] text-paper">
                  {badgeInfo?.tag ? `${badgeInfo.tag}` : 'EVENT'}
                </span>
              </span>
              <span className="shrink-0 text-[10px] font-semibold text-accent">
                {isKeyOut ? 'KEY OUT' : isApproved ? 'APPROVED' : b.status}
              </span>
            </span>
            <span className="mt-0.5 w-full truncate text-[12px] font-bold">
              {badgeInfo?.cleanTitle || b.title}
            </span>
            {!compact && height > 60 && (
              <span className="line-clamp-1 w-full text-[11px] opacity-80">
                {b.purpose || u?.name}
              </span>
            )}
            {height > 76 && (
              <span className="mt-auto font-mono text-[10px] opacity-70">
                {fmtTime(ev.start)}–{fmtTime(ev.end)}
              </span>
            )}
          </>
        ) : (
          <>
            <div className="flex w-full items-center justify-between gap-1 font-mono text-[10px] leading-[1.3] font-bold">
              <div className="flex items-center gap-1 truncate">
                <span
                  className={cx(
                    'rounded-[2px] px-1 py-0.2 font-mono text-[9px] font-bold tracking-tight',
                    isApproved ? 'border border-white/50 bg-white/20 text-white' : rc.badge,
                  )}
                >
                  RM {roomCode}
                </span>
                <span className="truncate">{u?.code ?? '—'}</span>
              </div>
              {totalLanes > 1 && isPending ? (
                <span className="rounded-[2px] bg-plum/20 px-1 py-0.2 font-mono text-[9px] font-bold text-plum whitespace-nowrap">
                  ⚡ {lane + 1}/{totalLanes}
                </span>
              ) : (
                <span className="shrink-0 font-bold opacity-85">
                  {isPending ? 'PEND' : isKeyOut ? 'KEY' : isApproved ? 'OK' : 'DONE'}
                </span>
              )}
            </div>
            {!compact && <span className="w-full truncate text-[11px] leading-[1.25] font-semibold">{u?.name}</span>}
            {height > 60 && <span className="line-clamp-2 w-full text-[10px] leading-[1.2] font-normal opacity-90">{b.title}</span>}
            {height > 84 && (
              <span className="mt-auto font-mono text-[9px] opacity-75">
                {fmtTime(ev.start)}–{fmtTime(ev.end)}
              </span>
            )}
          </>
        )}
      </button>
    )
  }

  // Student view: Official events
  if (isEvent) {
    return (
      <div
        className={cx('pointer-events-auto absolute z-10 flex flex-col overflow-hidden rounded-sm px-2 py-1', rc.event)}
        style={laneStyle}
        onPointerDown={(e) => e.stopPropagation()}
        title={`Official University Schedule: [RM ${roomCode}] ${b.title}`}
      >
        <div className="flex items-center justify-between gap-1 font-mono text-[10px] font-bold">
          <div className="flex items-center gap-1 truncate">
            <span className={cx('rounded-[2px] px-1 py-0.2 font-mono text-[9px] font-bold', rc.badge)}>
              RM {roomCode}
            </span>
            <span className="rounded-[2px] bg-ink px-1 text-[9px] text-paper">
              {badgeInfo?.tag ?? 'EVENT'}
            </span>
          </div>
          <span className="shrink-0 opacity-75">{fmtTime(ev.start)}–{fmtTime(ev.end)}</span>
        </div>
        {!compact && (
          <div className="mt-0.5 truncate text-[11px] font-semibold">
            {badgeInfo?.cleanTitle || b.title}
          </div>
        )}
      </div>
    )
  }

  // Student view: Student's OWN booking
  if (ev.own) {
    const tone =
      b.status === 'PENDING'
        ? rc.pending
        : b.status === 'COMPLETED'
          ? 'border border-rule bg-paper text-steel'
          : rc.solid

    return (
      <button
        type="button"
        data-booking-id={b.id}
        className={cx(
          'pointer-events-auto absolute z-20 flex cursor-pointer flex-col items-start overflow-hidden rounded-sm px-2 py-1 text-left transition-all hover:brightness-95',
          tone,
          active && 'z-40 ring-2 ring-ink ring-offset-1 shadow-md',
        )}
        style={laneStyle}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => onClick?.(b, e.currentTarget)}
        title={`[RM ${roomCode}] ${b.title} · ${b.status} (Click to view details)`}
      >
        <div className="flex w-full items-center justify-between gap-1 font-mono text-[11px] font-bold tracking-[0.02em]">
          <div className="flex items-center gap-1 truncate">
            <span
              className={cx(
                'rounded-[2px] px-1 py-0.2 font-mono text-[9px] font-bold',
                b.status === 'APPROVED' ? 'border border-white/50 bg-white/20 text-white' : rc.badge,
              )}
            >
              RM {roomCode}
            </span>
            <span className="truncate">{b.status === 'KEY_CHECKED_OUT' ? 'YOU · KEY OUT' : `YOU · ${b.status}`}</span>
          </div>
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

  // Student view: ANOTHER student's PENDING booking
  // Shows clearly on the student grid so they can see pending interest and click to request a competing reservation!
  if (b.status === 'PENDING') {
    return (
      <div
        role="button"
        tabIndex={0}
        data-booking-id={b.id}
        className={cx(
          'pointer-events-auto absolute z-15 flex flex-col justify-between overflow-hidden rounded-[3px] px-2 py-1 text-ink transition-all cursor-pointer shadow-2xs',
          rc.pending,
        )}
        style={laneStyle}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onSelectSlot?.({ start: ev.start, end: ev.end })
        }}
        title={`Pending request: [RM ${roomCode}] ${fmtTime(ev.start)}–${fmtTime(ev.end)} (Click to submit competing request for this slot)`}
      >
        <div className="flex w-full items-center justify-between gap-1 font-mono text-[10px] font-bold">
          <div className="flex items-center gap-1 truncate">
            <span className={cx('rounded-[2px] px-1 py-0.2 font-mono text-[9px] font-bold', rc.badge)}>
              RM {roomCode}
            </span>
            <span className="truncate">
              PENDING · {totalLanes > 1 ? `${totalLanes} REQ` : 'OPEN'}
            </span>
          </div>
          <span className="shrink-0 text-[9px] opacity-80">
            {fmtTime(ev.start)}–{fmtTime(ev.end)}
          </span>
        </div>
        {!compact && (
          <div className="mt-0.5 line-clamp-1 font-mono text-[10px] font-semibold opacity-85">
            Awaiting approval — click to request
          </div>
        )}
      </div>
    )
  }

  // Student view: Another student's locked APPROVED or KEY_CHECKED_OUT booking
  const tone =
    b.status === 'COMPLETED'
      ? 'border border-rule bg-paper/80 text-steel'
      : cx(rc.solid, 'cursor-not-allowed')

  return (
    <div
      className={cx('pointer-events-auto absolute z-10 overflow-hidden rounded-sm px-2 py-1', tone)}
      style={laneStyle}
      onPointerDown={(e) => e.stopPropagation()}
      title={`[RM ${roomCode}] Reserved`}
    >
      <div className="flex items-center justify-between gap-1 font-mono text-[11px] font-bold tracking-[0.02em]">
        <div className="flex items-center gap-1 truncate">
          <span
            className={cx(
              'rounded-[2px] px-1 py-0.2 font-mono text-[9px] font-bold',
              b.status === 'COMPLETED' ? rc.badge : 'border border-white/50 bg-white/20 text-white',
            )}
          >
            RM {roomCode}
          </span>
          <span className="truncate">RESERVED</span>
        </div>
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
