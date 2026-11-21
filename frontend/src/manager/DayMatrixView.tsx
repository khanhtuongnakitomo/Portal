import { useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { ACTIVE_STATUSES, useStore } from '@/lib/store'
import type { Booking, RoomBlock } from '@/lib/types'
import { addDays, at, durationMin, fmtDate, fmtRange, fmtTime, isWeekend, overlaps, parseHM, sameDay, startOfDay } from '@/lib/time'
import { conflictBands, conflictMap, CONFLICT_COLORS } from '@/lib/conflicts'
import { Button, cx } from '@/components/ui'
import type { AssignModalInitial } from './AssignActivityModal'

interface DayMatrixViewProps {
  selectedDay: Date
  onChangeDay: (d: Date) => void
  onAssignSlot: (initial: AssignModalInitial) => void
  onBookingClick: (b: Booking, el: HTMLElement) => void
  onBlockClick: (blk: RoomBlock, el: HTMLElement) => void
}

export function DayMatrixView({
  selectedDay,
  onChangeDay,
  onAssignSlot,
  onBookingClick,
  onBlockClick,
}: DayMatrixViewProps) {
  const { rooms, bookings, blocks, settings, setVisibleRange, user } = useStore()
  const now = new Date()
  const dayStart = useMemo(() => startOfDay(selectedDay), [selectedDay])
  const closed = isWeekend(dayStart)

  const { openTime, closeTime } = settings
  const { dayOpen, dayClose, rows } = useMemo(() => {
    const open = parseHM(openTime)
    const close = parseHM(closeTime)
    const firstMinute = open.h * 60 + open.m
    const lastMinute = close.h * 60 + close.m
    const start = at(dayStart, 0, firstMinute)
    const end = at(dayStart, 0, lastMinute)
    const rows = []
    for (let minute = firstMinute; minute < lastMinute;) {
      const nextHour = (Math.floor(minute / 60) + 1) * 60
      const next = Math.min(lastMinute, nextHour)
      rows.push({ start: at(dayStart, 0, minute), end: at(dayStart, 0, next) })
      minute = next
    }
    return { dayOpen: start, dayClose: end, rows }
  }, [dayStart, openTime, closeTime])

  const isToday = sameDay(dayStart, now)
  const isPast = dayStart < startOfDay(now)

  useEffect(() => {
    setVisibleRange(dayStart, addDays(dayStart, 1))
  }, [dayStart, setVisibleRange])

  const conflicts = useMemo(() => conflictMap(bookings), [bookings])

  const schedules = useMemo(() => {
    const dayBookings = bookings
      .filter((b) => (ACTIVE_STATUSES.includes(b.status) || b.status === 'COMPLETED') && overlaps(b.start, b.end, dayOpen, dayClose))
      .map((b) => ({ booking: b, start: new Date(b.start), end: new Date(b.end) }))
    const dayBlocks = blocks
      .filter((b) => b.active && overlaps(b.start, b.end, dayOpen, dayClose))
      .map((b) => {
        const start = new Date(b.start)
        const end = new Date(b.end)
        return { block: b, start: start < dayOpen ? dayOpen : start, end: end > dayClose ? dayClose : end }
      })
    return rooms.map((room) => {
      const roomBookings = dayBookings.filter(({ booking }) => booking.roomId === room.id)
      const roomBlock = dayBlocks.find(({ block }) => block.roomId === room.id)
      const cells = rows.map(({ start, end }) => ({
        bookings: roomBookings.filter((b) => overlaps(b.start, b.end, start, end)),
        block: roomBlock && overlaps(roomBlock.start, roomBlock.end, start, end) ? roomBlock : undefined,
      }))
      const busyMinutes = cells.reduce((minutes, cell, i) =>
        minutes + (cell.bookings.length || cell.block ? durationMin(rows[i].start, rows[i].end) : 0), 0)
      const pct = Math.round((busyMinutes / Math.max(1, durationMin(dayOpen, dayClose))) * 100)
      const pendingCount = roomBookings.filter(({ booking }) => booking.status === 'PENDING').length
      return { room, cells, busyMinutes, pct, pendingCount }
    })
  }, [bookings, blocks, rooms, rows, dayOpen, dayClose])

  return (
    <div className="flex flex-col rounded-lg border border-ink bg-paper">
      {/* Date Navigation & Matrix Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-ice/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            className="!rounded-md !p-1.5"
            aria-label="Previous day"
            onClick={() => onChangeDay(addDays(dayStart, -1))}
          >
            <ChevronLeft size={16} />
          </Button>

          <Button
            variant="outline"
            size="xs"
            className="!rounded-md !p-1.5"
            aria-label="Next day"
            onClick={() => onChangeDay(addDays(dayStart, 1))}
          >
            <ChevronRight size={16} />
          </Button>

          <Button
            variant={isToday ? 'dark' : 'outline'}
            size="xs"
            className="!rounded-md"
            onClick={() => onChangeDay(startOfDay(now))}
          >
            Today
          </Button>

          <div className="ml-2 flex items-center gap-2 font-mono text-[13px] font-bold text-ink">
            <span>{fmtDate(dayStart)}</span>
            {isToday && (
              <span className="rounded-[2px] bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper">
                LIVE TODAY
              </span>
            )}
            {isPast && (
              <span className="rounded-[2px] bg-edge px-1.5 py-0.5 font-mono text-[10px] text-steel">
                ARCHIVED
              </span>
            )}
            {closed && (
              <span className="rounded-[2px] border border-edge bg-paper px-1.5 py-0.5 font-mono text-[10px] text-steel">
                WEEKEND · CLOSED
              </span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-graphite">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[1px] border border-dashed border-rule bg-paper" />
            Free
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[1px] border border-dashed border-plum bg-plum/[0.08]" />
            Pending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[1px] border border-ink bg-ink" />
            Approved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[1px] border border-accent bg-accent" />
            Key Out
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[1px] border-2 border-accent bg-paper" />
            Event
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[1px] hatch-slate border border-ink" />
            Block
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[1px] hatch-conflict border-2 border-danger" />
            Conflict
          </span>
        </div>
      </div>

      {/* Matrix Table Container */}
      <div className="scrollbar-thin overflow-x-auto">
        <div
          className="grid min-w-[760px] divide-x divide-rule"
          style={{
            gridTemplateColumns: rooms.length
              ? `88px repeat(${rooms.length}, minmax(220px, 1fr))`
              : '88px',
          }}
        >
          {/* Header Row: Room Columns */}
          <div className="sticky top-0 z-20 flex flex-col justify-end border-b border-ink bg-ice px-2 py-1.5">
            <span className="font-mono text-[10px] font-bold text-ink">HOUR / ROOM</span>
            <span className="font-mono text-[9px] text-steel">{fmtRange(dayOpen, dayClose)} ICT</span>
          </div>

          {schedules.map(({ room: r, busyMinutes, pct, pendingCount }) => {
            return (
              <div key={r.id} className="sticky top-0 z-20 flex flex-col gap-0.5 border-b border-ink bg-ice px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[13px] font-bold text-ink">RM {r.code} <span className="font-sans text-[11px] font-normal text-graphite">{r.name}</span></span>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-mono text-[10px] text-steel">Cap {r.capacity}</span>
                    {pendingCount > 0 && (
                      <span className="rounded-sm border border-dashed border-plum bg-plum/[0.08] px-1 font-mono text-[10px] font-bold text-plum">
                        {pendingCount} PEND
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[9px] text-steel">
                  <span className="shrink-0">{Math.round(busyMinutes / 6) / 10}h / {durationMin(dayOpen, dayClose) / 60}h · {pct}%</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-[1px] bg-rule">
                    <div
                      className={cx(
                        'h-full transition-all duration-300',
                        pct > 75 ? 'bg-plum' : pct > 0 ? 'bg-accent' : 'bg-transparent',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {/* Hour Rows */}
          {rows.map(({ start, end }, i) => {
            const startHourStr = fmtTime(start)
            const endHourStr = fmtTime(end)

            return (
              <div key={startHourStr} className="contents">
                {/* Time Axis Cell */}
                <div className="flex items-center gap-1.5 border-b border-rule bg-paper/60 px-2 py-1 font-mono text-steel">
                  <span className="text-[11px] font-bold text-ink">{startHourStr}</span>
                  <span className="text-[9px]">→ {endHourStr}</span>
                </div>

                {/* Room Cells for this Hour */}
                {schedules.map(({ room: r, cells }) => {
                  const { bookings: bks, block } = cells[i]
                  const location = `Room ${r.code}, ${fmtDate(dayStart)}`
                  const range = fmtRange(start, end)

                  if (block) {
                    const blockRange = fmtRange(block.start, block.end)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className="calendar-focus group relative flex min-h-9 cursor-pointer flex-col justify-center border-b border-rule hatch-slate px-2 py-1 text-left text-paper transition-all hover:ring-2 hover:ring-accent"
                        onClick={(e) => onBlockClick(block.block, e.currentTarget)}
                        aria-label={`Inspect block: ${location} ${blockRange}, ${block.block.reason}`}
                      >
                        <span className="flex items-center justify-between font-mono text-[10px] font-bold">
                          <span>ROOM BLOCK</span>
                          <span className="text-white/80">{blockRange}</span>
                        </span>
                        <span className="line-clamp-1 text-[11px] font-medium leading-tight">{block.block.reason}</span>
                      </button>
                    )
                  }

                  if (bks.length) {
                    const hatch = conflictBands(bks.map(({ booking }) => booking))
                      .map((band) => ({ start: band.start > start ? band.start : start, end: band.end < end ? band.end : end }))
                      .filter((band) => band.start < band.end)
                    return (
                      <div key={r.id} className="relative flex flex-col gap-1 border-b border-rule bg-ice/30 p-1">
                        {hatch.length > 0 && (
                          <div className="pointer-events-none absolute inset-0 hatch-conflict" aria-hidden="true">
                            <span className="absolute right-1 bottom-0.5 z-10 bg-paper/95 px-0.5 font-mono text-[8px] font-bold text-danger">
                              {hatch.map((band) => `CONFLICT ${fmtRange(band.start, band.end)}`).join(' · ')}
                            </span>
                          </div>
                        )}
                        {bks.map(({ booking, start: bStart, end: bEnd }) => {
                          if (i > 0 && bStart < start) {
                            const colorClass = booking.kind === 'OFFICIAL'
                              ? 'border-rule border-l-4 border-l-accent bg-paper text-ink'
                              : booking.status === 'PENDING'
                                ? 'border-dashed border-plum bg-paper text-ink'
                                : booking.status === 'APPROVED'
                                  ? 'border-ink bg-ink text-paper'
                                  : booking.status === 'KEY_CHECKED_OUT'
                                    ? 'border-accent bg-accent text-paper'
                                    : 'border-rule bg-ice text-graphite'
                            return (
                              <button
                                key={booking.id}
                                type="button"
                                data-booking-id={booking.id}
                                onClick={(e) => onBookingClick(booking, e.currentTarget)}
                                aria-label={`Inspect booking (continuation): ${location} ${fmtRange(bStart, bEnd)}, continues until ${fmtTime(bEnd)}`}
                                className={cx(
                                  'calendar-focus relative z-[1] flex min-h-5 flex-1 cursor-pointer items-center rounded-sm border px-1.5 text-left font-mono text-[10px]',
                                  colorClass,
                                )}
                              >
                                ↳ continues until {fmtTime(bEnd)}
                              </button>
                            )
                          }
                          const official = booking.kind === 'OFFICIAL'
                          const pending = booking.status === 'PENDING'
                          const approved = booking.status === 'APPROVED'
                          const keyOut = booking.status === 'KEY_CHECKED_OUT'
                          const holder = booking.userId ? user(booking.userId) : undefined
                          const title = official || booking.userId ? booking.title : pending ? 'Pending request' : 'Reserved'
                          const status = pending ? 'PENDING' : keyOut ? 'KEY OUT' : booking.status
                          const bookingRange = fmtRange(bStart, bEnd)
                          const conflict = conflicts.get(booking.id)
                          const colors = conflict && CONFLICT_COLORS[conflict.letter]
                          const conflictLabel = conflict?.rivals
                            .map((rival) => {
                              const name = rival.userId ? user(rival.userId)?.fullName : undefined
                              return `conflicts with ${conflicts.get(rival.id)?.letter}: ${name ?? 'another booking'} ${fmtRange(rival.start, rival.end)}`
                            })
                            .join('; ')
                          return (
                            <button
                              key={booking.id}
                              type="button"
                              data-booking-id={booking.id}
                              onClick={(e) => onBookingClick(booking, e.currentTarget)}
                              aria-label={`Inspect booking: ${location} ${bookingRange}, ${title}, ${status}${conflictLabel ? `; ${conflictLabel}` : ''}`}
                              className={cx(
                                'calendar-focus group relative z-[1] flex flex-1 cursor-pointer flex-col justify-center overflow-hidden rounded-sm border px-1.5 py-1 text-left transition-all hover:shadow-md',
                                conflict && 'pl-3 outline-2 outline-solid outline-danger -outline-offset-2',
                                official
                                  ? 'border-rule border-l-4 border-l-accent bg-paper text-ink shadow-xs'
                                  : pending
                                    ? 'border-dashed border-plum bg-paper text-ink hover:bg-plum/[0.08]'
                                    : approved
                                      ? 'border-ink bg-ink text-paper'
                                      : keyOut
                                        ? 'border-accent bg-accent text-paper'
                                        : 'border-rule bg-ice text-graphite',
                              )}
                            >
                              {colors && <span aria-hidden="true" className={cx('absolute inset-y-0 left-0 w-1', colors.bar)} />}
                              <span className="flex items-center justify-between gap-1 font-mono text-[10px] font-bold">
                                <span className="flex min-w-0 items-center gap-1">
                                  {conflict && <span className={cx('shrink-0 rounded-sm px-1', colors?.badge)}>{conflict.letter}</span>}
                                  <span className={cx('truncate', official && 'rounded-sm bg-ink px-1 text-[9px] text-paper')}>
                                    {official ? booking.category ?? 'EVENT' : holder?.studentCode}
                                  </span>
                                </span>
                                <span className="shrink-0">{status} · {bookingRange}</span>
                              </span>
                              <span className="truncate text-[11px] font-bold">
                                {title}{!official && holder ? ` · ${holder.fullName}` : ''}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  }

                  const elapsed = end <= now
                  if (closed) {
                    return (
                      <div
                        key={r.id}
                        className="flex min-h-9 items-center justify-between border-b border-rule bg-ice px-2 font-mono text-[10px] text-steel hatch"
                        aria-label={`Closed: ${location} ${range}`}
                      >
                        <span className="font-semibold">CLOSED</span>
                        <span>{range}</span>
                      </div>
                    )
                  }
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={elapsed}
                      onClick={() =>
                        onAssignSlot({
                          roomId: r.id,
                          date: dayStart,
                          startTime: startHourStr,
                          endTime: endHourStr,
                        })
                      }
                      className={cx(
                        'calendar-focus group relative flex min-h-9 items-center justify-between gap-2 border-b border-rule bg-paper px-2 py-1 text-left transition-colors',
                        elapsed ? 'cursor-not-allowed bg-ice/30' : 'cursor-pointer hover:border-accent hover:bg-tint/30',
                      )}
                      aria-label={`${elapsed ? 'Past slot' : 'Assign activity'}: ${location} ${range}`}
                    >
                      <span className="font-mono text-[10px] font-semibold text-steel">{elapsed ? 'PAST' : 'FREE'} · {range}</span>
                      {!elapsed && (
                        <span className="flex items-center gap-1 rounded-sm border border-ink-blue bg-paper px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink-blue opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <Plus size={10} strokeWidth={2.5} /> Assign
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
