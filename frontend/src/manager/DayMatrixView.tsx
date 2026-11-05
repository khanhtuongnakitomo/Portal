import { useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import type { Booking, Room, RoomBlock } from '@/lib/types'
import { addDays, at, fmtDate, fmtShort, fmtTime, overlaps, parseHM, sameDay, startOfDay } from '@/lib/time'
import { Button, StatusChip, cx } from '@/components/ui'
import { extractEventBadge, isOfficialEvent } from '@/student/WeekCalendar'
import type { AssignModalInitial } from './AssignActivityModal'

interface DayMatrixViewProps {
  selectedDay: Date
  onChangeDay: (d: Date) => void
  onAssignSlot: (initial: AssignModalInitial) => void
  onBookingClick: (b: Booking, el: HTMLElement) => void
  onBlockClick: (blk: RoomBlock, el: HTMLElement) => void
}

function getPrevWorkday(d: Date): Date {
  const dow = d.getDay()
  if (dow === 1) return addDays(d, -3) // Mon -> Fri
  if (dow === 0) return addDays(d, -2) // Sun -> Fri
  if (dow === 6) return addDays(d, -1) // Sat -> Fri
  return addDays(d, -1)
}

function getNextWorkday(d: Date): Date {
  const dow = d.getDay()
  if (dow === 5) return addDays(d, 3) // Fri -> Mon
  if (dow === 6) return addDays(d, 2) // Sat -> Mon
  if (dow === 0) return addDays(d, 1) // Sun -> Mon
  return addDays(d, 1)
}

function snapToWorkday(d: Date): Date {
  const dow = d.getDay()
  if (dow === 6) return addDays(d, 2)
  if (dow === 0) return addDays(d, 1)
  return d
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16] // 08:00 to 17:00 (9 hours)

export function DayMatrixView({
  selectedDay,
  onChangeDay,
  onAssignSlot,
  onBookingClick,
  onBlockClick,
}: DayMatrixViewProps) {
  const { rooms, bookings, blocks, settings } = useStore()
  const { user } = useLookups()
  const now = new Date()

  const open = parseHM(settings.openTime)
  const close = parseHM(settings.closeTime)

  const isToday = sameDay(selectedDay, now)
  const isPast = startOfDay(selectedDay) < startOfDay(now)

  // Auto-snap weekends to workdays
  useEffect(() => {
    const dow = selectedDay.getDay()
    if (dow === 0 || dow === 6) {
      onChangeDay(snapToWorkday(selectedDay))
    }
  }, [selectedDay, onChangeDay])

  // Filter bookings and blocks for the selected day
  const dayBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        sameDay(new Date(b.start), selectedDay) &&
        ['PENDING', 'APPROVED', 'KEY_CHECKED_OUT', 'COMPLETED'].includes(b.status),
    )
  }, [bookings, selectedDay])

  const dayBlocks = useMemo(() => {
    return blocks.filter((k) => k.active && sameDay(new Date(k.start), selectedDay))
  }, [blocks, selectedDay])

  // Compute occupancy per room for this day
  const roomOccupancyStats = useMemo(() => {
    const stats: Record<string, { busyHours: number; pct: number; pendingCount: number }> = {}
    for (const r of rooms) {
      const rBookings = dayBookings.filter((b) => b.roomId === r.id)
      const rBlocks = dayBlocks.filter((k) => k.roomId === r.id)
      const pendingCount = rBookings.filter((b) => b.status === 'PENDING').length

      let busyHours = 0
      for (const h of HOURS) {
        const slotStart = at(selectedDay, h, 0)
        const slotEnd = at(selectedDay, h + 1, 0)
        const hasBk = rBookings.some((b) => overlaps(new Date(b.start), new Date(b.end), slotStart, slotEnd))
        const hasBlk = rBlocks.some((k) => overlaps(new Date(k.start), new Date(k.end), slotStart, slotEnd))
        if (hasBk || hasBlk) busyHours++
      }
      stats[r.id] = {
        busyHours,
        pct: Math.min(100, Math.round((busyHours / HOURS.length) * 100)),
        pendingCount,
      }
    }
    return stats
  }, [rooms, dayBookings, dayBlocks, selectedDay])

  return (
    <div className="flex flex-col rounded-lg border border-ink bg-paper">
      {/* Date Navigation & Matrix Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-ice/40 px-4 py-3">
        {/* Day Navigator (Workdays Only) */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            className="!rounded-md !p-1.5"
            aria-label="Previous workday"
            onClick={() => onChangeDay(getPrevWorkday(selectedDay))}
          >
            <ChevronLeft size={16} />
          </Button>

          <Button
            variant="outline"
            size="xs"
            className="!rounded-md !p-1.5"
            aria-label="Next workday"
            onClick={() => onChangeDay(getNextWorkday(selectedDay))}
          >
            <ChevronRight size={16} />
          </Button>

          <Button
            variant={isToday ? 'dark' : 'outline'}
            size="xs"
            className="!rounded-md"
            onClick={() => onChangeDay(snapToWorkday(startOfDay(now)))}
          >
            Today
          </Button>

          <div className="ml-2 flex items-center gap-2 font-mono text-[13px] font-bold text-ink">
            <span>{fmtDate(selectedDay)}</span>
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
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-graphite">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[1px] border border-dashed border-rule bg-paper" />
            Free (Click to assign)
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
            Scheduled Event
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[1px] hatch-slate border border-ink" />
            Block
          </span>
        </div>
      </div>

      {/* Matrix Table Container */}
      <div className="scrollbar-thin overflow-x-auto">
        <div
          className="grid min-w-[960px] divide-x divide-rule"
          style={{
            gridTemplateColumns: `110px repeat(${rooms.length}, minmax(240px, 1fr))`,
          }}
        >
          {/* Header Row: Room Columns */}
          <div className="sticky top-0 z-20 flex flex-col justify-end border-b border-ink bg-ice px-3 py-3">
            <span className="font-mono text-[11px] font-bold text-ink">HOUR / ROOM</span>
            <span className="font-mono text-[10px] text-steel">08:00 — 17:00</span>
          </div>

          {rooms.map((r) => {
            const st = roomOccupancyStats[r.id] ?? { busyHours: 0, pct: 0, pendingCount: 0 }
            return (
              <div key={r.id} className="sticky top-0 z-20 flex flex-col gap-1 border-b border-ink bg-ice px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[15px] font-bold text-ink">RM {r.code}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[11px] text-steel">Cap {r.capacity}</span>
                    {st.pendingCount > 0 && (
                      <span className="rounded-sm border border-dashed border-plum bg-plum/[0.08] px-1 font-mono text-[10px] font-bold text-plum">
                        {st.pendingCount} PEND
                      </span>
                    )}
                  </div>
                </div>

                <div className="truncate text-[11px] text-graphite">{r.name}</div>

                {/* Room Occupancy Bar for this Day */}
                <div className="mt-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between font-mono text-[9px] text-steel">
                    <span>{st.busyHours}h / {HOURS.length}h</span>
                    <span>{st.pct}% OCCUPIED</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-[1px] bg-rule">
                    <div
                      className={cx(
                        'h-full transition-all duration-300',
                        st.pct > 75 ? 'bg-plum' : st.pct > 0 ? 'bg-accent' : 'bg-transparent',
                      )}
                      style={{ width: `${st.pct}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}

          {/* Hour Rows */}
          {HOURS.map((h) => {
            const startHourStr = `${String(h).padStart(2, '0')}:00`
            const endHourStr = `${String(h + 1).padStart(2, '0')}:00`
            const slotStart = at(selectedDay, h, 0)
            const slotEnd = at(selectedDay, h + 1, 0)

            return (
              <div key={h} className="contents">
                {/* Time Axis Cell */}
                <div className="flex flex-col justify-center border-b border-rule bg-paper/60 px-3 py-2.5 font-mono text-steel">
                  <span className="text-[12px] font-bold text-ink">{startHourStr}</span>
                  <span className="text-[10px]">→ {endHourStr}</span>
                </div>

                {/* Room Cells for this Hour */}
                {rooms.map((r) => {
                  const bks = dayBookings.filter(
                    (b) => b.roomId === r.id && overlaps(new Date(b.start), new Date(b.end), slotStart, slotEnd),
                  )
                  const blks = dayBlocks.filter(
                    (k) => k.roomId === r.id && overlaps(new Date(k.start), new Date(k.end), slotStart, slotEnd),
                  )

                  const booking = bks[0]
                  const block = blks[0]

                  // CASE 1: ROOM BLOCK
                  if (block) {
                    return (
                      <div
                        key={r.id}
                        className="group relative flex cursor-pointer flex-col justify-between border-b border-rule hatch-slate p-2.5 text-paper transition-all hover:ring-2 hover:ring-accent"
                        onClick={(e) => onBlockClick(block, e.currentTarget)}
                        title={`Blocked: ${block.reason} (Click to inspect or cancel)`}
                      >
                        <div className="flex items-center justify-between font-mono text-[10px] font-bold">
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-paper" />
                            ROOM BLOCK
                          </span>
                          <span className="text-white/70">
                            {fmtTime(block.start)}–{fmtTime(block.end)}
                          </span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-[12px] font-medium leading-tight">
                          {block.reason}
                        </div>
                        <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-white/75">
                          <span>CLICK TO MANAGE</span>
                        </div>
                      </div>
                    )
                  }

                  // CASE 2: BOOKING (SINGLE OR MULTIPLE COMPETING PENDING)
                  if (bks.length > 0) {
                    if (bks.length === 1) {
                      const booking = bks[0]
                      const u = user(booking.userId)
                      const isEvent = isOfficialEvent(booking)
                      const badge = extractEventBadge(booking.title)
                      const isPending = booking.status === 'PENDING'
                      const isKeyOut = booking.status === 'KEY_CHECKED_OUT'
                      const isApproved = booking.status === 'APPROVED'

                      return (
                        <div
                          key={r.id}
                          data-booking-id={booking.id}
                          className={cx(
                            'group relative flex cursor-pointer flex-col justify-between border-b border-rule p-2.5 transition-all hover:shadow-md',
                            isEvent
                              ? 'border-l-4 border-l-accent bg-paper text-ink shadow-xs'
                              : isPending
                                ? 'border-dashed border-plum bg-plum/[0.04] text-ink hover:bg-plum/[0.08]'
                                : isApproved
                                  ? 'bg-ink text-paper'
                                  : isKeyOut
                                    ? 'bg-accent text-paper'
                                    : 'bg-ice text-graphite',
                          )}
                          onClick={(e) => onBookingClick(booking, e.currentTarget)}
                          title={`${booking.title} · ${booking.status} (Click to review)`}
                        >
                          {/* Top row: Status / Badge & Time */}
                          <div className="flex items-center justify-between gap-1 font-mono text-[10px] font-bold">
                            {isEvent ? (
                              <span className="rounded-[2px] bg-accent px-1.5 py-0.5 text-[9px] text-paper">
                                {badge?.tag ? `${badge.tag} · EVENT` : 'EVENT'}
                              </span>
                            ) : (
                              <span className="truncate">
                                {u?.studentCode ?? 'SE184022'}
                              </span>
                            )}

                            <span className={cx('shrink-0 text-[10px]', isEvent ? 'text-accent' : 'opacity-85')}>
                              {isPending
                                ? 'PENDING REVIEW'
                                : isKeyOut
                                  ? 'KEY OUT'
                                  : isApproved
                                    ? 'APPROVED'
                                    : booking.status}
                            </span>
                          </div>

                          {/* Title / Name */}
                          <div className="mt-1 flex flex-col">
                            <span className={cx('truncate text-[12px] font-bold', isEvent ? 'text-ink' : '')}>
                              {badge?.cleanTitle || booking.title}
                            </span>
                            {!isEvent && (
                              <span className="truncate text-[11px] opacity-80">
                                {u?.fullName}
                              </span>
                            )}
                          </div>

                          {/* Bottom Row */}
                          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] opacity-75">
                            <span>
                              {fmtTime(booking.start)}–{fmtTime(booking.end)}
                            </span>
                            <span className="underline group-hover:opacity-100">
                              {isPending ? 'REVIEW →' : 'INSPECT'}
                            </span>
                          </div>
                        </div>
                      )
                    }

                    // Multiple competing requests overlapping this room & hour slot
                    return (
                      <div key={r.id} className="flex flex-col gap-1.5 border-b border-rule bg-ice/30 p-1.5">
                        <div className="flex items-center justify-between font-mono text-[9px] font-bold text-plum">
                          <span>⚡ {bks.length} COMPETING REQS</span>
                          <span>CLICK TO REVIEW</span>
                        </div>
                        {bks.map((booking, idx) => {
                          const u = user(booking.userId)
                          const isPending = booking.status === 'PENDING'
                          const isApproved = booking.status === 'APPROVED'
                          const isKeyOut = booking.status === 'KEY_CHECKED_OUT'
                          return (
                            <div
                              key={booking.id}
                              data-booking-id={booking.id}
                              onClick={(e) => onBookingClick(booking, e.currentTarget)}
                              className={cx(
                                'group flex cursor-pointer flex-col justify-between rounded-[3px] border p-1.5 transition-all hover:shadow-xs',
                                isPending
                                  ? 'border-dashed border-plum/80 bg-plum/[0.08] hover:bg-plum/[0.15] text-ink'
                                  : isApproved
                                    ? 'border-ink bg-ink text-paper'
                                    : isKeyOut
                                      ? 'border-accent bg-accent text-paper'
                                      : 'border-rule bg-paper text-graphite',
                              )}
                              title={`${booking.title} · ${booking.status} (Click to inspect / resolve)`}
                            >
                              <div className="flex items-center justify-between gap-1 font-mono text-[9px] font-bold">
                                <span className="truncate">
                                  {isPending ? `⚡ #${idx + 1} · ` : ''}
                                  {u?.studentCode ?? 'STUDENT'}
                                </span>
                                <span className="opacity-80">
                                  {fmtTime(booking.start)}–{fmtTime(booking.end)}
                                </span>
                              </div>
                              <div className="truncate text-[10px] font-medium opacity-90">
                                {u?.fullName}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }

                  // CASE 3: FREE SLOT
                  return (
                    <div
                      key={r.id}
                      onClick={() =>
                        !isPast &&
                        onAssignSlot({
                          roomId: r.id,
                          date: selectedDay,
                          startTime: startHourStr,
                          endTime: endHourStr,
                        })
                      }
                      className={cx(
                        'group flex cursor-pointer flex-col justify-between border-b border-rule bg-paper p-2.5 transition-colors',
                        isPast
                          ? 'cursor-not-allowed opacity-50 bg-ice/30'
                          : 'hover:border-accent hover:bg-tint/30',
                      )}
                      title={isPast ? 'Past hour cannot be scheduled' : `Free slot · Click to assign RM ${r.code} (${startHourStr}–${endHourStr})`}
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-steel">
                        <span className="group-hover:text-accent font-semibold">FREE</span>
                        <span>{startHourStr}–{endHourStr}</span>
                      </div>

                      <div className="my-auto flex items-center justify-center py-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="flex items-center gap-1 rounded-[3px] border border-accent bg-paper px-2 py-0.5 font-mono text-[11px] font-bold text-accent shadow-xs">
                          <Plus size={11} strokeWidth={2.5} /> Assign Activity
                        </span>
                      </div>

                      <div className="font-mono text-[9px] text-steel/50">
                        RM {r.code} · Available
                      </div>
                    </div>
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
