import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Ban,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
  Phone,
  Plus,
  TriangleAlert,
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
  fmtShort,
  fmtTime,
  overlaps,
  sameDay,
  startOfDay,
  startOfWeek,
} from '@/lib/time'
import { Button, Eyebrow, Field, StatusChip, Tag, Textarea, cx } from '@/components/ui'
import { NavItem, PageHeader, TopNav } from '@/components/Shell'
import { RoomTabs } from '@/components/RoomTabs'
import { Reveal, SplitText } from '@/components/effects'
import { WeekCalendar, extractEventBadge, isOfficialEvent } from '@/student/WeekCalendar'
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

function getInitialWorkday(candidate?: Date) {
  const d = candidate ? new Date(candidate) : new Date()
  const dow = d.getDay()
  if (dow === 6) return addDays(startOfDay(d), 2) // Sat -> Mon
  if (dow === 0) return addDays(startOfDay(d), 1) // Sun -> Mon
  return startOfDay(d)
}

export function ManagerView() {
  const { bookings, blocks } = useStore()
  const now = useNow()

  const pending = bookings.filter((b) => b.status === 'PENDING')
  const today = bookings.filter(
    (b) => sameDay(new Date(b.start), now) && ['APPROVED', 'COMPLETED', 'KEY_CHECKED_OUT'].includes(b.status),
  )
  const scheduled = bookings.filter((b) => ['APPROVED', 'KEY_CHECKED_OUT'].includes(b.status)).length
  const activeBlocks = blocks.filter((k) => k.active && new Date(k.end) > now).length

  return (
    <>
      <TopNav>
        <NavItem active badge={pending.length}>
          Operations & Schedule
        </NavItem>
      </TopNav>

      <main className="mx-auto max-w-[1440px] px-6 pt-10 pb-24">
        {/* Page Header */}
        <PageHeader
          eyebrow={`FACILITIES COMMAND · ${fmtDate(now)}`}
          title="Operations desk"
          body="Review booking requests with 1-click approvals, monitor the interactive hour occupancy grid & daily matrix, and assign room schedules for classes and university events."
          right={
            <div className="flex flex-col items-end gap-3">
              <Reveal stagger className="grid grid-cols-2 border-t border-l border-rule sm:grid-cols-4">
                {[
                  ['PENDING', pending.length, pending.length ? 'text-accent' : ''],
                  ['TODAY', today.length, ''],
                  ['SCHEDULED', scheduled, ''],
                  ['ACTIVE BLOCKS', activeBlocks, ''],
                ].map(([k, v, c]) => (
                  <div key={k as string} className="min-w-[110px] border-r border-b border-rule px-4 py-3 bg-paper">
                    <div className="font-mono text-[11px] text-steel">{k}</div>
                    <div className={cx('mt-1 font-display text-[32px] leading-none font-w450', c as string)}>
                      {String(v).padStart(2, '0')}
                    </div>
                  </div>
                ))}
              </Reveal>
            </div>
          }
        />

        {/* Master Operations Workspace */}
        <div className="mt-10">
          <OperationsWorkspace />
        </div>
      </main>
    </>
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
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-3">
      <div className="flex flex-col gap-2">
        <Eyebrow>{n}</Eyebrow>
        <h2 className="font-display text-section font-w450">
          <SplitText key={title} text={title} />
        </h2>
      </div>
      {meta}
    </div>
  )
}

/* ───────────── Reusable Operations Workspace ───────────── */

export interface OperationsWorkspaceProps {
  eyebrow?: string
  title?: string
  hideHeader?: boolean
}

