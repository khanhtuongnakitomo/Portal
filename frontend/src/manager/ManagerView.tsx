import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Ban,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  KeyRound,
  Phone,
  Plus,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { parseBookingMembers, type Booking, type RoomBlock } from '@/lib/types'
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
import { Reveal } from '@/components/effects'
import { WeekCalendar, extractEventBadge, isOfficialEvent } from '@/student/WeekCalendar'
import { AssignActivityModal, type AssignModalInitial } from './AssignActivityModal'
import { ApprovalBoard } from './ApprovalBoard'
import { KeyCustodyDesk } from './KeyCustodyDesk'
import { BlockInspectorModal } from './BlockInspectorModal'
import { QUICK_REJECT_REASONS } from './types'

export type ManagerTab = 'calendar' | 'approvals' | 'keys'

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
  const { locale } = useI18n()
  const vi = locale === 'vi'
  const now = useNow()

  const [tab, setTab] = useState<ManagerTab>('calendar')

  const pending = bookings.filter((b) => b.status === 'PENDING')
  const today = bookings.filter(
    (b) => sameDay(new Date(b.start), now) && ['APPROVED', 'COMPLETED', 'KEY_CHECKED_OUT'].includes(b.status),
  )
  const keysOut = bookings.filter((b) => b.status === 'KEY_CHECKED_OUT')
  const overdueKeys = keysOut.filter((b) => now > new Date(b.end))
  const activeBlocks = blocks.filter((k) => k.active && new Date(k.end) > now).length

  const tabs: { id: ManagerTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'calendar',
      label: vi ? 'Lịch phòng' : 'Room Schedule',
      icon: <Calendar size={14} />,
    },
    {
      id: 'approvals',
      label: vi ? 'Duyệt yêu cầu' : 'Approvals',
      icon: <ClipboardCheck size={14} />,
      badge: pending.length,
    },
    {
      id: 'keys',
      label: vi ? 'Chìa khóa phòng' : 'Key Custody',
      icon: <KeyRound size={14} />,
      badge: overdueKeys.length > 0 ? overdueKeys.length : keysOut.length,
    },
  ]

  const headerCopy: Record<ManagerTab, { eyebrow: string; title: string; body: string }> = {
    calendar: {
      eyebrow: vi ? `QUẢN LÝ PHÒNG · ${fmtDate(now)}` : `MANAGER · ${fmtDate(now)}`,
      title: vi ? 'Lịch sử dụng phòng' : 'Room schedule',
      body: vi
        ? 'Theo dõi lịch các phòng 601, 602 và 605. Bấm hoặc kéo vào ô trống để thêm sự kiện hay khóa phòng.'
        : 'Monitor rooms 601, 602, and 605. Click or drag an open slot to assign an event or block a room.',
    },
    approvals: {
      eyebrow: vi ? `XÉT DUYỆT · ${fmtDate(now)}` : `APPROVALS · ${fmtDate(now)}`,
      title: vi ? 'Yêu cầu chờ phê duyệt' : 'Pending approvals',
      body: vi
        ? 'Kiểm tra và duyệt hoặc từ chối đơn đặt phòng của sinh viên.'
        : 'Review, approve, or decline pending student room booking requests.',
    },
    keys: {
      eyebrow: vi ? `CHÌA KHÓA · ${fmtDate(now)}` : `KEY CUSTODY · ${fmtDate(now)}`,
      title: vi ? 'Quản lý chìa khóa phòng' : 'Room key custody',
      body: vi
        ? 'Giao chìa cho đơn đã duyệt, theo dõi sinh viên đang giữ chìa và xác nhận khi trả.'
        : 'Issue keys for approved bookings, track active checkouts, and confirm returns.',
    },
  }

  const activeHeader = headerCopy[tab]

  return (
    <>
      <TopNav>
        <div className="flex items-center gap-1 rounded-md border border-rule/70 bg-ice/50 p-1 overflow-x-auto no-scrollbar max-w-full shrink">
          {tabs.map((item) => (
            <NavItem
              key={item.id}
              active={tab === item.id}
              onClick={() => setTab(item.id)}
              badge={item.badge}
              icon={item.icon}
            >
              {item.label}
            </NavItem>
          ))}
        </div>
      </TopNav>

      <main className="mx-auto max-w-[1440px] px-6 pt-8 pb-20">
        {/* Dynamic Page Header with Clickable KPI Cards */}
        <PageHeader
          eyebrow={activeHeader.eyebrow}
          title={activeHeader.title}
          body={activeHeader.body}
          right={
            <Reveal stagger className="grid grid-cols-2 border-t border-l border-rule sm:grid-cols-4">
              {[
                {
                  key: 'pending',
                  label: vi ? 'CHỜ DUYỆT' : 'PENDING',
                  value: pending.length,
                  accent: pending.length > 0 ? 'text-accent' : '',
                  target: 'approvals' as ManagerTab,
                  active: tab === 'approvals',
                },
                {
                  key: 'today',
                  label: vi ? 'HÔM NAY' : 'TODAY',
                  value: today.length,
                  accent: '',
                  target: 'calendar' as ManagerTab,
                  active: tab === 'calendar',
                },
                {
                  key: 'keys',
                  label: vi ? 'ĐANG GIỮ CHÌA' : 'KEYS OUT',
                  value: keysOut.length,
                  accent: overdueKeys.length > 0 ? 'text-plum' : '',
                  target: 'keys' as ManagerTab,
                  active: tab === 'keys',
                },
                {
                  key: 'blocks',
                  label: vi ? 'ĐANG KHÓA' : 'BLOCKED',
                  value: activeBlocks,
                  accent: '',
                  target: 'calendar' as ManagerTab,
                  active: false,
                },
              ].map((stat) => (
                <button
                  key={stat.key}
                  type="button"
                  onClick={() => setTab(stat.target)}
                  className={cx(
                    'min-w-[112px] border-r border-b border-rule px-4 py-3 text-left transition-colors cursor-pointer bg-paper hover:bg-ice/60',
                    stat.active && 'bg-ice/50',
                  )}
                >
                  <div className="font-mono text-[10.5px] text-steel">{stat.label}</div>
                  <div className={cx('mt-1 font-display text-[30px] leading-none font-w450', stat.accent)}>
                    {String(stat.value).padStart(2, '0')}
                  </div>
                </button>
              ))}
            </Reveal>
          }
        />

        {/* Mobile Tab Switcher (TopNav tabs hide below md) */}
        <div className="mt-5 flex items-center gap-1 rounded-md border border-rule bg-ice/50 p-1 md:hidden overflow-x-auto no-scrollbar">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cx(
                'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 font-mono text-[11.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer',
                tab === item.id
                  ? 'border border-ink bg-paper text-ink shadow-2xs'
                  : 'text-steel hover:text-ink',
              )}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="rounded-sm bg-accent px-1.5 py-0.2 text-[10px] font-bold text-paper">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Focused Single-Task Workspace */}
        <div className="mt-8">
          <OperationsWorkspace activeTab={tab} onTabChange={setTab} showInternalTabs={false} />
        </div>
      </main>
    </>
  )
}

