import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Ban, Check, ChevronLeft, ChevronRight, KeyRound, Mail, Phone, Search, TriangleAlert, Undo2, X } from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import type { Booking } from '@/lib/types'
import { addDays, durationMin, fmtDate, fmtDuration, fmtRange, fmtShort, fmtTime, overlaps, sameDay, startOfDay, startOfWeek, toLocalInput } from '@/lib/time'
import { Button, EmptyState, Eyebrow, Field, Input, StatusChip, Tag, Textarea, cx } from '@/components/ui'
import { NavItem, PageHeader, TopNav } from '@/components/Shell'
import { RoomTabs } from '@/components/RoomTabs'
import { Reveal, SplitText } from '@/components/effects'
import { WeekCalendar } from '@/student/WeekCalendar'

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export function ManagerView() {
  const { bookings, blocks } = useStore()
  const { user, room } = useLookups()
  const now = useNow()

  const pending = bookings.filter((b) => b.status === 'PENDING')
  const overdue = bookings.filter((b) => b.status === 'KEY_CHECKED_OUT' && new Date(b.end) < now)
  const today = bookings.filter((b) => sameDay(new Date(b.start), now) && ['APPROVED', 'KEY_CHECKED_OUT', 'COMPLETED'].includes(b.status))
  const keysOut = bookings.filter((b) => b.status === 'KEY_CHECKED_OUT').length
  const activeBlocks = blocks.filter((k) => k.active && new Date(k.end) > now).length

  return (
    <>
      <TopNav>
        <NavItem active onClick={() => scrollTo('ops')} badge={pending.length}>
          Operations
        </NavItem>
        <NavItem onClick={() => scrollTo('tracker')}>Key custody</NavItem>
        <NavItem onClick={() => scrollTo('blocks')}>Room blocks</NavItem>
      </TopNav>

      {overdue.length > 0 ? (
        <div className="border-b border-plum bg-plum text-paper">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5">
            <span className="flex items-center gap-2 rounded-sm bg-paper px-2 py-0.5 font-mono text-[12px] font-semibold text-plum">
              <TriangleAlert size={13} /> {overdue.length} KEY{overdue.length > 1 ? 'S' : ''} OVERDUE
            </span>
            <div className="flex flex-1 flex-wrap gap-x-5 gap-y-1">
              {overdue.map((b) => (
                <span key={b.id} className="font-mono text-[12px] text-white/85">
                  RM {room(b.roomId)?.code} · {user(b.userId)?.fullName} · {user(b.userId)?.studentCode} ·{' '}
                  <span className="text-tint">
                    +{fmtDuration(Math.max(1, Math.round((+now - +new Date(b.end)) / 60000)))} past {fmtTime(b.end)}
                  </span>
                </span>
              ))}
            </div>
            <button onClick={() => scrollTo('tracker')} className="flex items-center gap-1 text-[13px] font-semibold text-paper underline-offset-4 hover:underline">
              Open key tracker <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="border-b border-rule bg-ice">
          <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-6 py-2 font-mono text-[12px] text-accent">
            <span className="h-1.5 w-1.5 bg-accent" /> ALL KEYS ACCOUNTED FOR · {fmtTime(now)}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1440px] px-6 pt-10">
        <PageHeader
          eyebrow={`FACILITIES DESK · ${fmtDate(now)}`}
          title="Operations desk"
          body="Review requests directly on the master calendar, hand over physical keys against Student ID, and reserve rooms for university events."
          right={
            <Reveal stagger className="grid grid-cols-2 border-t border-l border-rule sm:grid-cols-4">
              {[
                ['PENDING', pending.length, ''],
                ['TODAY', today.length, ''],
                ['KEYS OUT', keysOut, ''],
                ['OVERDUE', overdue.length, overdue.length ? 'text-plum' : ''],
              ].map(([k, v, c]) => (
                <div key={k as string} className="min-w-[110px] border-r border-b border-rule px-4 py-3">
                  <div className="font-mono text-[11px] text-steel">{k}</div>
                  <div className={cx('mt-1 font-display text-[32px] leading-none font-w450', c as string)}>{String(v).padStart(2, '0')}</div>
                </div>
              ))}
            </Reveal>
          }
        />

        <Reveal stagger id="ops" className="mt-10 grid scroll-mt-24 gap-8 2xl:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] xl:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]">
          <MasterCalendar />
          <KeyTracker today={today} now={now} />
        </Reveal>

        <BlockPanel activeCount={activeBlocks} />
      </main>
    </>
  )
}

function ColumnHead({ n, title, meta }: { n: string; title: string; meta?: React.ReactNode }) {
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

/* ───────────── 01 · Master calendar ───────────── */

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
            QUEUE CLEAR
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

function MasterCalendar() {
  const { rooms, bookings, blocks, settings, currentUser, notify } = useStore()
  const { user, room: roomOf } = useLookups()
  const firstPending = useMemo(
    () => bookings.filter((b) => b.status === 'PENDING').sort((a, b) => +new Date(a.start) - +new Date(b.start))[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [roomId, setRoomId] = useState(firstPending?.roomId ?? rooms[0]?.id ?? '')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(firstPending ? new Date(firstPending.start) : new Date()))
  const [review, setReview] = useState<{ id: string; el: HTMLElement } | null>(null)
  // Open the review popover on the earliest pending request when the desk loads
  const [jumpTo, setJumpTo] = useState<string | null>(firstPending?.id ?? null)
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0]

  const pending = bookings.filter((b) => b.status === 'PENDING').sort((a, b) => +new Date(a.start) - +new Date(b.start))
  const weekEnd = addDays(weekStart, 7)
  const pendingThisWeek = pending.filter((b) => b.roomId === room?.id && new Date(b.start) >= weekStart && new Date(b.start) < weekEnd).length

  // After jumping to a pending request from the index, anchor the popover to its block.
  useEffect(() => {
    if (!jumpTo) return
    const el = document.querySelector<HTMLElement>(`[data-booking-id="${jumpTo}"]`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setTimeout(() => setReview({ id: jumpTo, el }), 350)
    }
    setJumpTo(null)
  }, [jumpTo, roomId, weekStart])

  if (!room || !currentUser) return null
  const reviewing = review ? bookings.find((b) => b.id === review.id) : undefined

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <ColumnHead
        n="01 / MASTER CALENDAR · APPROVAL QUEUE"
        title="Room schedule"
        meta={<span className="font-mono text-[12px] text-steel">{pending.length} PENDING · CLICK A PEND BLOCK TO REVIEW</span>}
      />

      {/* Pending index */}
      <PendingQueueCarousel
        pending={pending}
        roomOf={roomOf}
        user={user}
        reviewId={review?.id}
        onSelectItem={(b) => {
          setRoomId(b.roomId)
          setWeekStart(startOfWeek(new Date(b.start)))
          setReview(null)
          setJumpTo(b.id)
        }}
      />

      <div>
        <RoomTabs
          rooms={rooms}
          activeId={room.id}
          onChange={(id) => {
            setRoomId(id)
            setReview(null)
          }}
          badge={(id) => pending.filter((b) => b.roomId === id).length}
        />
        <div className="rounded-lg rounded-tl-none border border-ink bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" className="!rounded-md !p-1.5" aria-label="Previous week" onClick={() => (setReview(null), setWeekStart((w) => addDays(w, -7)))}>
                <ChevronLeft size={16} />
              </Button>
              <Button variant="outline" className="!rounded-md !p-1.5" aria-label="Next week" onClick={() => (setReview(null), setWeekStart((w) => addDays(w, 7)))}>
                <ChevronRight size={16} />
              </Button>
              <Button variant="ghost" size="xs" className="!rounded-md" onClick={() => (setReview(null), setWeekStart(startOfWeek(new Date())))}>
                This week
              </Button>
              <div className="ml-2 font-mono text-[13px] font-semibold text-ink">
                {fmtShort(weekStart)} — {fmtShort(addDays(weekStart, 6))}
              </div>
              {pendingThisWeek > 0 && <Tag className="ml-1 !border-dashed !border-ink">{pendingThisWeek} TO REVIEW</Tag>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-graphite">
              <Legend swatch="border border-dashed border-ink bg-paper" label="Pending" />
              <Legend swatch="border border-ink bg-ink" label="Approved" />
              <Legend swatch="border border-accent bg-accent" label="Key out" />
              <Legend swatch="hatch-slate border border-ink" label="Event block" />
            </div>
          </div>
          <div className="scrollbar-thin overflow-x-auto">
            <div className="min-w-[820px]">
              <WeekCalendar
                mode="manager"
                room={room}
                weekStart={weekStart}
                bookings={bookings}
                blocks={blocks}
                settings={settings}
                currentUserId={currentUser.id}
                selection={null}
                onSelect={() => {}}
                onReject={(m) => notify(m, 'error')}
                who={(id) => {
                  const u = user(id)
                  return u ? { name: u.fullName, code: u.studentCode } : undefined
                }}
                onEventClick={(b, el) => setReview(review?.id === b.id ? null : { id: b.id, el })}
                activeId={review?.id}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-rule px-4 py-2.5 font-mono text-[11px] text-steel">
            <span className="h-2 w-2 border border-dashed border-ink bg-ice" />
            VIEW-ONLY SCHEDULE · CLICK A DASHED PENDING BLOCK TO REVIEW &amp; APPROVE · ROOM BLOCKS ARE CREATED IN 03 BELOW
          </div>
        </div>
      </div>

      {review && reviewing && <ReviewPopover booking={reviewing} anchor={review.el} onClose={() => setReview(null)} />}
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

/* Popover anchored to a calendar block */
function ReviewPopover({ booking: b, anchor, onClose }: { booking: Booking; anchor: HTMLElement; onClose: () => void }) {
  const { approveBooking, rejectBooking, bookings, blocks } = useStore()
  const { user, room } = useLookups()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; side: 'left' | 'right'; arrowTop: number } | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const u = user(b.userId)
  const r = room(b.roomId)
  const isPending = b.status === 'PENDING'
  const conflict =
    bookings.some((x) => x.id !== b.id && x.roomId === b.roomId && ['APPROVED', 'KEY_CHECKED_OUT'].includes(x.status) && overlaps(x.start, x.end, b.start, b.end)) ||
    blocks.some((k) => k.active && k.roomId === b.roomId && overlaps(k.start, k.end, b.start, b.end))

  useEffect(() => {
    setNote('')
    setError(null)
  }, [b.id])

  useLayoutEffect(() => {
    const place = () => {
      if (!anchor.isConnected) return onClose()
      const a = anchor.getBoundingClientRect()
      const w = 360
      const h = ref.current?.offsetHeight ?? 420
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
    // re-anchor after any reveal transition settles the block's final position
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

  // Portalled so ancestor reveal transforms never offset this fixed popover
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Review booking ${b.id}`}
      className="fixed z-50 w-[360px] rounded-lg border border-ink bg-paper shadow-nav"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      {pos && (
        <span
          className={cx('absolute h-3 w-3 rotate-45 border-ink bg-paper', pos.side === 'right' ? '-left-[7px] border-b border-l' : '-right-[7px] border-t border-r')}
          style={{ top: pos.arrowTop }}
        />
      )}
      <div className="flex items-start justify-between gap-3 border-b border-rule px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Eyebrow className="!text-[12px]">REVIEW · {b.id}</Eyebrow>
          </div>
          <div className="font-display text-feature leading-tight font-w450 text-ink">{b.title}</div>
        </div>
        <button onClick={onClose} aria-label="Close" className="-mr-1.5 rounded-md p-1 text-steel hover:bg-ice hover:text-ink">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={b.status} />
          <span className="font-mono text-[12px] font-semibold">RM {r?.code}</span>
          <span className="font-mono text-[12px] text-graphite">
            {fmtDate(b.start)} · {fmtRange(b.start, b.end)} · {fmtDuration(durationMin(b.start, b.end))}
          </span>
          {conflict && isPending && <Tag tone="plum">CONFLICT</Tag>}
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-3 border border-rule bg-ice px-3 py-2.5">
          <div className="min-w-0">
            <div className="font-mono text-[10px] text-steel">STUDENT</div>
            <div className="truncate text-[15px] font-semibold text-ink">{u?.fullName}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-steel">STUDENT ID</div>
            <div className="font-mono text-[14px] font-semibold text-meta">{u?.studentCode ?? '—'}</div>
          </div>
          <div className="col-span-2 flex flex-col gap-1 border-t border-dashed border-edge pt-2 text-[12px] text-graphite">
            <span className="flex items-center gap-2">
              <Phone size={12} className="text-steel" />
              <span className="font-mono font-semibold text-ink">{b.phone}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <Mail size={12} className="shrink-0 text-steel" />
              <span className="truncate">{u?.email}</span>
            </span>
          </div>
        </div>

        <div>
          <div className="font-mono text-[10px] text-steel">PURPOSE</div>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-graphite">{b.purpose}</p>
        </div>

        {isPending ? (
          <Field label="Review note / comment" hint="required to reject" error={error}>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setError(null)
              }}
              placeholder="Review note / comment — optional to approve, required to reject"
              className="!rounded-none text-[13px]"
            />
          </Field>
        ) : (
          b.note && (
            <div className="border-l-2 border-accent bg-ice px-2 py-1 text-[12px] text-graphite">
              <span className="font-mono text-[10px] font-semibold">NOTE · </span>
              {b.note}
            </div>
          )
        )}
      </div>

      {isPending ? (
        <div className="grid grid-cols-2 gap-2 border-t border-rule px-5 py-3">
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
            onClick={() => {
              approveBooking(b.id, note)
              onClose()
            }}
          >
            <Check size={14} /> Approve
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-t border-rule px-5 py-3">
          <span className="font-mono text-[11px] text-steel">{b.status === 'APPROVED' || b.status === 'KEY_CHECKED_OUT' ? 'MANAGE KEY IN TRACKER →' : 'READ-ONLY ENTRY'}</span>
          <Button variant="outline" size="xs" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
    ,
    document.body,
  )
}

/* ───────────── 02 · Key tracker ───────────── */

function KeyTracker({ today, now }: { today: Booking[]; now: Date }) {
  const { checkoutKey, returnKey } = useStore()
  const { user, room } = useLookups()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toUpperCase()
    return today
      .filter((b) => {
        if (!s) return true
        const u = user(b.userId)
        return u?.studentCode?.includes(s) || u?.fullName.toUpperCase().includes(s)
      })
      .sort((a, b) => {
        const rank = (x: Booking) => (x.status === 'KEY_CHECKED_OUT' && new Date(x.end) < now ? 0 : x.status === 'COMPLETED' ? 2 : 1)
        return rank(a) - rank(b) || +new Date(a.start) - +new Date(b.start)
      })
  }, [today, q, user, now])

  return (
    <section id="tracker" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
      <ColumnHead
        n="02 / TODAY'S KEY TRACKER"
        title="Key custody"
        meta={
          <span className="flex items-center gap-2 font-mono text-[12px] text-accent">
            <span className="h-1.5 w-1.5 animate-pulse bg-accent" /> LIVE · {fmtTime(now)}
          </span>
        }
      />
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-steel" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by Student ID or Student Name — e.g. SE184022" className="pl-9" />
      </div>
      <div className="overflow-hidden rounded-lg border border-edge">
        <div className="grid grid-cols-[76px_1fr] border-b border-ink bg-ice font-mono text-[11px] font-semibold text-steel">
          <span className="border-r border-rule px-3 py-2">TIME</span>
          <span className="px-4 py-2">STUDENT · STATUS · KEY</span>
        </div>
        {list.length === 0 ? (
          <div className="p-4">
            <EmptyState title="NO MATCH" body="No bookings today match this search." />
          </div>
        ) : (
          list.map((b) => {
            const u = user(b.userId)
            const late = b.status === 'KEY_CHECKED_OUT' && new Date(b.end) < now
            return (
              <div key={b.id} className={cx('grid grid-cols-[76px_1fr] border-b border-rule last:border-0', late && 'bg-plum/[0.05]', b.status === 'COMPLETED' && 'bg-ice/50')}>
                <div className={cx('flex flex-col gap-0.5 border-r px-3 py-3', late ? 'border-l-[3px] border-plum' : 'border-rule')}>
                  <span className="font-mono text-[14px] font-semibold">{fmtTime(b.start)}</span>
                  <span className="font-mono text-[11px] text-steel">→ {fmtTime(b.end)}</span>
                  <span className="mt-1 font-mono text-[11px] font-semibold text-meta">RM {room(b.roomId)?.code}</span>
                </div>
                <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[14px] font-medium">{u?.fullName}</span>
                    <span className="font-mono text-[12px] font-semibold text-graphite">{u?.studentCode}</span>
                    <StatusChip status={b.status} className="ml-auto" />
                  </div>
                  {(late || (b.status === 'COMPLETED' && b.returnedAt) || (b.status === 'KEY_CHECKED_OUT' && b.checkedOutAt)) && (
                    <div className="flex flex-wrap gap-3 font-mono text-[11px]">
                      {b.status === 'KEY_CHECKED_OUT' && b.checkedOutAt && <span className="text-steel">OUT {fmtTime(b.checkedOutAt)}</span>}
                      {late && <span className="font-semibold text-plum">OVERDUE +{fmtDuration(Math.round((+now - +new Date(b.end)) / 60000))}</span>}
                      {b.status === 'COMPLETED' && b.returnedAt && <span className="text-steel">RETURNED {fmtTime(b.returnedAt)}</span>}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="xs" variant={b.status === 'APPROVED' ? 'dark' : 'outline'} disabled={b.status !== 'APPROVED'} onClick={() => checkoutKey(b.id)}>
                      <KeyRound size={12} /> Checkout key
                    </Button>
                    <Button
                      size="xs"
                      variant={b.status === 'KEY_CHECKED_OUT' ? (late ? 'dark' : 'accent') : 'outline'}
                      className={late ? '!border-plum !bg-plum' : ''}
                      disabled={b.status !== 'KEY_CHECKED_OUT'}
                      onClick={() => returnKey(b.id)}
                    >
                      <Undo2 size={12} /> Return key
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
      <p className="font-mono text-[11px] leading-[1.5] text-steel">VERIFY THE PHYSICAL STUDENT ID CARD BEFORE ISSUING ANY KEY.</p>
    </section>
  )
}

/* ───────────── 03 · Room blocks ───────────── */

function BlockPanel({ activeCount }: { activeCount: number }) {
  const { rooms, blocks, bookings, createBlock, cancelBlock } = useStore()
  const { room, user } = useLookups()
  const tomorrow = addDays(startOfDay(new Date()), 1)
  const [form, setForm] = useState(() => ({
    roomId: rooms[0]?.id ?? '',
    start: toLocalInput(new Date(tomorrow.getTime() + 9 * 3600000)),
    end: toLocalInput(new Date(tomorrow.getTime() + 12 * 3600000)),
    reason: '',
  }))
  const [error, setError] = useState<string | null>(null)


  const s = new Date(form.start)
  const e = new Date(form.end)
  const valid = !isNaN(+s) && !isNaN(+e) && e > s
  const displaced = valid ? bookings.filter((b) => b.roomId === form.roomId && (b.status === 'PENDING' || b.status === 'APPROVED') && overlaps(b.start, b.end, s, e)) : []
  const sorted = [...blocks].sort((a, b) => Number(b.active) - Number(a.active) || +new Date(a.start) - +new Date(b.start))

  return (
    <section id="blocks" className="mt-16 scroll-mt-24">
      <ColumnHead n="03 / ROOM BLOCKS" title="Room blocks & university event priority" meta={<span className="font-mono text-[12px] text-steel">{activeCount} ACTIVE BLOCKS</span>} />
      <Reveal stagger className="mt-6 grid gap-6 lg:grid-cols-[440px_1fr]">
        <form
          className="flex flex-col gap-4 rounded-lg bg-ink p-6 text-paper"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (!valid) return setError('Enter a valid start and end.')
            const err = createBlock({ roomId: form.roomId, start: s, end: e, reason: form.reason })
            setError(err)
            if (!err) {
              setForm((f) => ({ ...f, reason: '' }))
            }
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <Eyebrow tone="paper">NEW BLOCK · OVERRIDES STUDENT BOOKINGS</Eyebrow>
          </div>
          <h3 className="font-display text-feature font-w450">
            <SplitText text="Reserve a room for a university event" />
          </h3>
          <div>
            <div className="mb-1.5 font-mono text-[12px] font-semibold text-white/70 uppercase">Room</div>
            <div className="grid grid-cols-3 gap-1 rounded-md border border-white/20 p-1">
              {rooms.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setForm((f) => ({ ...f, roomId: r.id }))}
                  className={cx('rounded-sm py-1.5 font-mono text-[13px] font-semibold transition-colors', form.roomId === r.id ? 'bg-accent text-paper' : 'text-white/80 hover:bg-white/10')}
                >
                  {r.code}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 [&_label>span_span]:!text-white/70">
            <Field label="Start · date & time">
              <Input type="datetime-local" step={1800} value={form.start} onChange={(ev) => setForm((f) => ({ ...f, start: ev.target.value }))} className="border-transparent font-mono !text-[13px]" />
            </Field>
            <Field label="End · date & time">
              <Input type="datetime-local" step={1800} value={form.end} onChange={(ev) => setForm((f) => ({ ...f, end: ev.target.value }))} className="border-transparent font-mono !text-[13px]" />
            </Field>
          </div>
          <div className="font-mono text-[12px] text-white/70">LENGTH · <span className="font-semibold text-paper">{valid ? fmtDuration(durationMin(s, e)) : '—'}</span></div>
          <Field label="Event reason" className="[&_label>span_span]:!text-white/70 [&>span_span]:!text-white/70">
            <Input value={form.reason} onChange={(ev) => setForm((f) => ({ ...f, reason: ev.target.value }))} placeholder="e.g. Graduation rehearsal" className="border-transparent" />
          </Field>
          {displaced.length > 0 && (
            <div className="flex gap-2 border border-white/25 px-3 py-2 text-[12px] leading-[1.5] text-white/85">
              <TriangleAlert size={14} className="mt-0.5 shrink-0 text-tint" />
              <span>
                Event priority will displace <b className="font-semibold text-paper">{displaced.length}</b> booking(s):{' '}
                {displaced.map((d) => `${user(d.userId)?.studentCode} ${fmtRange(d.start, d.end)}`).join(', ')}
              </span>
            </div>
          )}
          {error && <div className="bg-paper px-3 py-2 text-[13px] font-medium text-plum">{error}</div>}
          <Button type="submit" size="md" variant="tint" className="mt-1">
            <Ban size={15} /> Block room {room(form.roomId)?.code} <ArrowRight size={15} />
          </Button>
        </form>

        <div className="self-start overflow-hidden rounded-lg border border-edge">
          <div className="grid grid-cols-[70px_1fr_170px_110px] gap-3 border-b border-ink bg-ice px-4 py-2 font-mono text-[11px] font-semibold text-steel max-md:hidden">
            <span>ROOM</span>
            <span>REASON</span>
            <span>WINDOW</span>
            <span className="text-right">ACTION</span>
          </div>
          {sorted.length === 0 && (
            <div className="p-4">
              <EmptyState title="NO BLOCKS" />
            </div>
          )}
          {sorted.map((k) => {
            const multi = !sameDay(new Date(k.start), new Date(k.end))
            return (
              <div
                key={k.id}
                className={cx('grid grid-cols-[70px_1fr_170px_110px] items-center gap-3 border-b border-rule px-4 py-3 last:border-0 max-md:grid-cols-[60px_1fr]', !k.active && 'hatch opacity-60')}
              >
                <span className="font-display text-[24px] leading-none font-w450">{room(k.roomId)?.code}</span>
                <div className="min-w-0">
                  <div className={cx('truncate text-[14px] font-medium', !k.active && 'line-through')}>{k.reason}</div>
                  <div className="font-mono text-[11px] text-steel">
                    {k.id} · BY {user(k.createdBy)?.fullName.toUpperCase() ?? k.createdBy}
                  </div>
                </div>
                <div className="font-mono text-[12px] max-md:col-start-2">
                  <div className="font-semibold">{multi ? `${fmtShort(k.start)} → ${fmtShort(k.end)}` : fmtDate(k.start)}</div>
                  <div className="text-graphite">{fmtRange(k.start, k.end)}</div>
                </div>
                <div className="text-right max-md:col-start-2 max-md:text-left">
                  {k.active ? (
                    <Button size="xs" variant="plum" onClick={() => cancelBlock(k.id)}>
                      Cancel block
                    </Button>
                  ) : (
                    <Tag>CANCELLED</Tag>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Reveal>
    </section>
  )
}