export function OperationsWorkspace({
  eyebrow = '01 / MASTER CALENDAR · ALL-ROOMS MATRIX & APPROVAL',
  title = 'Room schedule & occupancy',
  hideHeader = false,
}: OperationsWorkspaceProps = {}) {
  const { rooms, bookings, blocks, settings, currentUser, notify } = useStore()
  const { user, room: roomOf } = useLookups()

  const firstPending = useMemo(
    () => bookings.filter((b) => b.status === 'PENDING').sort((a, b) => +new Date(a.start) - +new Date(b.start))[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [roomId, setRoomId] = useState<string>('ALL')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(firstPending ? new Date(firstPending.start) : new Date()))
  const [selectedDay, setSelectedDay] = useState<Date>(() =>
    getInitialWorkday(firstPending ? new Date(firstPending.start) : undefined),
  )
  const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'matrix'>('week')
  const [showApprovalBoard, setShowApprovalBoard] = useState(true)

  const [review, setReview] = useState<{ id: string; el: HTMLElement } | null>(null)
  const [jumpTo, setJumpTo] = useState<string | null>(firstPending?.id ?? null)
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
  const pending = bookings.filter((b) => b.status === 'PENDING').sort((a, b) => +new Date(a.start) - +new Date(b.start))
  const weekEnd = addDays(weekStart, 5) // 5 Workdays (Mon–Fri)
  const pendingThisWeek = pending.filter(
    (b) => (isAllRooms || b.roomId === room?.id) && new Date(b.start) >= weekStart && new Date(b.start) < weekEnd,
  ).length

  const handleOpenAssign = (initial?: AssignModalInitial) => {
    setAssignInitial(
      initial ?? {
        roomId: room?.id ?? rooms[0]?.id ?? '',
        date: selectedDay ?? new Date(),
        startTime: '09:00',
        endTime: '11:00',
        mode: 'EVENT',
      },
    )
    setAssignModalOpen(true)
  }

  // After jumping to a pending request, anchor the popover
  useEffect(() => {
    if (!jumpTo) return
    const el = document.querySelector<HTMLElement>(`[data-booking-id="${jumpTo}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setTimeout(() => setReview({ id: jumpTo, el }), 350)
    }
    setJumpTo(null)
  }, [jumpTo, roomId, weekStart, calendarViewMode])

  if (!room || !currentUser) return null
  const reviewing = review ? bookings.find((b) => b.id === review.id) : undefined

  return (
    <section className="flex min-w-0 flex-col gap-5">
      {/* Column Header & View Switcher */}
      {!hideHeader && (
        <ColumnHead
          n={eyebrow}
          title={title}
          meta={
            <div className="flex flex-wrap items-center gap-2">
              {/* View Switcher */}
              <div className="flex items-center rounded-[4px] border border-rule bg-ice p-0.5">
                <button
                  type="button"
                  onClick={() => setCalendarViewMode('week')}
                  className={cx(
                    'flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 font-mono text-[12px] font-semibold transition-all',
                    calendarViewMode === 'week'
                      ? 'border border-ink bg-paper text-ink shadow-xs'
                      : 'text-steel hover:text-ink',
                  )}
                >
                  <Calendar size={13} />
                  Week Grid · By Room
                </button>

                <button
                  type="button"
                  onClick={() => setCalendarViewMode('matrix')}
                  className={cx(
                    'flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 font-mono text-[12px] font-semibold transition-all',
                    calendarViewMode === 'matrix'
                      ? 'border border-ink bg-paper text-ink shadow-xs'
                      : 'text-steel hover:text-ink',
                  )}
                >
                  <LayoutGrid size={13} />
                  Day Matrix · All Rooms
                </button>
              </div>

              {/* Toggle Approval Board */}
              <Button
                variant={showApprovalBoard ? 'dark' : 'outline'}
                size="sm"
                onClick={() => setShowApprovalBoard((v) => !v)}
                className="gap-1.5"
              >
                <span>Approval Board ({pending.length})</span>
                {showApprovalBoard ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </Button>

              {/* Primary Action */}
              <Button
                variant="accent"
                size="sm"
                onClick={() => handleOpenAssign({ roomId: isAllRooms ? rooms[0]?.id ?? '' : room.id, date: selectedDay })}
                className="gap-1.5 shadow-xs"
              >
                <Plus size={14} strokeWidth={2.5} /> Assign Activity / Event
              </Button>
            </div>
          }
        />
      )}

      {/* Pending Requests Carousel */}
      <PendingQueueCarousel
        pending={pending}
        roomOf={roomOf}
        user={user}
        reviewId={review?.id}
        onSelectItem={(b) => {
          if (!isAllRooms) {
            setRoomId(b.roomId)
          }
          setWeekStart(startOfWeek(new Date(b.start)))
          setSelectedDay(startOfDay(new Date(b.start)))
          setReview(null)
          setJumpTo(b.id)
        }}
      />

      {/* Collapsible / Expandable Approval Board */}
      {showApprovalBoard && (
        <ApprovalBoard
          pending={pending}
          onInspect={(b) => {
            if (!isAllRooms) {
              setRoomId(b.roomId)
            }
            setWeekStart(startOfWeek(new Date(b.start)))
            setSelectedDay(startOfDay(new Date(b.start)))
            setReview(null)
            setJumpTo(b.id)
          }}
        />
      )}

      {/* View Mode 1: Week Grid by Room */}
      {calendarViewMode === 'week' ? (
        <div>
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
            {/* Week Navigation Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3 bg-ice/30">
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
                  {fmtShort(weekStart)} — {fmtShort(addDays(weekStart, 4))} · MON–FRI
                </div>

                {pendingThisWeek > 0 && (
                  <Tag className="ml-1 !border-dashed !border-plum !bg-plum/10 !text-plum">
                    {pendingThisWeek} TO REVIEW
                  </Tag>
                )}
              </div>

              {/* Legend with Multi-Room Colors & Statuses */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-graphite font-mono">
                {isAllRooms && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0" />
                      <span className="font-semibold text-ink">RM 601</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shrink-0" />
                      <span className="font-semibold text-ink">RM 602</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-violet-600 shrink-0" />
                      <span className="font-semibold text-ink">RM 605</span>
                    </div>
                    <span className="text-rule">|</span>
                  </>
                )}
                <Legend swatch="border border-ink bg-ink" label="Approved" />
                <Legend swatch="border border-dashed border-plum bg-plum/[0.08]" label="Pending" />
                <Legend swatch="border-2 border-accent bg-paper" label="Scheduled Event" />
                <Legend swatch="hatch-slate border border-ink" label="Room block" />
              </div>
            </div>

            {/* Calendar Canvas */}
            <div className="scrollbar-thin overflow-x-auto">
              <div className="min-w-[860px]">
                <WeekCalendar
                  mode="manager"
                  room={room}
                  weekStart={weekStart}
                  bookings={bookings}
                  blocks={blocks}
                  settings={settings}
                  currentUserId={currentUser.id}
                  selection={null}
                  onSelect={(s) => {
                    // Open Assign Modal prefilled with exact room and time window
                    const sh = String(s.start.getHours()).padStart(2, '0')
                    const sm = String(s.start.getMinutes()).padStart(2, '0')
                    const eh = String(s.end.getHours()).padStart(2, '0')
                    const em = String(s.end.getMinutes()).padStart(2, '0')
                    handleOpenAssign({
                      roomId: isAllRooms ? rooms[0]?.id ?? '' : room.id,
                      date: s.start,
                      startTime: `${sh}:${sm}`,
                      endTime: `${eh}:${em}`,
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

            {/* Bottom Comfort Notice */}
            <div className="flex items-center justify-between border-t border-rule px-4 py-2.5 font-mono text-[11px] text-steel">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent" />
                DRAG OR CLICK ANY OPEN HOUR SLOT TO ASSIGN ROOM ACTIVITY · CLICK ANY BLOCK OR EVENT TO INSPECT / MANAGE
              </div>
              <button
                type="button"
                onClick={() => setCalendarViewMode('matrix')}
                className="font-bold text-accent hover:underline"
              >
                Switch to All-Rooms Day Matrix →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* View Mode 2: Day Matrix Across All Rooms */
        <DayMatrixView
          selectedDay={selectedDay}
          onChangeDay={setSelectedDay}
          onAssignSlot={(init) => handleOpenAssign(init)}
          onBookingClick={(b, el) => setReview(review?.id === b.id ? null : { id: b.id, el })}
          onBlockClick={(blk) => setInspectedBlock(blk)}
        />
      )}

      {/* Review & Details Popover anchored to calendar/matrix block */}
      {review && reviewing && (
        <ReviewPopover
          booking={reviewing}
          anchor={review.el}
          onClose={() => setReview(null)}
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
        onClose={() => setAssignModalOpen(false)}
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

/* ───────────── Pending Queue Carousel ───────────── */

interface PendingQueueCarouselProps {
  pending: Booking[]
  roomOf: (id: string) => ReturnType<ReturnType<typeof useLookups>['room']>
  user: (id: string) => ReturnType<ReturnType<typeof useLookups>['user']>
  reviewId?: string
  onSelectItem?: (item: Booking) => void
}

function PendingQueueCarousel({
  pending,
  roomOf,
  user,
  reviewId,
  onSelectItem,
}: PendingQueueCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const isDownRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const hasDraggedRef = useRef(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) {
      setCanScrollPrev(false)
      setCanScrollNext(false)
      return
    }
    const atStart = el.scrollLeft <= 2
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
    setCanScrollPrev(!atStart)
    setCanScrollNext(!atEnd)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => updateScrollState()
    el.addEventListener('scroll', handleScroll, { passive: true })

    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)

    return () => {
      el.removeEventListener('scroll', handleScroll)
      ro.disconnect()
    }
  }, [pending.length, updateScrollState])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onMouseMove = (e: MouseEvent) => {
      if (!isDownRef.current) return
      const x = e.pageX - el.offsetLeft
      const walk = (x - startXRef.current) * 1.3
      if (Math.abs(x - startXRef.current) > 5) {
        hasDraggedRef.current = true
      }
      el.scrollLeft = scrollLeftRef.current - walk
    }

    const onMouseUp = () => {
      if (!isDownRef.current) return
      isDownRef.current = false
      setIsDragging(false)
      if (hasDraggedRef.current) {
        setTimeout(() => {
          hasDraggedRef.current = false
        }, 50)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    isDownRef.current = true
    hasDraggedRef.current = false
    startXRef.current = e.pageX - el.offsetLeft
    scrollLeftRef.current = el.scrollLeft
    setIsDragging(true)
  }

  const handlePrev = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: -220, behavior: 'smooth' })
  }

  const handleNext = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: 220, behavior: 'smooth' })
  }

  return (
    <div className="flex items-center gap-3">
      {/* Badge & Carousel Controls */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#E0E0E0] bg-[#ffffff] px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-wider text-ink shadow-xs select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0F62FE]" />
          [ • PENDING QUEUE • {pending.length} ]
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous pending requests"
            disabled={!canScrollPrev}
            onClick={handlePrev}
            className={cx(
              'flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[2px] border border-[#E0E0E0] bg-[#FFFFFF] text-[#000000] transition-colors duration-150',
              canScrollPrev
                ? 'cursor-pointer hover:border-[#0F62FE] hover:text-[#0F62FE]'
                : 'cursor-not-allowed opacity-35',
            )}
          >
            <ChevronLeft size={14} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            aria-label="Next pending requests"
            disabled={!canScrollNext}
            onClick={handleNext}
            className={cx(
              'flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[2px] border border-[#E0E0E0] bg-[#FFFFFF] text-[#000000] transition-colors duration-150',
              canScrollNext
                ? 'cursor-pointer hover:border-[#0F62FE] hover:text-[#0F62FE]'
                : 'cursor-not-allowed opacity-35',
            )}
          >
            <ChevronRight size={14} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Reel container */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        className={cx(
          'no-scrollbar flex flex-1 items-center gap-3 overflow-x-auto py-1',
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab',
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {pending.length === 0 && (
          <span className="inline-flex items-center rounded-[4px] border border-[#E0E0E0] bg-[#F4F5F7] px-3.5 py-2 font-mono text-[11px] text-steel select-none">
            QUEUE CLEAR · ALL REQUESTS PROCESSED
          </span>
        )}
        {pending.map((b) => {
          const u = user(b.userId)
          const r = roomOf(b.roomId)
          const isSelected = reviewId === b.id
          return (
            <button
              type="button"
              key={b.id}
              onDragStart={(e) => e.preventDefault()}
              onClick={(e) => {
                if (hasDraggedRef.current) {
                  e.preventDefault()
                  e.stopPropagation()
                  return
                }
                onSelectItem?.(b)
              }}
              className={cx(
                'flex shrink-0 select-none flex-col gap-1 rounded-[4px] border border-[#E0E0E0] border-l-[3px] border-l-[#0F62FE] bg-[#F4F5F7] px-3.5 py-2 text-left transition-colors duration-150',
                isDragging
                  ? 'cursor-grabbing'
                  : 'cursor-grab hover:border-[#000000] hover:border-l-[#0F62FE] hover:bg-[#FFFFFF]',
                isSelected && 'border-[#000000] border-l-[#0F62FE] bg-[#FFFFFF] shadow-xs ring-1 ring-ink',
              )}
            >
              {/* Top row */}
              <div className="flex items-center justify-between gap-3">
                <span className="font-sans text-[13px] font-semibold text-[#000000]">
                  RM {r?.code ?? '—'}
                </span>
                <span className="font-mono text-[12px] font-normal text-[#424242] whitespace-nowrap">
                  {fmtShort(b.start)} • {fmtTime(b.start)}
                </span>
              </div>

              {/* Bottom row */}
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[12px] font-semibold text-[#0F62FE]">
                  {u?.studentCode ?? '—'}
                </span>
                <span className="text-[11px] text-[#424242]">•</span>
                <span className="truncate max-w-[130px] font-sans text-[12px] font-normal text-[#424242]">
                  {u?.fullName ?? 'Student'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
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
  const { approveBooking, rejectBooking, cancelBooking, bookings, blocks, notify } = useStore()
  const { user, room } = useLookups()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; side: 'left' | 'right'; arrowTop: number } | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const u = user(b.userId)
  const r = room(b.roomId)
  const isPending = b.status === 'PENDING'
  const isEvent = isOfficialEvent(b)
  const badgeInfo = extractEventBadge(b.title)

  // Find all competing PENDING bookings in the same room that overlap [b.start, b.end]
  const competingGroup = useMemo(() => {
    if (b.status !== 'PENDING') return []
    return bookings.filter(
      (other) =>
        other.roomId === b.roomId &&
        other.status === 'PENDING' &&
        overlaps(new Date(other.start), new Date(other.end), new Date(b.start), new Date(b.end)),
    )
  }, [bookings, b.roomId, b.status, b.start, b.end])

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

  useLayoutEffect(() => {
    const place = () => {
      if (!anchor.isConnected) return onClose()
      const a = anchor.getBoundingClientRect()
      const w = 380
      const h = ref.current?.offsetHeight ?? 440
      const gap = 10
      const side: 'left' | 'right' = a.right + gap + w <= window.innerWidth - 12 ? 'right' : 'left'
      const left = side === 'right' ? a.right + gap : Math.max(12, a.left - gap - w)
      const top = Math.min(Math.max(12, a.top - 8), window.innerHeight - h - 12)
      const arrowTop = Math.min(Math.max(14, a.top + Math.min(a.height, 44) / 2 - top), h - 20)
      setPos({ top, left, side, arrowTop })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    window.addEventListener('transitionend', place, true)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('transitionend', place, true)
    }
  }, [anchor, onClose, b.id, b.status])

  useEffect(() => {
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
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Review booking ${b.id}`}
      className="fixed z-50 w-[380px] rounded-lg border border-ink bg-paper shadow-nav"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
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
                {badgeInfo?.tag ?? 'EVENT'}
              </span>
            )}
          </div>
          <div className="font-display text-feature leading-tight font-w450 text-ink">
            {badgeInfo?.cleanTitle || b.title}
          </div>
        </div>
        <button
          onClick={onClose}
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
          <div className="text-right">
            <div className="font-mono text-[10px] text-steel">STUDENT ID</div>
            <div className="font-mono text-[14px] font-semibold text-meta">{u?.studentCode ?? '—'}</div>
          </div>
          {b.phone && (
            <div className="col-span-2 flex flex-col gap-1 border-t border-dashed border-edge pt-2 text-[12px] text-graphite">
              <span className="flex items-center gap-2">
                <Phone size={12} className="text-steel" />
                <span className="font-mono font-semibold text-ink">{b.phone}</span>
              </span>
            </div>
          )}
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
            onClick={() => {
              const err = rejectBooking(b.id, note)
              if (err) setError(err)
              else onClose()
            }}
          >
            <X size={14} /> Reject
          </Button>

          <Button
            variant="dark"
            onClick={() => {
              approveBooking(b.id, note)
              onClose()
            }}
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
          {isEvent && (b.status === 'APPROVED' || b.status === 'PENDING') ? (
            <Button
              variant="plum"
              size="xs"
              onClick={() => {
                cancelBooking(b.id)
                notify('Scheduled event cancelled. Slots released.')
                onClose()
              }}
              className="gap-1"
            >
              <Ban size={12} /> Cancel Event
            </Button>
          ) : (
            <span className="font-mono text-[11px] text-steel">
              {b.status === 'APPROVED' ? 'APPROVED RESERVATION' : 'ENTRY RECORD'}
            </span>
          )}

          <Button variant="outline" size="xs" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>,
    document.body,
  )
}
