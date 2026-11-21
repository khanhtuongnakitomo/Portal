import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { ACTIVE_STATUSES, useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { ConfirmBlockDayModal } from '@/manager/ConfirmBlockDayModal'
import type { Booking, Room, RoomBlock, Settings } from '@/lib/types'
import { addDays, at, campusParts, dayKey, daysBetween, durationMin, fmtDate, fmtDow, fmtDuration, fmtRange, fmtTime, isWeekend, minutesOfDay, overlaps, parseHM, sameDay, startOfDay } from '@/lib/time'
import { cx } from '@/components/ui'
import { roomColor } from '@/components/RoomTabs'
import { conflictBands, conflictMap, CONFLICT_COLORS, type ConflictInfo } from '@/lib/conflicts'

const SLOT = 30
export const ROW_H = 28 // 28px per 30-min slot = 56px per hour for maximum comfort

export type Ev =
  | { kind: 'booking'; id: string; start: Date; end: Date; booking: Booking }
  | { kind: 'block'; id: string; start: Date; end: Date; block: RoomBlock }

export interface Selection {
  start: Date
  end: Date
  roomId?: string
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

export function WeekCalendar({
  room,
  weekStart,
  bookings,
  blocks,
  settings,
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
  loadVisibleRange = true,
}: {
  room: Room
  weekStart: Date
  bookings: Booking[]
  blocks: RoomBlock[]
  settings: Settings
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
  loadVisibleRange?: boolean
}) {
  const { setVisibleRange, createBlock, cancelBlock, notify } = useStore()
  const { t, locale } = useI18n()
  const [blockDay, setBlockDay] = useState<{ roomId: string; start: Date; end: Date } | null>(null)
  const [unblocking, setUnblocking] = useState(false)
  const editingReservation = mode === 'student' && selection !== null
  useEffect(() => {
    if (!loadVisibleRange || editingReservation) return
    const start = startOfDay(weekStart)
    setVisibleRange(start, addDays(start, 7))
  }, [weekStart, setVisibleRange, editingReservation, loadVisibleRange])
  const manager = mode === 'manager'
  const now = new Date()
  const open = parseHM(settings.openTime)
  const close = parseHM(settings.closeTime)
  const startMin = open.h * 60 + open.m
  const endMin = close.h * 60 + close.m
  const spanSlots = (endMin - startMin) / SLOT
  const slots = Math.ceil(spanSlots)
  const maxMinutes = manager ? endMin - startMin : settings.maxDurationMinutes

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const conflicts = useMemo(() => conflictMap(bookings), [bookings])
  const bands = useMemo(() => conflictBands(bookings), [bookings])
  const roomOpen = allRooms && rooms?.length ? rooms.some((r) => r.status === 'AVAILABLE') : room.status === 'AVAILABLE'

  const roomById = useMemo(() => {
    const m = new Map<string, Room>()
    m.set(room.id, room)
    rooms?.forEach((r) => m.set(r.id, r))
    return m
  }, [room, rooms])

  const dayState = (d: Date): 'past' | 'today' | 'bookable' | 'beyond' => {
    const lead = daysBetween(now, d)
    if (lead < 0) return 'past'
    if (lead === 0) return 'today'
    if (lead > settings.maxAdvanceDays) return 'beyond'
    return 'bookable'
  }
  const bookThrough = addDays(now, settings.maxAdvanceDays)
  const slotDate = (d: Date, s: number) => at(d, 0, Math.min(endMin, startMin + s * SLOT))
  const canSelect = (start: Date, end: Date) =>
    !isWeekend(start) && (manager ? end > now : roomOpen && start > now && start <= bookThrough)

  const eventsByDay = useMemo(
    () =>
      days.map((d) => {
        const evs: Ev[] = []
        const dayOpen = at(d, open.h, open.m)
        const dayClose = at(d, close.h, close.m)
        for (const b of bookings) {
          if (
            (allRooms || b.roomId === room.id) &&
            (ACTIVE_STATUSES.includes(b.status) || b.status === 'COMPLETED')
          ) {
            const bStart = new Date(b.start)
            const bEnd = new Date(b.end)
            if (overlaps(bStart, bEnd, dayOpen, dayClose)) {
              evs.push({ kind: 'booking', id: b.id, start: bStart < dayOpen ? dayOpen : bStart, end: bEnd > dayClose ? dayClose : bEnd, booking: b })
            }
          }
        }
        for (const k of blocks) {
          if (k.active && (allRooms || k.roomId === room.id)) {
            const kStart = new Date(k.start)
            const kEnd = new Date(k.end)
            if (overlaps(kStart, kEnd, dayOpen, dayClose)) {
              evs.push({ kind: 'block', id: k.id, start: kStart < dayOpen ? dayOpen : kStart, end: kEnd > dayClose ? dayClose : kEnd, block: k })
            }
          }
        }
        return evs
      }),
    [bookings, blocks, room.id, allRooms, days, open.h, open.m, close.h, close.m],
  )

  // Layout events into multi-column side-by-side lanes per day
  const eventsWithLayoutByDay = useMemo(() => {
    return eventsByDay.map((evs) => layoutDayEvents(evs))
  }, [eventsByDay])

  const roomOccupied = (di: number, roomId: string, start: Date, end: Date) =>
    eventsByDay[di].some((ev) => {
      if ((ev.kind === 'block' ? ev.block.roomId : ev.booking.roomId) !== roomId) return false
      if (!overlaps(ev.start, ev.end, start, end)) return false
      if (ev.kind === 'block') return true
      const b = ev.booking
      return b.status === 'APPROVED' || b.status === 'KEY_CHECKED_OUT' || (!manager && b.isMine && b.status === 'PENDING')
    })

  const freeRoom = (di: number, start: Date, end: Date) =>
    (allRooms && rooms?.length ? rooms : [room]).find(
      (r) => (manager || r.status === 'AVAILABLE') && !roomOccupied(di, r.id, start, end),
    )

  const fullDayBlocks = days.map((d) => blocks.find((block) => block.active && block.roomId === room.id &&
    new Date(block.start) <= slotDate(d, 0) && new Date(block.end) >= slotDate(d, slots)))

  const unblockDay = async (block: RoomBlock) => {
    if (unblocking) return
    setUnblocking(true)
    try {
      const error = await cancelBlock(block.roomId, { start: new Date(block.start), end: new Date(block.end) })
      if (error) notify(error, 'error')
      else notify(t('student.dayUnblocked'))
    } finally {
      setUnblocking(false)
    }
  }

  const openSlot = (di: number, a: number, b: number): Selection | null => {
    const start = slotDate(days[di], a)
    const end = slotDate(days[di], b)
    if (end <= start || durationMin(start, end) > maxMinutes || !canSelect(start, end)) return null
    if (manager && allRooms) return { start, end }
    const available = freeRoom(di, start, end)
    return available ? { start, end, roomId: available.id } : null
  }

  // Calculate day-by-day occupancy stats for headers
  const totalRoomCount = allRooms && rooms && rooms.length > 0 ? rooms.length : 1
  const dayOccupancyStats = useMemo(() => {
    const totalSpanHours = ((endMin - startMin) / 60) * totalRoomCount
    return days.map((_, di) => {
      let busyMinutes = 0
      for (const r of allRooms && rooms?.length ? rooms : [room]) {
        for (let s = 0; s < slots; s++) {
          const a = slotDate(days[di], s)
          const b = slotDate(days[di], s + 1)
          if (roomOccupied(di, r.id, a, b)) busyMinutes += durationMin(a, b)
        }
      }
      const busyH = Math.round(busyMinutes / 6) / 10
      const freeH = Math.max(0, Math.round((totalSpanHours - busyH) * 10) / 10)
      const pct = Math.min(100, Math.round((busyH / totalSpanHours) * 100))
      return { busyH, freeH, pct }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsByDay, slots, startMin, endMin, allRooms, room, rooms, manager, totalRoomCount])

  const [drag, setDrag] = useState<{ day: number; anchor: number; cur: number } | null>(null)
  const dragRef = useRef(drag)

  const slotFromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return Math.min(slots - 1, Math.max(0, Math.floor((e.clientY - rect.top) / ROW_H)))
  }

  const onDown = (di: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isWeekend(days[di])) return
    const s = slotFromEvent(e)
    if (!openSlot(di, s, s + 1)) {
      const start = slotDate(days[di], s)
      const end = slotDate(days[di], s + 1)
      if (!canSelect(start, end)) {
        onReject(
          !manager && !roomOpen
            ? allRooms ? t('student.allUnavailable') : t('student.roomUnavailable', { code: room.code })
            : start > bookThrough && !manager
              ? t('student.windowValue', { count: settings.maxAdvanceDays })
              : t('student.pastSlots'),
        )
      }
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    const next = { day: di, anchor: s, cur: s }
    dragRef.current = next
    setDrag(next)
  }

  const onMove = (di: number) => (e: PointerEvent<HTMLDivElement>) => {
    const dr = dragRef.current
    if (!dr || dr.day !== di) return
    const target = slotFromEvent(e)
    const direction = Math.sign(target - dr.anchor)
    let cur = dr.anchor
    while (cur !== target) {
      const next = cur + direction
      if (!openSlot(di, Math.min(dr.anchor, next), Math.max(dr.anchor, next) + 1)) break
      cur = next
    }
    if (cur !== dr.cur) {
      const next = { ...dr, cur }
      dragRef.current = next
      setDrag(next)
    }
  }

  const clearDrag = () => {
    dragRef.current = null
    setDrag(null)
  }

  const onUp = (di: number) => () => {
    const dr = dragRef.current
    if (!dr || dr.day !== di) return
    clearDrag()
    const sel = openSlot(di, Math.min(dr.anchor, dr.cur), Math.max(dr.anchor, dr.cur) + 1)
    if (sel) onSelect(sel)
  }

  // Selection to render: live drag takes precedence over committed selection
  const sel: { day: number; a: number; b: number } | null = drag
    ? { day: drag.day, a: Math.min(drag.anchor, drag.cur), b: Math.min(spanSlots, Math.max(drag.anchor, drag.cur) + 1) }
    : selection
      ? (() => {
          const di = days.findIndex((d) => sameDay(d, selection.start))
          if (di < 0) return null
          const toSlot = (x: Date) => Math.max(0, Math.min(spanSlots, (minutesOfDay(x) - startMin) / SLOT))
          return { day: di, a: toSlot(selection.start), b: toSlot(selection.end) }
        })()
      : null

  const hours = Array.from({ length: Math.floor(spanSlots / 2) + 1 }, (_, i) => startMin + i * 60)
  const gridH = spanSlots * ROW_H
  const curMinutes = minutesOfDay(now)
  const isNowWithinOfficeHours = curMinutes >= startMin && curMinutes <= endMin
  const nowTop = ((curMinutes - startMin) / SLOT) * ROW_H

  return (
    <div className="min-w-[980px] select-none" data-cursor-zone>
      {/* Full campus week, including closed weekend columns. */}
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-ink">
        <div className="flex flex-col justify-end px-2.5 pb-2.5 font-mono text-[10px] text-steel">
          <span className="font-semibold text-ink">{t('common.time')}</span>
          <span>ICT (UTC+7)</span>
        </div>
        {days.map((d, di) => {
          const st = dayState(d)
          const weekend = isWeekend(d)
          const occ = dayOccupancyStats[di]
          const block = fullDayBlocks[di]
          const pendingN = manager ? eventsByDay[di].filter((e) => e.kind === 'booking' && e.booking.status === 'PENDING').length : 0
          return (
            <div key={dayKey(d)} className={cx('flex min-w-0 flex-col gap-1 border-l border-rule px-2 py-2', (st === 'today' || weekend) && 'bg-ice')}>
              <div className="flex items-center justify-between gap-1">
                <span className={cx('font-mono text-[11px] font-semibold', st === 'bookable' || (manager && st !== 'past') ? 'text-accent' : 'text-steel')}>
                  {fmtDow(d, locale)}
                </span>
                {st === 'today' && <span className="rounded-sm bg-ink px-1 font-mono text-[9px] leading-[1.6] text-paper">{t('student.today')}</span>}
                {!weekend && !manager && !(!allRooms && block) && st === 'bookable' && roomOpen && <span className="h-1.5 w-1.5 bg-accent" title={t('student.bookable')} />}
                {manager && pendingN > 0 && (
                  <span className="rounded-sm border border-dashed border-plum bg-plum/[0.08] px-1 font-mono text-[9px] font-bold leading-[1.4] text-plum">
                    {t('student.pendingCount', { count: pendingN })}
                  </span>
                )}
              </div>
              <div className={cx('font-display text-[26px] leading-none font-w450', st === 'past' ? 'text-steel/60' : 'text-ink')}>
                {String(campusParts(d).day).padStart(2, '0')}
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-steel">
                <span>
                  {weekend ? t('student.weekendClosed') : !allRooms && block ? t('student.blocked') : manager
                    ? st === 'past' ? t('student.archived') : st === 'today' ? t('student.live') : t('student.daysAhead', { count: daysBetween(now, d) })
                    : st === 'past' ? t('student.closed') : st === 'today' ? t('student.inUse') : st === 'beyond' ? t('student.notOpen') : t('student.openIn', { count: daysBetween(now, d) })}
                </span>
              </div>

              {/* Occupancy Indicator Bar & Counter */}
              <div className="mt-1 flex flex-col gap-1 border-t border-rule/70 pt-1.5">
                <div className="flex items-center justify-between font-mono text-[9px] text-steel">
                  <span className={cx(occ.busyH > 0 && 'font-semibold text-ink')}>{t('student.busyHours', { count: occ.busyH })}</span>
                  <span>{weekend ? t('student.closed') : t('student.freeHours', { count: occ.freeH })}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-[1px] bg-rule">
                  <div className={cx('h-full transition-all duration-300', occ.pct > 75 ? 'bg-plum' : 'bg-accent')} style={{ width: `${occ.pct}%` }} />
                </div>
              </div>
              {manager && !allRooms && !weekend && st !== 'past' && (block || slotDate(d, slots) > now) && (
                <button
                  type="button"
                  disabled={unblocking}
                  className="calendar-focus rounded-sm border border-edge bg-paper px-1 py-0.5 font-mono text-[10px] font-semibold text-steel hover:border-plum hover:text-plum disabled:opacity-50"
                  onClick={() => block ? void unblockDay(block) : setBlockDay({ roomId: room.id, start: slotDate(d, 0), end: slotDate(d, slots) })}
                >
                  {t(block ? 'student.unblockDay' : 'student.blockDay')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Seven-day grid */}
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))]">
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
          const weekend = isWeekend(d)
          const enabled = !weekend && (manager ? st !== 'past' : roomOpen && st !== 'past' && st !== 'beyond')
          return (
            <div
              key={dayKey(d)}
              className={cx(
                'relative border-l border-rule overflow-hidden',
                weekend
                  ? 'bg-ice hatch cursor-default'
                  : !allRooms && fullDayBlocks[di] ? 'hatch-slate cursor-not-allowed'
                    : enabled ? 'cursor-crosshair bg-paper hover:bg-tint/[0.04]' : 'hatch cursor-not-allowed',
                !weekend && st === 'today' && 'bg-ice/40',
              )}
              style={{ height: gridH }}
              onPointerDown={weekend ? undefined : onDown(di)}
              onPointerMove={onMove(di)}
              onPointerUp={onUp(di)}
              onPointerCancel={clearDrag}
            >
              {Array.from({ length: slots }, (_, s) => {
                const slot = openSlot(di, s, s + 1)
                const rule = cx(
                  'absolute inset-x-0 border-t',
                  s % 2 === 0 ? 'border-rule' : 'border-dashed border-rule/60',
                )
                const style = { top: s * ROW_H, height: Math.min(ROW_H, gridH - s * ROW_H) }
                return slot ? (
                  <button
                    key={s}
                    type="button"
                    className={cx(rule, 'calendar-focus cursor-crosshair hover:bg-tint/50')}
                    style={style}
                    aria-label={t(manager ? 'student.assignSlot' : 'student.bookSlot', { room: slot.roomId ? t('student.roomCode', { code: roomById.get(slot.roomId)?.code ?? room.code }) : t('common.room'), date: fmtDate(d, locale), time: fmtRange(slot.start, slot.end) })}
                    onClick={(e) => {
                      // Pointer activation is handled by the column's drag gesture.
                      if (e.detail === 0) onSelect(slot)
                    }}
                  />
                ) : (
                  <div key={s} className={cx(rule, 'pointer-events-none')} style={style} />
                )
              })}

              {bands.filter((band) => (allRooms || band.roomId === room.id) && overlaps(band.start, band.end, at(d, open.h, open.m), at(d, close.h, close.m))).map((band) => {
                const start = new Date(Math.max(+band.start, +at(d, open.h, open.m)))
                const end = new Date(Math.min(+band.end, +at(d, close.h, close.m)))
                // In all-rooms mode confine the band to the lanes of the conflicting cards.
                let left = 0
                let right = 1
                if (allRooms) {
                  const members = eventsWithLayoutByDay[di].filter(
                    ({ ev }) => ev.kind === 'booking' && ev.booking.roomId === band.roomId && conflicts.has(ev.id) && overlaps(ev.start, ev.end, start, end),
                  )
                  if (members.length) {
                    left = Math.min(...members.map((m) => m.lane / m.totalLanes))
                    right = Math.max(...members.map((m) => (m.lane + 1) / m.totalLanes))
                  }
                }
                return (
                  <div
                    key={`${band.roomId}-${+band.start}`}
                    className="pointer-events-none absolute hatch-conflict border-y border-danger/60"
                    style={{
                      left: `${left * 100}%`,
                      width: `${(right - left) * 100}%`,
                      top: durationMin(at(d, open.h, open.m), start) / SLOT * ROW_H,
                      height: durationMin(start, end) / SLOT * ROW_H,
                    }}
                  >
                    <span className="relative z-20 block w-fit max-w-full truncate bg-paper/95 px-0.5 font-mono text-[8px] font-bold text-danger">
                      {t('student.conflictBand', { time: fmtRange(start, end) })}
                    </span>
                  </div>
                )
              })}

              {/* Events with Multi-lane side-by-side positioning */}
              {eventsWithLayoutByDay[di].map(({ ev, lane, totalLanes }) => {
                const top = ((minutesOfDay(ev.start) - startMin) / SLOT) * ROW_H
                const height = (durationMin(ev.start, ev.end) / SLOT) * ROW_H
                const evRoomId = ev.kind === 'booking' ? ev.booking.roomId : ev.block.roomId
                const evRoom = roomById.get(evRoomId)
                const firmClash = ev.kind === 'booking' && ev.booking.status === 'PENDING' && roomOccupied(di, evRoomId, ev.start, ev.end)
                const canCompete = ev.kind === 'booking' && ev.booking.status === 'PENDING' && !firmClash &&
                  evRoom?.status === 'AVAILABLE' && canSelect(new Date(ev.booking.start), new Date(ev.booking.end)) &&
                  durationMin(ev.booking.start, ev.booking.end) <= maxMinutes
                return (
                  <EventBlock
                    key={`${ev.kind}-${ev.id}`}
                    ev={ev}
                    top={top}
                    height={height}
                    lane={lane}
                    totalLanes={totalLanes}
                    manager={manager}
                    who={who}
                    onClick={onEventClick}
                    onBlockClick={onBlockClick}
                    onSelectSlot={canCompete ? onSelect : undefined}
                    active={activeId === ev.id}
                    room={evRoom}
                    firmClash={firmClash}
                    conflict={conflicts.get(ev.id)}
                    conflicts={conflicts}
                  />
                )
              })}

              {/* Now line */}
              {!weekend && sameDay(d, now) && isNowWithinOfficeHours && (
                <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: Math.min(gridH, Math.max(0, nowTop)) }}>
                  <span className="-ml-[3px] h-2 w-2 rounded-sm bg-accent ring-2 ring-paper" />
                  <span className="h-[2px] flex-1 bg-accent" />
                </div>
              )}

              {/* Selection overlay */}
              {sel && sel.day === di && !weekend && (
                <div
                  className="pointer-events-none absolute inset-x-1 z-30 flex flex-col justify-between rounded-sm border-[2px] border-accent bg-tint/90 px-2.5 py-1.5 shadow-md"
                  style={{ top: sel.a * ROW_H + 1, height: (sel.b - sel.a) * ROW_H - 2 }}
                >
                  <div className="font-mono text-[12px] font-bold text-ink-blue">
                    {fmtTime(slotDate(d, sel.a))}–{fmtTime(slotDate(d, sel.b))}
                  </div>
                  <div className="font-mono text-[10px] font-semibold text-accent">
                    {fmtDuration((sel.b - sel.a) * SLOT, locale)} · {t(drag ? manager ? 'student.releaseToAssign' : 'student.releaseToBook' : 'student.selectedSlot')}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {blockDay && blockDay.roomId === room.id && !allRooms && (
        <ConfirmBlockDayModal
          room={room}
          start={blockDay.start}
          end={blockDay.end}
          onClose={() => setBlockDay(null)}
          onConfirm={async (reason, displace) => {
            const error = await createBlock({ ...blockDay, reason, displace })
            if (error === null) notify(t('student.dayBlocked'))
            return error
          }}
        />
      )}
    </div>
  )
}

function EventBlock({
  ev,
  top,
  height,
  lane,
  totalLanes,
  manager,
  who,
  onClick,
  onBlockClick,
  onSelectSlot,
  active,
  room,
  firmClash,
  conflict,
  conflicts,
}: {
  ev: Ev
  top: number
  height: number
  lane: number
  totalLanes: number
  manager: boolean
  who?: (userId: string) => { name: string; code?: string } | undefined
  onClick?: (b: Booking, el: HTMLElement) => void
  onBlockClick?: (blk: RoomBlock, el: HTMLElement) => void
  onSelectSlot?: (s: Selection) => void
  active: boolean
  room?: Room
  firmClash: boolean
  conflict?: ConflictInfo
  conflicts: Map<string, ConflictInfo>
}) {
  const { t, locale } = useI18n()
  const color = roomColor(room ?? 0)
  const widthPct = 100 / totalLanes
  const inset = Math.min(1, height / 4)
  const style = {
    ...color.style,
    top: top + inset,
    height: height - 2 * inset,
    left: `calc(${lane * widthPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
  }
  const roomLabel = room ? t('student.roomCode', { code: room.code }) : t('common.room')
  const range = fmtRange(ev.start, ev.end)
  const location = `${roomLabel}, ${fmtDate(ev.start, locale)} ${range}`
  const base = 'calendar-focus absolute z-10 flex flex-col items-start overflow-hidden rounded-sm px-1.5 py-1 text-left'
  const badge = cx('shrink-0 rounded-sm px-1 font-mono text-[9px] font-bold text-paper', color.dot)

  if (ev.kind === 'block') {
    return (
      <button
        type="button"
        className={cx(base, 'hatch-slate border border-ink text-paper', onBlockClick && 'cursor-pointer hover:ring-2 hover:ring-accent', active && 'ring-2 ring-accent')}
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => onBlockClick?.(ev.block, e.currentTarget)}
        aria-disabled={!onBlockClick}
        aria-label={`${t(onBlockClick ? 'student.inspectBlock' : 'student.blocked')}: ${location}, ${ev.block.reason}`}
      >
        <span className="flex w-full items-center justify-between gap-1 font-mono text-[10px] font-bold">
          <span className={badge}>{roomLabel}</span>
          <span>{t('student.blocked')}</span>
        </span>
        {height >= 42 && <span className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-tight">{ev.block.reason}</span>}
        {height > 68 && <span className="mt-auto font-mono text-[10px]">{range}</span>}
      </button>
    )
  }

  const b = ev.booking
  const official = b.kind === 'OFFICIAL'
  const pending = b.status === 'PENDING'
  const own = b.isMine && !official
  const holder = manager && b.userId ? who?.(b.userId) : undefined
  const status = t(`student.bookingStatus.${b.status}`)
  const privateLabel = t(pending ? 'student.pendingRequest' : 'student.reserved')
  const category = b.category && /^(LECTURE|WORKSHOP|EVENT|EXAM|CLUB|FACULTY|MAINTENANCE)$/.test(b.category) ? b.category : 'EVENT'
  const title = official || own || manager ? (official && b.category ? b.title.replace(/^\[[^\]]+\]\s*/, '') || b.title : b.title) : privateLabel
  const label = official ? t(`student.eventCategory.${category}`) : own && !manager ? t('student.ownStatus', { status }) : manager ? firmClash ? t('student.clash') : status : privateLabel
  const compete = !manager && !official && !own && pending && onSelectSlot
  const inspect = (manager || own) && onClick
  const tone = official
    ? 'border-2 border-(--room-color) bg-(--room-color)/12 text-ink'
    : pending
      ? 'border-2 border-dashed border-(--room-color) bg-(--room-color)/12 text-ink'
      : b.status === 'COMPLETED'
        ? 'border border-rule bg-paper text-steel'
        : 'border border-(--room-color) bg-(--room-color) text-paper'
  const conflictColor = conflict && CONFLICT_COLORS[conflict.letter]
  const conflictLabel = conflict?.rivals.map((rival) => {
    const name = manager && rival.userId ? who?.(rival.userId)?.name : undefined
    return t('student.conflictsWith', { letter: conflicts.get(rival.id)?.letter ?? '—', name: name ?? t('student.anotherBooking'), time: fmtRange(rival.start, rival.end) })
  }).join('; ')

  return (
    <button
      type="button"
      data-booking-id={b.id}
      className={cx(base, tone, conflict && 'outline-2 outline-solid outline-danger -outline-offset-2 !border-solid pl-2', (inspect || compete) && 'cursor-pointer hover:brightness-95', active && 'z-30 ring-2 ring-ink shadow-md')}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (inspect) inspect(b, e.currentTarget)
        else if (compete) compete({ start: new Date(b.start), end: new Date(b.end), roomId: b.roomId })
      }}
      aria-disabled={!inspect && !compete}
      aria-label={`${inspect ? t('student.inspectBooking') : compete ? t('student.competingBooking') : label}: ${location}${title === label ? '' : `, ${title}`}${conflictLabel ? `; ${conflictLabel}` : ''}`}
    >
      {conflictColor && <span aria-hidden="true" className={cx('absolute inset-y-0 left-0 w-1', conflictColor.bar)} />}
      <span className="flex w-full items-center justify-between gap-1 font-mono text-[10px] font-bold">
        {conflict && <span className={cx('shrink-0 rounded-sm px-1 font-mono text-[10px] font-bold', conflictColor?.badge)}>{conflict.letter}</span>}
        <span className={badge}>{room?.code ?? t('common.room')}</span>
        <span className="truncate">{label}</span>
      </span>
      {height >= 42 && (
        <span className="mt-0.5 w-full truncate text-[11px] font-semibold">
          {holder && !official ? `${holder.name}${holder.code ? ` · ${holder.code}` : ''}` : compete ? t('student.requestSlot') : title}
        </span>
      )}
      {height > 60 && (
        <span className="mt-auto w-full truncate font-mono text-[10px]">
          {range}{holder && !official ? ` · ${title}` : ''}
        </span>
      )}
    </button>
  )
}
