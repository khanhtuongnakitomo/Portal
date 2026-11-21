import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import type { Booking, RoomBlock } from '@/lib/types'
import {
  addDays,
  durationMin,
  fmtDate,
  fmtDuration,
  fmtRange,
  fmtStamp,
  fmtShort,
  fmtTime,
  overlaps,
  startOfDay,
  startOfWeek,
} from '@/lib/time'
import { Button, Eyebrow, Field, Input, StatusChip, Tag, Textarea, cx } from '@/components/ui'
import { NavItem, TopNav } from '@/components/Shell'
import { RoomTabs, roomColor } from '@/components/RoomTabs'
import { WeekCalendar } from '@/student/WeekCalendar'
import { AssignActivityModal, type AssignModalInitial } from './AssignActivityModal'
import { DayMatrixView } from './DayMatrixView'
import { ApprovalBoard } from './ApprovalBoard'
import { BlockInspectorModal } from './BlockInspectorModal'
import { QUICK_REJECT_REASONS } from './types'

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** Overdue keys pinned first, then the rest of today's bookings. */
function deskRows(managerToday: Booking[], overdueKeys: Booking[]) {
  const overdueIds = new Set(overdueKeys.map((b) => b.id))
  return {
    overdueIds,
    rows: [...overdueKeys, ...managerToday.filter((b) => !overdueIds.has(b.id))],
  }
}