/* ───────────── Reusable Operations Workspace ───────────── */

export interface OperationsWorkspaceProps {
  eyebrow?: string
  title?: string
  hideHeader?: boolean
  activeTab?: ManagerTab
  onTabChange?: (tab: ManagerTab) => void
  showInternalTabs?: boolean
}

export function OperationsWorkspace({
  activeTab: controlledTab,
  onTabChange,
  showInternalTabs = true,
}: OperationsWorkspaceProps = {}) {
  const { rooms, bookings, blocks, settings, currentUser, notify } = useStore()
  const { user, room: roomOf } = useLookups()
  const { locale } = useI18n()
  const vi = locale === 'vi'

  const [internalTab, setInternalTab] = useState<ManagerTab>('calendar')
  const currentTab = controlledTab ?? internalTab
  const setActiveTab = (next: ManagerTab) => {
    setInternalTab(next)
    onTabChange?.(next)
  }

  const [roomId, setRoomId] = useState<string>('ALL')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date>(() => getInitialWorkday())

  const [review, setReview] = useState<{ id: string; el: HTMLElement } | null>(null)
  const [jumpTo, setJumpTo] = useState<string | null>(null)
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
  const pending = bookings
    .filter((b) => b.status === 'PENDING')
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
  const keysOut = useMemo(() => bookings.filter((b) => b.status === 'KEY_CHECKED_OUT'), [bookings])
  const overdueKeys = useMemo(() => keysOut.filter((b) => new Date() > new Date(b.end)), [keysOut])
  const weekEnd = addDays(weekStart, 5)
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

  const handleInspectOnCalendar = (b: Booking) => {
    if (!isAllRooms) {
      setRoomId(b.roomId)
    }
    setWeekStart(startOfWeek(new Date(b.start)))
    setSelectedDay(startOfDay(new Date(b.start)))
    setReview(null)
    setActiveTab('calendar')
    setJumpTo(b.id)
  }

  // Wait until calendar tab is rendered before scrolling to and opening the inspected booking
  useEffect(() => {
    if (!jumpTo || currentTab !== 'calendar') return
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-booking-id="${jumpTo}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTimeout(() => setReview({ id: jumpTo, el }), 250)
      }
      setJumpTo(null)
    }, 80)
    return () => clearTimeout(timer)
  }, [jumpTo, roomId, weekStart, currentTab])

  if (!room || !currentUser) return null
  const reviewing = review ? bookings.find((b) => b.id === review.id) : undefined

  return (
    <section className="flex min-w-0 flex-col gap-5">
      {/* Clean Internal 3-Tab Switcher (used when embedded inside AdminView) */}
      {showInternalTabs && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-rule bg-ice/60 p-1 select-none">
            {[
              { id: 'calendar' as ManagerTab, label: vi ? 'Lịch phòng' : 'Room Schedule', icon: <Calendar size={14} /> },
              {
                id: 'approvals' as ManagerTab,
                label: vi ? 'Duyệt yêu cầu' : 'Approvals',
                icon: <ClipboardCheck size={14} />,
                badge: pending.length,
              },
              {
                id: 'keys' as ManagerTab,
                label: vi ? 'Chìa khóa phòng' : 'Key Custody',
                icon: <KeyRound size={14} />,
                badge: overdueKeys.length > 0 ? overdueKeys.length : keysOut.length,
                alert: overdueKeys.length > 0,
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-mono text-[12px] font-semibold transition-all cursor-pointer',
                  currentTab === item.id
                    ? 'border border-ink bg-paper text-ink shadow-2xs'
                    : 'text-steel hover:text-ink',
                )}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={cx(
                      'rounded-sm px-1.5 py-0.2 text-[10px] font-bold text-paper',
                      item.alert ? 'bg-plum' : 'bg-accent',
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {currentTab === 'calendar' && (
            <Button
              variant="accent"
              size="sm"
              onClick={() => handleOpenAssign({ roomId: isAllRooms ? rooms[0]?.id ?? '' : room.id, date: selectedDay })}
              className="gap-1.5 shadow-xs"
            >
              <Plus size={14} strokeWidth={2.5} /> {vi ? 'Thêm sự kiện / Khóa phòng' : 'Assign Event / Block'}
            </Button>
          )}
        </div>
      )}

      {/* ───────────── TAB 1: ROOM SCHEDULE & CALENDAR ───────────── */}
      {currentTab === 'calendar' && (
        <div>
          {/* Room Tabs + Single Primary Action */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <RoomTabs
                rooms={rooms}
                activeId={roomId}
                onChange={(id) => {
                  setRoomId(id)
                  setReview(null)
                }}
                badge={(id) => pending.filter((b) => b.roomId === id).length}
              />
            </div>

            {!showInternalTabs && (
              <div className="pb-2 shrink-0">
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() =>
                    handleOpenAssign({ roomId: isAllRooms ? rooms[0]?.id ?? '' : room.id, date: selectedDay })
                  }
                  className="gap-1.5 shadow-xs"
                >
                  <Plus size={14} strokeWidth={2.5} /> {vi ? 'Thêm sự kiện / Khóa phòng' : 'Assign Event / Block'}
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-lg rounded-tl-none border border-ink bg-paper">
            {/* Week Navigation Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3 bg-ice/30">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="!rounded-md !p-1.5"
                  aria-label={vi ? 'Tuần trước' : 'Previous week'}
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
                  aria-label={vi ? 'Tuần sau' : 'Next week'}
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
                  {vi ? 'Tuần này' : 'This week'}
                </Button>

                <div className="ml-1 font-mono text-[13px] font-semibold text-ink">
                  {fmtShort(weekStart)} — {fmtShort(addDays(weekStart, 4))} · {vi ? 'T2–T6' : 'MON–FRI'}
                </div>

                {pendingThisWeek > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('approvals')}
                    className="ml-1 cursor-pointer"
                    title={vi ? 'Mở danh sách chờ duyệt' : 'Open pending approvals'}
                  >
                    <Tag className="!border-dashed !border-plum !bg-plum/10 !text-plum hover:!bg-plum/20 transition-colors">
                      {vi ? `${pendingThisWeek} chờ duyệt` : `${pendingThisWeek} to review`}
                    </Tag>
                  </button>
                )}
              </div>

              {/* Clean Localized Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-graphite font-mono">
                {isAllRooms && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-accent shrink-0" />
                      <span className="font-semibold text-ink">601</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-slate shrink-0" />
                      <span className="font-semibold text-ink">602</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-plum shrink-0" />
                      <span className="font-semibold text-ink">605</span>
                    </div>
                    <span className="text-rule">|</span>
                  </>
                )}
                <Legend swatch="border border-ink bg-ink" label={vi ? 'Đã duyệt' : 'Approved'} />
                <Legend swatch="border border-dashed border-plum bg-plum/[0.08]" label={vi ? 'Chờ duyệt' : 'Pending'} />
                <Legend swatch="border-2 border-accent bg-paper" label={vi ? 'Sự kiện' : 'Event'} />
                <Legend swatch="hatch-slate border border-ink" label={vi ? 'Khóa phòng' : 'Blocked'} />
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

            {/* Short Friendly Bottom Hint */}
            <div className="flex items-center gap-2 border-t border-rule px-4 py-2.5 text-[12px] text-steel">
              <span className="h-2 w-2 rounded-sm bg-accent shrink-0" />
              <span>
                {vi
                  ? 'Bấm hoặc kéo chọn ô giờ trống để thêm sự kiện / khóa phòng · Bấm vào lịch đã có để xem chi tiết hoặc xử lý.'
                  : 'Click or drag any open slot to assign an event or block · Click any booking or block to inspect.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ───────────── TAB 2: PENDING APPROVALS ───────────── */}
      {currentTab === 'approvals' && (
        <ApprovalBoard pending={pending} onInspect={handleInspectOnCalendar} />
      )}

      {/* ───────────── TAB 3: ROOM KEY CUSTODY ───────────── */}
      {currentTab === 'keys' && (
        <KeyCustodyDesk onInspect={handleInspectOnCalendar} />
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
  const { approveBooking, rejectBooking, cancelBooking, checkoutKey, returnKey, bookings, blocks, notify } = useStore()
  const { user, room } = useLookups()
  const { t, locale } = useI18n()
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
      const w = 470
      const h = ref.current?.offsetHeight ?? 480
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
      className="fixed z-50 w-[470px] max-h-[calc(100vh-28px)] overflow-y-auto rounded-lg border border-ink bg-paper shadow-nav"
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
              <TriangleAlert size={12} /> {competingGroup.length} COMPETING REQUESTS FOR THIS WINDOW
            </span>
            <span className="font-mono text-[9px] text-steel">CLICK TO SWITCH</span>
          </div>

          <p className="mt-1 font-sans text-[11px] leading-tight text-graphite">
            Approving this request will automatically decline the other {competingGroup.length - 1} overlapping pending request(s).
          </p>

          <div className="mt-2 flex flex-col gap-1.5">
            {competingGroup.map((other, idx) => {
              const isCurrent = other.id === b.id
              const otherUser = user(other.userId)
              const isFirst = idx === 0
              return (
                <button
                  key={other.id}
                  type="button"
                  onClick={() => {
                    if (!isCurrent) onSwitchBooking?.(other.id)
                  }}
                  className={cx(
                    'flex items-center justify-between gap-2.5 rounded-[4px] px-3 py-2 text-left text-[11px] transition-colors',
                    isCurrent
                      ? 'border border-ink bg-ink text-paper font-semibold shadow-xs'
                      : 'border border-rule bg-paper text-ink hover:border-accent hover:bg-tint/30',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cx(
                        'shrink-0 rounded-[2px] px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-tight',
                        isFirst
                          ? (isCurrent ? 'bg-emerald-400 text-ink' : 'bg-emerald-600 text-white')
                          : (isCurrent ? 'bg-white/20 text-white' : 'bg-ice text-steel border border-rule'),
                      )}
                    >
                      {isFirst ? '1ST TO SUBMIT' : `QUEUE #${idx + 1}`}
                    </span>
                    <span className={cx('shrink-0 font-mono font-bold', isCurrent ? 'text-tint' : 'text-accent')}>
                      {otherUser?.studentCode ?? '—'}
                    </span>
                    <span className="truncate font-medium">{otherUser?.fullName}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                    <span className={cx(isFirst ? 'font-bold' : 'opacity-80')}>
                      Req: {fmtTime(other.createdAt)}
                    </span>
                    {isCurrent ? (
                      <span className="rounded-[2px] bg-paper px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink">
                        CURRENT
                      </span>
                    ) : (
                      <span className="rounded-[2px] border border-rule bg-ice px-1.5 py-0.5 font-mono text-[9px] text-steel">
                        SWITCH
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
            <div className="font-mono text-[13px] font-semibold text-meta">
              {u?.hcmutId || u?.utsId ? `HCMUT: ${u.hcmutId ?? '—'} · UTS: ${u.utsId ?? '—'}` : (u?.studentCode ?? '—')}
            </div>
          </div>
          {/* Participating Group Members Roster */}
          {(() => {
            const memberList = parseBookingMembers(b)
            if (memberList.length === 0) return null
            return (
              <div className="col-span-2 flex flex-col gap-1.5 border-t border-dashed border-edge pt-2.5">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="flex items-center gap-1.5 font-bold text-steel uppercase tracking-wider">
                    <Users size={12} /> Group Members ({memberList.length})
                  </span>
                  <span className="text-steel font-semibold">
                    Total Attendees: {b.attendeeCount ?? memberList.length + 1}
                  </span>
                </div>
                <div className="rounded-md border border-rule bg-paper divide-y divide-rule/60 overflow-hidden">
                  {memberList.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12px]">
                      <span className="font-medium text-ink flex items-center gap-2 truncate">
                        <span className="font-mono text-[10px] text-steel shrink-0">#{idx + 1}</span>
                        <span className="truncate">{m.name}</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {m.hcmutId && (
                          <span className="font-mono text-[10px] font-bold text-accent bg-tint/40 px-1.5 py-0.5 rounded-sm border border-accent/20">
                            HCMUT: {m.hcmutId}
                          </span>
                        )}
                        {m.utsId && (
                          <span className="font-mono text-[10px] font-bold text-ink bg-stone-100 px-1.5 py-0.5 rounded-sm border border-rule">
                            UTS: {m.utsId}
                          </span>
                        )}
                        {!m.hcmutId && !m.utsId && m.studentId && (
                          <span className="font-mono text-[11px] font-bold text-accent bg-tint/40 px-1.5 py-0.5 rounded-sm border border-accent/20">
                            {m.studentId}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          {b.phone && (
            <div className="col-span-2 flex flex-col gap-1 border-t border-dashed border-edge pt-2 text-[12px] text-graphite">
              <span className="flex items-center gap-2">
                <Phone size={12} className="text-steel" />
                <span className="font-mono font-semibold text-ink">{b.phone}</span>
              </span>
            </div>
          )}
          {/* Submission Timestamp & Priority Queue Position */}
          <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-edge pt-2.5 text-[12px]">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-steel">
              <Clock size={12} />
              <span className="font-semibold tracking-wider">SUBMITTED AT</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-[12px] font-bold text-ink">
                {fmtDate(b.createdAt)} · {fmtTime(b.createdAt)}
              </span>
              {competingGroup.length > 1 && (
                <span
                  className={cx(
                    'rounded-[2px] px-2 py-0.5 text-[10px] font-bold tracking-tight shrink-0',
                    competingGroup[0].id === b.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-plum/15 text-plum border border-plum/30',
                  )}
                >
                  {competingGroup[0].id === b.id
                    ? '1ST TO SUBMIT (PRIORITY)'
                    : `#${competingGroup.findIndex((x) => x.id === b.id) + 1} OF ${competingGroup.length} (SUBMITTED LATER)`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Purpose */}
        <div>
          <div className="font-mono text-[10px] text-steel">PURPOSE / SESSION NOTES</div>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-graphite">{b.purpose}</p>
        </div>

        {/* Trạng thái bàn giao chìa khóa phòng */}
        {b.status === 'KEY_CHECKED_OUT' && (
          <div className="rounded-md border border-ink bg-paper p-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-rule pb-2">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-accent">
                <KeyRound size={13} />
                <span>{t('key.notReturned').toUpperCase()}</span>
              </div>
              {new Date() > new Date(b.end) ? (
                <span className="flex items-center gap-1 rounded-sm bg-plum px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper animate-pulse">
                  <TriangleAlert size={10} /> {t('key.overdueBadge')}
                </span>
              ) : (
                <span className="font-mono text-[10px] text-steel">
                  {locale === 'vi' ? 'Hạn trả: trước' : 'Return due by'} {fmtTime(b.end)}
                </span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-steel">{t('key.issuedAt')}: </span>
                <span className="font-bold text-ink">{b.checkedOutAt ? fmtTime(b.checkedOutAt) : 'Logged'}</span>
              </div>
              <div>
                <span className="text-steel">{locale === 'vi' ? 'Người giữ chìa' : 'Key Holder'}: </span>
                <span className="font-bold text-ink truncate">{u?.fullName}</span>
              </div>
              <div className="col-span-2 text-[11px] text-graphite font-sans">
                {locale === 'vi' ? 'Sinh viên đã nhận chìa khóa vật lý tại phòng Manager và chưa trả lại. Bấm nút bên dưới khi sinh viên mang chìa trả.' : 'Student collected physical key at Manager Office and has not returned it yet. Confirm below once returned.'}
              </div>
            </div>
          </div>
        )}

        {b.status === 'COMPLETED' && (
          <div className="rounded-md border border-emerald-600/30 bg-emerald-50/50 p-2.5 text-[11px] font-mono">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <Check size={13} />
              <span>{t('key.returned').toUpperCase()}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-graphite text-[10px]">
              <span>{t('key.returnedAt')}: {b.returnedAt ? `${fmtDate(b.returnedAt)} · ${fmtTime(b.returnedAt)}` : 'On record'}</span>
              <span className="text-emerald-700 font-semibold">{locale === 'vi' ? 'Đã thu hồi chìa' : 'Custody Cleared'}</span>
            </div>
          </div>
        )}

        {b.status === 'APPROVED' && (
          <div className="rounded-md border border-rule bg-ice/40 p-2.5 text-[11px] font-mono">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-semibold text-graphite">
                <KeyRound size={12} className="text-steel" />
                <span>{locale === 'vi' ? 'Chìa khóa tại phòng Manager' : 'Key at Manager Office'}</span>
              </span>
              <span className="text-accent font-bold text-[10px]">{t('key.notIssued')}</span>
            </div>
          </div>
        )}

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
        <div className="flex items-center justify-end gap-3 border-t border-rule px-5 py-3 bg-ice/40">
          <Button
            variant="outline"
            className="shrink-0 gap-1.5 px-4 text-[13px] hover:!bg-plum hover:!text-paper hover:!shadow-none"
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
            className="flex-1 gap-1.5 justify-center px-4 font-semibold text-[13px]"
            onClick={() => {
              approveBooking(b.id, note)
              onClose()
            }}
          >
            <Check size={14} />{' '}
            {competingGroup.length > 1
              ? `Approve & Decline Other (${competingGroup.length - 1})`
              : 'Approve Request'}
          </Button>
        </div>
      ) : b.status === 'KEY_CHECKED_OUT' ? (
        <div className="flex items-center justify-between gap-2 border-t border-rule px-5 py-3 bg-ice/40">
          <Button
            variant="dark"
            className="gap-1.5 font-semibold text-[12px] !bg-emerald-600 hover:!bg-emerald-700 text-white"
            onClick={() => {
              returnKey(b.id)
              notify(locale === 'vi' ? `Đã nhận lại chìa khóa phòng RM ${r?.code ?? ''} từ sinh viên ${u?.fullName ?? ''}. Hoàn tất buổi mượn.` : `Key for Room ${r?.code ?? ''} confirmed returned by ${u?.fullName ?? 'Student'}.`)
              onClose()
            }}
          >
            <Check size={14} /> {t('key.confirmReturnBtn')}
          </Button>
          <Button variant="outline" size="xs" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      ) : b.status === 'APPROVED' ? (
        <div className="flex items-center justify-between gap-2 border-t border-rule px-5 py-3 bg-ice/40">
          <div className="flex items-center gap-2">
            <Button
              variant="dark"
              size="xs"
              className="gap-1.5 font-semibold text-[12px] !bg-accent hover:!bg-[#0043CE] text-white"
              onClick={() => {
                checkoutKey(b.id)
                notify(locale === 'vi' ? `Đã đưa chìa khóa phòng RM ${r?.code ?? ''} cho sinh viên ${u?.fullName ?? ''}.` : `Key for Room ${r?.code ?? ''} issued to ${u?.fullName ?? 'Student'}.`)
                onClose()
              }}
            >
              <KeyRound size={13} /> {t('key.issueKeyBtn')}
            </Button>
            {isEvent && (
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
            )}
          </div>
          <Button variant="outline" size="xs" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-t border-rule px-5 py-3 bg-ice/40">
          <span className="font-mono text-[11px] text-steel">
            {b.status === 'COMPLETED' ? 'SESSION COMPLETED · KEY RETURNED' : 'ENTRY RECORD'}
          </span>

          <Button variant="outline" size="xs" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>,
    document.body,
  )
}
