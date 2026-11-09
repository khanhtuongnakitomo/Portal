import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { parseBookingMembers, type Booking } from '@/lib/types'
import { durationMin, fmtDate, fmtDuration, fmtRange, fmtTime } from '@/lib/time'
import { Button, EmptyState, Eyebrow, Input, Tag, cx } from '@/components/ui'

interface KeyCustodyDeskProps {
  onInspect: (b: Booking) => void
}

// 3 clear key management states requested by user
type KeyTab = 'CHUA_TRA' | 'CHUA_DUA' | 'DA_TRA' | 'TAT_CA'

export function KeyCustodyDesk({ onInspect }: KeyCustodyDeskProps) {
  const { bookings, checkoutKey, returnKey, notify } = useStore()
  const { user, room } = useLookups()
  const { t, locale } = useI18n()

  const [activeTab, setActiveTab] = useState<KeyTab>('CHUA_TRA')
  const [filterRoom, setFilterRoom] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const now = new Date()

  // 1. Chưa trả chìa: Đã giao chìa khóa cho sinh viên, sinh viên đang giữ chìa chưa trả
  const keysOut = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'KEY_CHECKED_OUT')
      .sort((a, b) => new Date(a.end).getTime() - new Date(b.end).getTime())
  }, [bookings])

  // 2. Chưa đưa chìa: Đơn đặt phòng đã duyệt, chờ sinh viên qua phòng Manager lấy chìa
  const keysReady = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'APPROVED')
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [bookings])

  // 3. Đã trả chìa: Sinh viên đã mang chìa trả lại phòng Manager, Manager đã xác nhận
  const keysReturned = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'COMPLETED' && b.returnedAt)
      .sort((a, b) => new Date(b.returnedAt!).getTime() - new Date(a.returnedAt!).getTime())
      .slice(0, 30)
  }, [bookings])

  // 4. Tất cả các đơn liên quan đến chìa
  const allKeyBookings = useMemo(() => {
    return bookings
      .filter((b) => b.status === 'KEY_CHECKED_OUT' || b.status === 'APPROVED' || (b.status === 'COMPLETED' && b.returnedAt))
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
  }, [bookings])

  // Đếm số lượng chìa quá hạn (đã hết giờ mượn phòng nhưng sinh viên chưa mang chìa trả lại)
  const overdueCount = useMemo(() => {
    return keysOut.filter((b) => now > new Date(b.end)).length
  }, [keysOut, now])

  // Lọc theo tab hiện tại
  const currentTabItems = useMemo(() => {
    if (activeTab === 'CHUA_TRA') return keysOut
    if (activeTab === 'CHUA_DUA') return keysReady
    if (activeTab === 'DA_TRA') return keysReturned
    return allKeyBookings
  }, [activeTab, keysOut, keysReady, keysReturned, allKeyBookings])

  // Lọc theo phòng và tìm kiếm (tên, MSSV, SĐT)
  const filteredList = useMemo(() => {
    return currentTabItems.filter((b) => {
      if (filterRoom !== 'ALL' && b.roomId !== filterRoom) return false
      if (!searchQuery.trim()) return true

      const q = searchQuery.toLowerCase().trim()
      const u = user(b.userId)
      const r = room(b.roomId)
      const members = parseBookingMembers(b)

      const matchesUser =
        u?.fullName.toLowerCase().includes(q) ||
        u?.studentCode?.toLowerCase().includes(q) ||
        u?.hcmutId?.toLowerCase().includes(q) ||
        u?.utsId?.toLowerCase().includes(q) ||
        u?.email.toLowerCase().includes(q)

      const matchesPhone = b.phone?.toLowerCase().includes(q)
      const matchesRoom = r?.code.toLowerCase().includes(q) || r?.name.toLowerCase().includes(q)
      const matchesMembers = members.some(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.hcmutId?.toLowerCase().includes(q) ||
          m.utsId?.toLowerCase().includes(q) ||
          m.studentId?.toLowerCase().includes(q),
      )

      return matchesUser || matchesPhone || matchesRoom || matchesMembers
    })
  }, [currentTabItems, filterRoom, searchQuery, user, room])

  // Manager bàn giao chìa khóa cho sinh viên
  const handleIssueKey = (b: Booking) => {
    checkoutKey(b.id)
    const u = user(b.userId)
    const r = room(b.roomId)
    notify(
      locale === 'vi'
        ? `Đã đưa chìa khóa phòng RM ${r?.code ?? ''} cho sinh viên ${u?.fullName ?? ''}.`
        : `Issued room RM ${r?.code ?? ''} key to student ${u?.fullName ?? ''}.`,
    )
  }

  // Manager nhận lại chìa khóa từ sinh viên
  const handleReturnKey = (b: Booking) => {
    returnKey(b.id)
    const u = user(b.userId)
    const r = room(b.roomId)
    notify(
      locale === 'vi'
        ? `Đã nhận lại chìa khóa phòng RM ${r?.code ?? ''} từ sinh viên ${u?.fullName ?? ''}. Hoàn tất buổi mượn.`
        : `Received room RM ${r?.code ?? ''} key back from student ${u?.fullName ?? ''}. Reservation complete.`,
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink bg-paper p-4 shadow-nav">
      {/* Header and Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-ink text-paper">
            <KeyRound size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Eyebrow className="!text-[12px] !text-ink">{t('key.custodyTitle')}</Eyebrow>
              {overdueCount > 0 && (
                <span className="flex items-center gap-1 rounded-sm bg-plum px-1.5 py-0.5 font-mono text-[10px] font-bold text-paper animate-pulse">
                  <AlertTriangle size={11} /> {overdueCount} {t('key.overdueBadge')}
                </span>
              )}
            </div>
            <div className="font-mono text-[11px] text-steel">
              {t('key.custodySub')}
            </div>
          </div>
        </div>

        {/* 3 Status Summary Chips */}
        <div className="flex items-center gap-2">
          {/* Chưa trả (Đang mượn) */}
          <div
            onClick={() => setActiveTab('CHUA_TRA')}
            className={cx(
              'flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[11px] cursor-pointer transition-colors',
              activeTab === 'CHUA_TRA'
                ? 'border-accent bg-tint text-ink-blue font-bold shadow-xs'
                : 'border-rule bg-paper text-graphite hover:border-ink',
            )}
            title={t('key.notReturnedDesc')}
          >
            <span className="font-semibold">{t('key.notReturned')}:</span>
            <span className="font-bold text-accent">{keysOut.length}</span>
            {overdueCount > 0 && (
              <span className="rounded-sm bg-plum px-1 py-0.2 text-[9px] text-paper font-bold">
                {overdueCount} {t('key.overdueLate')}
              </span>
            )}
          </div>

          {/* Chưa đưa chìa (Chờ SV qua lấy) */}
          <div
            onClick={() => setActiveTab('CHUA_DUA')}
            className={cx(
              'flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[11px] cursor-pointer transition-colors',
              activeTab === 'CHUA_DUA'
                ? 'border-ink bg-ice text-ink font-bold shadow-xs'
                : 'border-rule bg-paper text-graphite hover:border-ink',
            )}
            title={t('key.notIssuedDesc')}
          >
            <span className="font-semibold">{t('key.notIssued')}:</span>
            <span className="font-bold text-ink">{keysReady.length}</span>
          </div>

          {/* Đã trả chìa */}
          <div
            onClick={() => setActiveTab('DA_TRA')}
            className={cx(
              'flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[11px] cursor-pointer transition-colors',
              activeTab === 'DA_TRA'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold shadow-xs'
                : 'border-rule bg-paper text-graphite hover:border-ink',
            )}
            title={t('key.returnedDesc')}
          >
            <span className="font-semibold">{t('key.returned')}:</span>
            <span className="font-bold text-emerald-700">{keysReturned.length}</span>
          </div>
        </div>
      </div>

      {/* 3-Step Simplified Workflow Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 rounded-md border border-rule bg-ice/50 p-3 text-[12px]">
        {/* Step 1: Chưa đưa chìa */}
        <div className="flex items-start gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-ink text-paper font-mono font-bold text-[10px]">
            1
          </span>
          <div>
            <div className="font-semibold text-ink text-[12px]">{t('key.step1Title')}</div>
            <p className="text-graphite text-[11px] leading-snug mt-0.5">
              {t('key.step1Desc')}
            </p>
          </div>
        </div>

        {/* Step 2: Chưa trả chìa */}
        <div className="flex items-start gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-accent text-paper font-mono font-bold text-[10px]">
            2
          </span>
          <div>
            <div className="font-semibold text-ink text-[12px]">{t('key.step2Title')}</div>
            <p className="text-graphite text-[11px] leading-snug mt-0.5">
              {t('key.step2Desc')}
            </p>
          </div>
        </div>

        {/* Step 3: Đã trả chìa */}
        <div className="flex items-start gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-emerald-600 text-paper font-mono font-bold text-[10px]">
            3
          </span>
          <div>
            <div className="font-semibold text-ink text-[12px]">{t('key.step3Title')}</div>
            <p className="text-graphite text-[11px] leading-snug mt-0.5">
              {t('key.step3Desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-rule/60 pb-3">
        {/* Desk Tabs */}
        <div className="flex flex-wrap items-center rounded-sm border border-rule bg-ice p-0.5">
          {/* Tab 1: Chưa trả (Đang mượn) */}
          <button
            type="button"
            onClick={() => setActiveTab('CHUA_TRA')}
            className={cx(
              'flex items-center gap-1.5 rounded-sm px-3 py-1 font-mono text-[11px] font-semibold transition-all cursor-pointer',
              activeTab === 'CHUA_TRA'
                ? 'border border-ink bg-paper text-ink shadow-xs'
                : 'text-steel hover:text-ink',
            )}
          >
            <KeyRound size={13} className={overdueCount > 0 ? 'text-plum' : 'text-accent'} />
            <span>{t('key.notReturned')} ({keysOut.length})</span>
            {overdueCount > 0 && (
              <span className="rounded-sm bg-plum px-1 py-0.2 font-mono text-[9px] font-bold text-paper">
                {overdueCount} {t('key.overdueLate')}
              </span>
            )}
          </button>

          {/* Tab 2: Chưa đưa chìa */}
          <button
            type="button"
            onClick={() => setActiveTab('CHUA_DUA')}
            className={cx(
              'flex items-center gap-1.5 rounded-sm px-3 py-1 font-mono text-[11px] font-semibold transition-all cursor-pointer',
              activeTab === 'CHUA_DUA'
                ? 'border border-ink bg-paper text-ink shadow-xs'
                : 'text-steel hover:text-ink',
            )}
          >
            <Clock size={13} />
            <span>{t('key.notIssued')} ({keysReady.length})</span>
          </button>

          {/* Tab 3: Đã trả chìa */}
          <button
            type="button"
            onClick={() => setActiveTab('DA_TRA')}
            className={cx(
              'flex items-center gap-1.5 rounded-sm px-3 py-1 font-mono text-[11px] font-semibold transition-all cursor-pointer',
              activeTab === 'DA_TRA'
                ? 'border border-ink bg-paper text-ink shadow-xs'
                : 'text-steel hover:text-ink',
            )}
          >
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>{t('key.returned')} ({keysReturned.length})</span>
          </button>

          {/* Tab 4: Tất cả */}
          <button
            type="button"
            onClick={() => setActiveTab('TAT_CA')}
            className={cx(
              'flex items-center gap-1.5 rounded-sm px-3 py-1 font-mono text-[11px] font-semibold transition-all cursor-pointer',
              activeTab === 'TAT_CA'
                ? 'border border-ink bg-paper text-ink shadow-xs'
                : 'text-steel hover:text-ink',
            )}
          >
            <span>{t('key.allKeys')} ({allKeyBookings.length})</span>
          </button>
        </div>

        {/* Room Filter & Quick Search */}
        <div className="flex items-center gap-2.5">
          {/* Room Pills */}
          <div className="flex items-center gap-1 select-none">
            <span className="font-mono text-[10px] text-steel">
              {t('key.roomFilter')}
            </span>
            {['ALL', 'room_601', 'room_602', 'room_605'].map((rId) => {
              const label =
                rId === 'ALL'
                  ? 'ALL'
                  : rId === 'room_601'
                    ? '601'
                    : rId === 'room_602'
                      ? '602'
                      : '605'
              return (
                <button
                  key={rId}
                  type="button"
                  onClick={() => setFilterRoom(rId)}
                  className={cx(
                    'rounded-sm px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors cursor-pointer select-none',
                    filterRoom === rId
                      ? 'bg-ink text-paper'
                      : 'border border-rule bg-paper text-graphite hover:border-ink',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Quick Search */}
          <div className="relative w-48 sm:w-56">
            <Input
              type="text"
              placeholder={t('key.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="!h-7 text-[11px] pl-6 pr-6 font-mono"
            />
            <Search size={11} className="absolute left-2 top-2 text-steel pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1.5 p-0.5 text-steel hover:text-ink cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="flex flex-col gap-2.5">
        {filteredList.length === 0 ? (
          <EmptyState
            title={
              activeTab === 'CHUA_TRA'
                ? t('key.noKeysOut')
                : activeTab === 'CHUA_DUA'
                  ? t('key.noKeysReady')
                  : activeTab === 'DA_TRA'
                    ? t('key.noKeysReturned')
                    : (locale === 'vi' ? 'Không tìm thấy dữ liệu' : 'No records found')
            }
            body={
              activeTab === 'CHUA_TRA'
                ? t('key.noKeysOutSub')
                : t('key.emptyKeyList')
            }
          />
        ) : (
          filteredList.map((b) => {
            const u = user(b.userId)
            const r = room(b.roomId)
            const members = parseBookingMembers(b)
            const isOut = b.status === 'KEY_CHECKED_OUT'
            const isOverdue = isOut && now > new Date(b.end)
            const remainingMinutes = Math.round((new Date(b.end).getTime() - now.getTime()) / 60000)
            const overdueMinutes = Math.max(0, -remainingMinutes)

            // Room accent color token
            const roomCode = r?.code ?? '601'
            const roomAccentClass =
              roomCode === '601'
                ? 'bg-accent text-paper'
                : roomCode === '602'
                  ? 'bg-slate text-paper'
                  : 'bg-plum text-paper'

            return (
              <div
                key={b.id}
                className={cx(
                  'rounded-md border p-3.5 transition-all',
                  isOverdue
                    ? 'border-plum bg-plum/[0.04] shadow-xs'
                    : isOut
                      ? 'border-ink bg-paper shadow-xs'
                      : b.status === 'APPROVED'
                        ? 'border-rule bg-ice/30'
                        : 'border-rule bg-paper',
                )}
              >
                <div className="flex flex-col gap-3">
                  {/* Top Bar: Room + Status + Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cx(
                          'rounded-sm px-2 py-0.5 font-mono text-[11px] font-bold tracking-tight',
                          roomAccentClass,
                        )}
                      >
                        RM {r?.code}
                      </span>
                      <span className="font-semibold text-ink text-[13px]">{r?.name}</span>

                      {/* Explicit Key Status Badges */}
                      {isOverdue ? (
                        <span className="flex items-center gap-1 rounded-sm bg-plum px-2 py-0.5 font-mono text-[10px] font-bold text-paper animate-pulse">
                          <AlertTriangle size={11} /> {t('key.overdueBadge')} · {t('key.overdueLate')} +{overdueMinutes} {locale === 'vi' ? 'phút' : 'min'}
                        </span>
                      ) : isOut ? (
                        <span className="flex items-center gap-1 rounded-sm bg-accent px-2 py-0.5 font-mono text-[10px] font-bold text-paper">
                          <KeyRound size={11} /> {t('key.notReturned')} ({remainingMinutes} {locale === 'vi' ? 'phút còn lại' : 'min left'})
                        </span>
                      ) : b.status === 'APPROVED' ? (
                        <span className="flex items-center gap-1 rounded-sm border border-rule bg-ice px-2 py-0.5 font-mono text-[10px] font-bold text-graphite">
                          <Clock size={11} /> {t('key.notIssued')} · {locale === 'vi' ? 'Chờ SV qua phòng Manager lấy' : 'Pickup at Manager Office'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-sm bg-emerald-600 px-2 py-0.5 font-mono text-[10px] font-bold text-paper">
                          <CheckCircle2 size={11} /> {t('key.returned')} ({locale === 'vi' ? 'Tại phòng Manager' : 'Manager Office'})
                        </span>
                      )}
                    </div>

                    {/* Primary Key Action Buttons */}
                    <div className="flex items-center gap-2">
                      {/* State 1: Chưa đưa chìa -> Manager bấm ĐÃ ĐƯA CHÌA */}
                      {b.status === 'APPROVED' && (
                        <Button
                          variant="dark"
                          size="xs"
                          onClick={() => handleIssueKey(b)}
                          className="gap-1.5 font-semibold text-[11px] !bg-accent hover:!bg-[#0043CE] text-white"
                        >
                          <KeyRound size={13} />
                          {t('key.issueKeyBtn')}
                        </Button>
                      )}

                      {/* State 2: Chưa trả chìa -> Manager bấm XÁC NHẬN ĐÃ TRẢ CHÌA */}
                      {isOut && (
                        <Button
                          variant="dark"
                          size="xs"
                          onClick={() => handleReturnKey(b)}
                          className="gap-1.5 font-semibold text-[11px] !bg-emerald-600 hover:!bg-emerald-700 text-white"
                        >
                          <CheckCircle2 size={13} />
                          {t('key.confirmReturnBtn')}
                        </Button>
                      )}

                      {/* Xem chi tiết trên lịch */}
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => onInspect(b)}
                        className="gap-1 text-[11px]"
                      >
                        {t('key.inspectBtn')}
                      </Button>
                    </div>
                  </div>

                  {/* Main Grid: Student Accountability & Tracing Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border border-rule bg-paper p-3 text-[12px]">
                    {/* Column 1: Sinh viên chịu trách nhiệm mượn chìa */}
                    <div className="flex flex-col gap-1 min-w-0 border-b md:border-b-0 md:border-r border-rule pb-2 md:pb-0 md:pr-3">
                      <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-steel uppercase tracking-wider">
                        <UserCheck size={11} /> {t('key.responsibleStudent')}
                      </div>
                      <div className="font-semibold text-ink text-[14px] truncate">{u?.fullName}</div>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="font-bold text-ink">HCMUT: {u?.hcmutId ?? '—'}</span>
                        <span className="text-steel">·</span>
                        <span className="font-bold text-accent">UTS: {u?.utsId ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-3 pt-1 text-[11px]">
                        {b.phone ? (
                          <a
                            href={`tel:${b.phone}`}
                            className="flex items-center gap-1 font-mono font-bold text-accent hover:underline"
                            title="Call student"
                          >
                            <Phone size={11} />
                            <span>{b.phone}</span>
                          </a>
                        ) : (
                          <span className="text-steel font-mono text-[10px]">{locale === 'vi' ? 'Chưa lưu SĐT' : 'No phone recorded'}</span>
                        )}
                        {u?.email && (
                          <span className="flex items-center gap-1 text-steel truncate" title={u.email}>
                            <Mail size={11} />
                            <span className="truncate">{u.email}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Danh sách thành viên cùng mượn phòng (Để truy vết nếu mất chìa) */}
                    <div className="flex flex-col gap-1 min-w-0 border-b md:border-b-0 md:border-r border-rule pb-2 md:pb-0 md:pr-3">
                      <div className="flex items-center justify-between font-mono text-[10px] font-bold text-steel uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {t('key.groupMembers')} ({members.length})
                        </span>
                        <span className="text-[9px] text-graphite font-normal">{t('key.accountabilityRoster')}</span>
                      </div>
                      {members.length > 0 ? (
                        <div className="flex flex-col gap-1 max-h-24 overflow-y-auto scrollbar-thin pr-1 mt-0.5">
                          {members.map((m, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-1.5 rounded-sm bg-ice/60 px-2 py-0.5 text-[11px]"
                            >
                              <span className="truncate font-medium text-ink">
                                <span className="font-mono text-steel text-[10px] mr-1">#{idx + 1}</span>
                                {m.name}
                              </span>
                              <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
                                <span className="text-steel">HCMUT: <strong className="text-ink">{m.hcmutId || '—'}</strong></span>
                                <span>·</span>
                                <span className="text-steel">UTS: <strong className="text-accent">{m.utsId || '—'}</strong></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-steel italic pt-1">
                          {locale === 'vi' ? 'Đặt phòng cá nhân (không đăng ký thêm thành viên)' : 'Single reservation (no additional members registered)'}
                        </div>
                      )}
                    </div>

                    {/* Column 3: Mốc giờ mượn, Giao chìa & Trả chìa */}
                    <div className="flex flex-col justify-between gap-1 min-w-0 font-mono text-[11px]">
                      <div>
                        <div className="text-[10px] font-bold text-steel uppercase tracking-wider">
                          {t('key.bookingWindow')}
                        </div>
                        <div className="font-bold text-ink text-[12px]">
                          {fmtDate(b.start)} · {fmtRange(b.start, b.end)}
                        </div>
                        <div className="text-steel text-[10px]">
                          {t('common.duration')}: {fmtDuration(durationMin(b.start, b.end))}
                        </div>
                      </div>

                      <div className="border-t border-dashed border-rule pt-1.5 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="text-steel">{t('key.issuedAt')}:</span>
                          <span className="font-bold text-ink">
                            {b.checkedOutAt ? `${fmtTime(b.checkedOutAt)}` : (locale === 'vi' ? 'Chưa giao chìa' : 'Not yet issued')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="text-steel">{t('key.returnedAt')}:</span>
                          <span className={cx('font-bold', b.returnedAt ? 'text-emerald-700' : isOut ? 'text-accent' : 'text-steel')}>
                            {b.returnedAt ? `${fmtTime(b.returnedAt)} · ${fmtDate(b.returnedAt)}` : isOut ? (locale === 'vi' ? 'Chưa trả' : 'Not returned') : (locale === 'vi' ? 'Chưa lấy' : 'Not picked up')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mục đích sử dụng / Hoạt động */}
                  <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-graphite">
                    <span className="truncate">
                      <strong className="font-mono text-[10px] text-steel uppercase">{t('key.activity')}: </strong>
                      {b.title}
                      {b.purpose ? ` — ${b.purpose}` : ''}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-steel">
                      {t('key.orderId')}: {b.id}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