export function ManagerView() {
  const { blocks, managerToday, overdueKeys, pendingQueue } = useStore()
  const now = useNow()

  const { rows } = deskRows(managerToday, overdueKeys)
  const keysOut = rows.filter((b) => b.status === 'KEY_CHECKED_OUT').length
  const activeBlocks = blocks.filter((k) => k.active && new Date(k.end) > now).length

  const stats: [string, number, string][] = [
    ['PENDING', pendingQueue.length, pendingQueue.length ? 'text-accent' : ''],
    ['TODAY', managerToday.length, ''],
    ['KEYS OUT', keysOut, ''],
    ['OVERDUE', overdueKeys.length, overdueKeys.length ? 'text-danger' : ''],
    ['ACTIVE BLOCKS', activeBlocks, ''],
  ]

  return (
    <>
      <TopNav>
        <NavItem active badge={pendingQueue.length}>
          Operations & Schedule
        </NavItem>
      </TopNav>

      <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 pt-4 pb-12">
        {/* Compact header strip */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule pb-3">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-[22px] leading-tight font-w450">Operations desk</h1>
            <span className="font-mono text-[12px] text-steel">FACILITIES · {fmtDate(now)}</span>
          </div>
          <dl className="flex flex-wrap items-center divide-x divide-rule rounded-md border border-rule bg-paper">
            {stats.map(([label, value, color]) => (
              <div key={label} className="flex items-baseline gap-2 px-3 py-1.5">
                <dt className="font-mono text-[11px] text-steel">{label}</dt>
                <dd className={cx('font-mono text-[16px] leading-none font-bold', color)}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <TodayLog />

        <OperationsWorkspace eyebrow="DAY MATRIX · REQUESTS · WEEK GRID" title="Schedule & occupancy" />
      </main>
    </>
  )
}

/* ───────────── Today's room log ───────────── */

function TodayLog() {
  const { managerToday, overdueKeys, refreshKeyDesk, checkoutKey, returnKey, connection, notify } = useStore()
  const { user, room } = useLookups()
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { overdueIds, rows } = deskRows(managerToday, overdueKeys)
  const keysOut = rows.filter((b) => b.status === 'KEY_CHECKED_OUT').length
  const borrowers = new Set(managerToday.map((b) => b.userId)).size
  const disabled = refreshing || !!busyId

  const refresh = async () => {
    if (disabled) return
    setRefreshing(true)
    try {
      await refreshKeyDesk()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to refresh today’s log.', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const markKey = async (booking: Booking, passCode?: string) => {
    if (disabled) return
    if (booking.status !== 'APPROVED' && booking.status !== 'KEY_CHECKED_OUT') return
    const handingOver = booking.status === 'APPROVED'
    if (handingOver && (!passCode || Date.parse(booking.end) <= Date.now())) return
    setBusyId(booking.id)
    try {
      const error = await (handingOver && passCode ? checkoutKey(booking.id, passCode) : returnKey(booking.id))
      if (error) notify(error, 'error')
      else notify(handingOver ? 'Key handover recorded.' : 'Key return recorded.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Key action failed.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="today-log-title" className="rounded-lg border border-rule bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="today-log-title" className="text-[16px] font-semibold">Today · {fmtDate(new Date())}</h2>
          <span className="font-mono text-[11px] text-steel">
            {borrowers} {borrowers === 1 ? 'BORROWER' : 'BORROWERS'} · {keysOut} KEYS OUT ·{' '}
            <span className={overdueKeys.length ? 'font-bold text-danger' : ''}>{overdueKeys.length} OVERDUE</span>
          </span>
          {connection === 'offline' && <span className="text-[12px] text-plum">Live data may be stale.</span>}
        </div>
        <Button variant="outline" size="xs" onClick={refresh} disabled={disabled} className="gap-1.5">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : undefined} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-[13px] text-steel">No room bookings at the desk today.</p>
      ) : (
        <div className="scrollbar-thin max-h-[264px] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-ice font-mono text-[11px] text-steel">
              <tr>
                {['TIME', 'ROOM', 'STUDENT', 'TITLE / PURPOSE', 'STATUS', 'KEY'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-1.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((booking) => {
                const holder = user(booking.userId)
                const bookingRoom = room(booking.roomId)
                const overdue = overdueIds.has(booking.id)
                const official = booking.kind === 'OFFICIAL'
                return (
                  <tr key={booking.id} className={cx('h-10', overdue && 'bg-danger/[0.06]')}>
                    <td className="px-3 font-mono whitespace-nowrap">
                      {fmtRange(booking.start, booking.end)}
                      {overdue && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-danger">
                          OVERDUE · due {fmtStamp(booking.end)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 font-mono font-semibold whitespace-nowrap">RM {bookingRoom?.code ?? '—'}</td>
                    <td className="max-w-[220px] truncate px-3" title={holder?.fullName}>
                      {holder ? (
                        official ? `${holder.fullName} (organiser)` : `${holder.fullName}${holder.studentCode ? ` · ${holder.studentCode}` : ''}`
                      ) : 'Holder unavailable'}
                    </td>
                    <td className="max-w-[280px] truncate px-3 text-graphite" title={booking.purpose || booking.title}>
                      {booking.title}{booking.purpose && booking.purpose !== booking.title ? ` — ${booking.purpose}` : ''}
                    </td>
                    <td className="px-3"><StatusChip status={booking.status} /></td>
                    <td className="px-3">
                      <KeyAction booking={booking} disabled={disabled} onAction={markKey} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function KeyAction({ booking, disabled, onAction }: {
  booking: Booking
  disabled: boolean
  onAction: (booking: Booking, passCode?: string) => Promise<void>
}) {
  const [code, setCode] = useState('')
  const enteredCode = code.trim()
  const approved = booking.status === 'APPROVED'
  const expectedCode = booking.passCode?.trim().toUpperCase()
  const codeMatches = !!expectedCode && enteredCode.toUpperCase() === expectedCode
  const endTime = Date.parse(booking.end)
  const [expiredEnd, setExpiredEnd] = useState<number | null>(null)
  const canHandOver = approved && expiredEnd !== endTime && endTime > Date.now()

  useEffect(() => {
    const remaining = endTime - Date.now()
    if (!approved || !(remaining > 0)) return
    const timer = window.setTimeout(() => setExpiredEnd(endTime), remaining)
    return () => window.clearTimeout(timer)
  }, [approved, endTime])

  if (booking.status === 'KEY_CHECKED_OUT') {
    return <Button size="xs" onClick={() => void onAction(booking)} disabled={disabled}>Receive key</Button>
  }
  if (!approved) return <span className="text-steel">—</span>
  if (!canHandOver) return <span className="text-steel">Ended</span>
  return (
    <form className="flex items-center gap-1.5" onSubmit={(event) => {
      event.preventDefault()
      if (codeMatches && !disabled && canHandOver && endTime > Date.now()) void onAction(booking, enteredCode)
    }}>
      <Input
        aria-label={`Pass code for ${booking.title}`}
        placeholder={expectedCode ? 'Pass code' : 'Code unavailable'}
        title={!expectedCode ? 'Pass code unavailable. Refresh the log.' : enteredCode && !codeMatches ? 'Pass code does not match.' : undefined}
        aria-invalid={!!enteredCode && !codeMatches}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        disabled={disabled || !expectedCode}
        autoComplete="off"
        className={cx('!w-28 !py-1 !text-[12px]', enteredCode && !codeMatches && '!border-danger')}
      />
      <Button type="submit" size="xs" disabled={disabled || !codeMatches}>Hand over</Button>
    </form>
  )
}

function ColumnHead({
  n,
  title,
  meta,
}: {
  n: string
  title: string
  meta?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-2">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-[18px] font-w450">{title}</h2>
        <span className="font-mono text-[11px] text-steel">{n}</span>
      </div>
      {meta}
    </div>
  )
}

/* ───────────── Reusable Operations Workspace ───────────── */

export interface OperationsWorkspaceProps {
  eyebrow?: string
  title?: string
}

export function OperationsWorkspace({
  eyebrow = '01 / MASTER CALENDAR · ALL-ROOMS MATRIX & APPROVAL',
  title = 'Room schedule & occupancy',
}: OperationsWorkspaceProps = {}) {
  const { rooms, bookings, blocks, settings, currentUser, notify, setVisibleRange, pendingQueue: pending } = useStore()
  const { user } = useLookups()

  const [firstPending] = useState(() => pending[0])

  const [roomId, setRoomId] = useState<string>('ALL')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(firstPending ? new Date(firstPending.start) : new Date()))
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()))

  const [review, setReview] = useState<{ id: string; el: HTMLElement; fromQueue?: boolean } | null>(null)
  const closeReview = useCallback(() => setReview(null), [])
  const [inspectedBlock, setInspectedBlock] = useState<RoomBlock | null>(null)

  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignInitial, setAssignInitial] = useState<AssignModalInitial | null>(null)

  useEffect(() => {
    if (rooms.length > 0 && roomId !== 'ALL' && !rooms.some((r) => r.id === roomId)) {
      setRoomId('ALL')
    }
  }, [rooms, roomId])

  const isAllRooms = roomId === 'ALL'
  const room = isAllRooms ? rooms[0] : (rooms.find((r) => r.id === roomId) ?? rooms[0])
  const weekEnd = addDays(weekStart, 7) // Mon–Sun
  const pendingThisWeek = pending.filter(
    (b) => (isAllRooms || b.roomId === room?.id) && new Date(b.start) >= weekStart && new Date(b.start) < weekEnd,
  ).length

  const handleOpenAssign = (initial: AssignModalInitial) => {
    setAssignInitial(initial)
    setAssignModalOpen(true)
  }

  const inspectPending = (b: Booking, el: HTMLElement) => {
    if (!isAllRooms) setRoomId(b.roomId)
    setWeekStart(startOfWeek(new Date(b.start)))
    setSelectedDay(startOfDay(new Date(b.start)))
    setReview({ id: b.id, el, fromQueue: true })
  }

  useEffect(() => {
    if (!review?.fromQueue) return
    const el = document.querySelector<HTMLElement>(`[data-week-grid] [data-booking-id="${review.id}"]`)
      ?? document.querySelector<HTMLElement>(`[data-booking-id="${review.id}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setReview({ id: review.id, el })
  }, [review, bookings, roomId, weekStart])

  if (!room || !currentUser) return null
  const reviewing = review ? pending.find((b) => b.id === review.id) ?? bookings.find((b) => b.id === review.id) : undefined

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <ColumnHead
        n={eyebrow}
        title={title}
        meta={
          <Button
            variant="accent"
            size="xs"
            onClick={() => handleOpenAssign({ roomId: room.id, date: selectedDay })}
            className="gap-1.5 shadow-xs"
          >
            <Plus size={14} strokeWidth={2.5} /> Assign Activity / Event
          </Button>
        }
      />

      {/* Day Matrix · All Rooms */}
      <DayMatrixView
        selectedDay={selectedDay}
        onChangeDay={setSelectedDay}
        onAssignSlot={(init) => handleOpenAssign(init)}
        onBookingClick={(b, el) => setReview(review?.id === b.id ? null : { id: b.id, el })}
        onBlockClick={(blk) => setInspectedBlock(blk)}
      />

      {/* Requests */}
      <ApprovalBoard onInspect={inspectPending} />

      {/* Week Grid by Room */}
      <div data-week-grid>
        <RoomTabs
          rooms={rooms}
          activeId={roomId}
          onChange={(id) => {
            setRoomId(id)
            setReview(null)
          }}
          badge={(id) => pending.filter((b) => b.roomId === id).length}
        />

        <div className="rounded-lg rounded-tl-none border border-ink bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-ice/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="!rounded-md !p-1.5"
                aria-label="Previous week"
                onClick={() => {
                  setReview(null)
                  setWeekStart((w) => addDays(w, -7))
                }}
              >
                <ChevronLeft size={16} />
              </Button>

              <Button
                variant="outline"
                className="!rounded-md !p-1.5"
                aria-label="Next week"
                onClick={() => {
                  setReview(null)
                  setWeekStart((w) => addDays(w, 7))
                }}
              >
                <ChevronRight size={16} />
              </Button>

              <Button
                variant="ghost"
                size="xs"
                className="!rounded-md"
                onClick={() => {
                  setReview(null)
                  setWeekStart(startOfWeek(new Date()))
                }}
              >
                This week
              </Button>

              <div className="ml-2 font-mono text-[13px] font-semibold text-ink">
                {fmtShort(weekStart)} — {fmtShort(addDays(weekStart, 6))} · MON–SUN
              </div>

              {pendingThisWeek > 0 && (
                <Tag className="ml-1 !border-dashed !border-plum !bg-plum/10 !text-plum">
                  {pendingThisWeek} TO REVIEW
                </Tag>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-graphite">
              {isAllRooms && (
                <>
                  {rooms.map((r) => (
                    <div key={r.id} className="flex items-center gap-1.5">
                      <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', roomColor(r).dot)} />
                      <span className="font-semibold text-ink">RM {r.code}</span>
                    </div>
                  ))}
                  <span className="text-rule">|</span>
                </>
              )}
              <Legend swatch="border border-ink bg-ink" label="Approved" />
              <Legend swatch="border border-dashed border-plum bg-plum/[0.08]" label="Pending" />
              <Legend swatch="border-2 border-accent bg-paper" label="Scheduled Event" />
              <Legend swatch="hatch-slate border border-ink" label="Room block" />
              <Legend swatch="hatch-conflict border border-danger" label="Conflict" />
            </div>
          </div>

          <div className="scrollbar-thin overflow-x-auto">
            <div className="min-w-[980px]">
              <WeekCalendar
                mode="manager"
                room={room}
                weekStart={weekStart}
                bookings={bookings}
                blocks={blocks}
                settings={settings}
                selection={null}
                onSelect={(s) => {
                  handleOpenAssign({
                    roomId: s.roomId ?? room.id,
                    date: s.start,
                    startTime: fmtTime(s.start),
                    endTime: fmtTime(s.end),
                    mode: 'EVENT',
                  })
                }}
                onReject={(m) => notify(m, 'error')}
                who={(id) => {
                  const u = user(id)
                  return u ? { name: u.fullName, code: u.studentCode } : undefined
                }}
                onEventClick={(b, el) => setReview(review?.id === b.id ? null : { id: b.id, el })}
                onBlockClick={(blk) => setInspectedBlock(blk)}
                activeId={review?.id}
                allRooms={isAllRooms}
                rooms={rooms}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-rule px-3 py-2 font-mono text-[11px] text-steel">
            <span className="h-2 w-2 rounded-full bg-accent" />
            DRAG OR CLICK ANY OPEN WEEKDAY SLOT TO ASSIGN ROOM ACTIVITY · WEEKENDS ARE NOT BOOKABLE · CLICK ANY BLOCK OR EVENT TO INSPECT / MANAGE
          </div>
        </div>
      </div>

      {/* Review & Details Popover anchored to calendar/matrix block */}
      {review && reviewing && (
        <ReviewPopover
          booking={reviewing}
          anchor={review.el}
          onClose={closeReview}
          onSwitchBooking={(nextId) => {
            const nextEl = document.querySelector<HTMLElement>(`[data-booking-id="${nextId}"]`)
            setReview({ id: nextId, el: nextEl ?? review.el })
          }}
        />
      )}

      {/* Block Inspector Modal */}
      {inspectedBlock && (
        <BlockInspectorModal
          block={inspectedBlock}
          onClose={() => setInspectedBlock(null)}
        />
      )}

      {/* Global Assign Activity Modal */}
      <AssignActivityModal
        isOpen={assignModalOpen}
        initial={assignInitial}
        onClose={() => {
          setVisibleRange(weekStart, addDays(weekStart, 7))
          setAssignModalOpen(false)
        }}
      />
    </section>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx('h-3 w-3 rounded-[1px]', swatch)} />
      {label}
    </span>
  )
}

/* ───────────── Anchored Review Popover ───────────── */

function ReviewPopover({
  booking: b,
  anchor,
  onClose,
  onSwitchBooking,
}: {
  booking: Booking
  anchor: HTMLElement
  onClose: () => void
  onSwitchBooking?: (id: string) => void
}) {
  const { approveBooking, rejectBooking, cancelBooking, bookings, blocks, pendingQueue, notify } = useStore()
  const { user, room } = useLookups()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; side: 'left' | 'right'; arrowTop: number } | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const u = user(b.userId)
  const r = room(b.roomId)
  const isPending = b.status === 'PENDING'
  const isEvent = b.kind === 'OFFICIAL'

  // Find all competing PENDING bookings in the same room that overlap [b.start, b.end]
  const competingGroup = useMemo(() => {
    if (b.status !== 'PENDING') return []
    return pendingQueue.filter(
      (other) =>
        other.roomId === b.roomId &&
        overlaps(new Date(other.start), new Date(other.end), new Date(b.start), new Date(b.end)),
    )
  }, [pendingQueue, b.roomId, b.status, b.start, b.end])

  const conflict =
    bookings.some(
      (x) =>
        x.id !== b.id &&
        x.roomId === b.roomId &&
        ['APPROVED', 'KEY_CHECKED_OUT'].includes(x.status) &&
        overlaps(new Date(x.start), new Date(x.end), new Date(b.start), new Date(b.end)),
    ) ||
    blocks.some((k) => k.active && k.roomId === b.roomId && overlaps(new Date(k.start), new Date(k.end), new Date(b.start), new Date(b.end)))

  useEffect(() => {
    setNote('')
    setError(null)
  }, [b.id])

  const finishReview = async (action: 'approve' | 'reject' | 'cancel') => {
    if (busy) return
    setError(null)
    if (action === 'reject' && !note.trim()) {
      setError('Please select or enter a rejection reason.')
      return
    }
    setBusy(true)
    try {
      const result = await (action === 'approve' ? approveBooking(b.id, note) : action === 'reject' ? rejectBooking(b.id, note) : cancelBooking(b.id))
      if (result) {
        setError(result)
        notify(result, 'error')
      } else {
        notify(action === 'approve' ? 'Booking approved.' : action === 'reject' ? 'Booking rejected.' : 'Scheduled event cancelled. Slots released.')
        onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  useLayoutEffect(() => {
    const place = () => {
      if (!anchor.isConnected) return onClose()
      const a = anchor.getBoundingClientRect()
      const panel = ref.current
      if (!panel) return
      const { width: w, height: h } = panel.getBoundingClientRect()
      const gap = 10
      const { clientWidth, clientHeight } = document.documentElement
      const side: 'left' | 'right' = a.right + gap + w <= clientWidth - 12 ? 'right' : 'left'
      const left = Math.max(12, Math.min(side === 'right' ? a.right + gap : a.left - gap - w, clientWidth - w - 12))
      const top = Math.max(12, Math.min(a.top - 8, clientHeight - h - 12))
      const arrowTop = Math.min(Math.max(14, a.top + Math.min(a.height, 44) / 2 - top), h - 20)
      setPos((previous) => previous?.top === top && previous.left === left && previous.side === side && previous.arrowTop === arrowTop
        ? previous : { top, left, side, arrowTop })
    }
    place()
    const resizeObserver = new ResizeObserver(place)
    if (ref.current) resizeObserver.observe(ref.current)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    window.addEventListener('transitionend', place, true)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('transitionend', place, true)
    }
  }, [anchor, onClose, b.id, b.status])

  useEffect(() => {
    if (busy) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor.contains(t)) return
      if ((t as HTMLElement).closest?.('[data-booking-id]')) return
      onClose()
    }
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', down)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('pointerdown', down)
    }
  }, [anchor, busy, onClose])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Review booking ${b.id}`}
      className="fixed z-50 flex min-w-0 flex-col rounded-lg border border-ink bg-paper shadow-nav"
      style={{
        width: 'min(380px, calc(100vw - 24px))',
        maxWidth: 'calc(100% - 24px)',
        maxHeight: 'min(calc(100vh - 24px), calc(100% - 24px))',
        top: pos?.top ?? 12,
        left: pos?.left ?? 12,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {pos && (
        <span
          className={cx(
            'absolute h-3 w-3 rotate-45 border-ink bg-paper',
            pos.side === 'right' ? '-left-[7px] border-b border-l' : '-right-[7px] border-t border-r',
          )}
          style={{ top: pos.arrowTop }}
        />
      )}

      <div className="min-h-0 overflow-x-hidden overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-rule px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Eyebrow className="!text-[12px]">
              {isEvent ? 'OFFICIAL SCHEDULE · ' : 'REVIEW · '}
              {b.id}
            </Eyebrow>
            {isEvent && (
              <span className="rounded-[2px] bg-accent px-1.5 py-0.2 font-mono text-[10px] font-bold text-paper">
                {b.category ?? 'EVENT'}
              </span>
            )}
          </div>
          <div className="font-display text-feature leading-tight font-w450 text-ink">
            {b.title}
          </div>
        </div>
        <button
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="-mr-1.5 rounded-md p-1 text-steel hover:bg-ice hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Competing Requests Switcher & Notice */}
      {competingGroup.length > 1 && (
        <div className="border-b border-rule bg-plum/[0.04] p-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-plum">
              <span>⚡</span> {competingGroup.length} COMPETING REQUESTS FOR THIS WINDOW
            </span>
            <span className="font-mono text-[9px] text-steel">CLICK TO SWITCH</span>
          </div>

          <p className="mt-1 font-sans text-[11px] leading-tight text-graphite">
            Approving this request will automatically decline the other {competingGroup.length - 1} overlapping pending request(s).
          </p>

          <div className="mt-2 flex flex-col gap-1.5">
            {competingGroup.map((other) => {
              const isCurrent = other.id === b.id
              const otherUser = user(other.userId)
              return (
                <button
                  key={other.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!isCurrent) onSwitchBooking?.(other.id)
                  }}
                  className={cx(
                    'flex items-center justify-between gap-2 rounded-[3px] px-2.5 py-1.5 text-left text-[11px] transition-colors',
                    isCurrent
                      ? 'border border-ink bg-ink text-paper font-semibold shadow-xs'
                      : 'border border-rule bg-paper text-ink hover:border-accent hover:bg-tint/30',
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={cx('font-mono font-bold', isCurrent ? 'text-tint' : 'text-accent')}>
                      {otherUser?.studentCode ?? '—'}
                    </span>
                    <span className="truncate">{otherUser?.fullName}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                    <span>{fmtRange(other.start, other.end)}</span>
                    {isCurrent && (
                      <span className="rounded-[2px] bg-paper px-1 font-mono text-[9px] font-bold text-ink">
                        CURRENT
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={b.status} />
          <span className="font-mono text-[12px] font-bold">RM {r?.code}</span>
          <span className="font-mono text-[12px] text-graphite">
            {fmtDate(b.start)} · {fmtRange(b.start, b.end)} · {fmtDuration(durationMin(b.start, b.end))}
          </span>
          {conflict && isPending && <Tag tone="plum">CONFLICT</Tag>}
        </div>

        {/* Credentials / Organizer */}
        <div className="grid grid-cols-[1fr_auto] items-end gap-3 border border-rule bg-ice px-3 py-2.5">
          <div className="min-w-0">
            <div className="font-mono text-[10px] text-steel">
              {isEvent ? 'ORGANIZER / STUDENT' : 'STUDENT'}
            </div>
            <div className="truncate text-[15px] font-semibold text-ink">{u?.fullName}</div>
          </div>
          {u?.studentCode && (
            <div className="text-right">
              <div className="font-mono text-[10px] text-steel">STUDENT ID</div>
              <div className="font-mono text-[14px] font-semibold text-meta">{u.studentCode}</div>
            </div>
          )}
          {u?.email && <span className="col-span-2 break-all text-[12px] text-graphite">{u.email}</span>}
        </div>

        {/* Purpose */}
        <div>
          <div className="font-mono text-[10px] text-steel">PURPOSE / SESSION NOTES</div>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-graphite">{b.purpose}</p>
        </div>

        {/* Review Note & Quick Chips */}
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Field label="Review Note / Rejection Reason" hint="Optional to approve, required to reject" error={error}>
              <Textarea
                rows={2}
                disabled={busy}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value)
                  setError(null)
                }}
                placeholder="Select a quick reason below or type custom note..."
                className="!rounded-none text-[12px]"
              />
            </Field>

            {/* Quick-Reject Reason Chips */}
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-semibold text-steel uppercase">
                1-Click Preset Rejection Reasons:
              </span>
              <div className="flex flex-wrap gap-1">
                {QUICK_REJECT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setNote(reason)
                      setError(null)
                    }}
                    className={cx(
                      'rounded-[2px] border px-1.5 py-0.5 text-left font-mono text-[10px] transition-colors',
                      note === reason
                        ? 'border-plum bg-plum text-paper font-semibold'
                        : 'border-rule bg-ice text-graphite hover:border-plum',
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          b.note && (
            <div className="border-l-2 border-accent bg-ice px-2.5 py-1.5 text-[12px] text-graphite">
              <span className="font-mono text-[10px] font-bold">DESK NOTE · </span>
              {b.note}
            </div>
          )
        )}
      </div>

      {/* Footer Actions */}
      {isPending ? (
        <div className="grid grid-cols-2 gap-2 border-t border-rule px-5 py-3 bg-ice/40">
          <Button
            variant="outline"
            className="hover:!bg-plum hover:!text-paper hover:!shadow-none"
            disabled={busy}
            onClick={() => finishReview('reject')}
          >
            <X size={14} /> Reject
          </Button>

          <Button
            variant="dark"
            disabled={busy}
            onClick={() => finishReview('approve')}
          >
            <Check size={14} />{' '}
            {competingGroup.length > 1
              ? `Approve & Decline ${competingGroup.length - 1} Other${competingGroup.length - 1 > 1 ? 's' : ''}`
              : 'Approve Now'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-t border-rule px-5 py-3 bg-ice/40">
          {/* Allow manager/admin to cancel official scheduled events */}
          {isEvent && b.status === 'APPROVED' ? (
            <Button
              variant="plum"
              size="xs"
              disabled={busy}
              onClick={() => finishReview('cancel')}
              className="gap-1"
            >
              <Ban size={12} /> Cancel Event
            </Button>
          ) : (
            <span className="font-mono text-[11px] text-steel">
              {b.status === 'APPROVED' ? 'APPROVED RESERVATION' : 'ENTRY RECORD'}
            </span>
          )}

          <Button variant="outline" size="xs" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>
      )}
      </div>
    </div>,
    document.body,
  )
}
