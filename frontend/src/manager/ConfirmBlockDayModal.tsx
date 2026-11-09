import { useMemo, useState } from 'react'
import { AlertTriangle, Building2, Calendar, CheckCircle2, Clock, Lock, X } from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import type { Booking, Room } from '@/lib/types'
import { at, fmtDate, fmtShort, fmtTime, overlaps, parseHM } from '@/lib/time'
import { Button, Eyebrow, Textarea, cx } from '@/components/ui'

interface ConfirmBlockDayModalProps {
  isOpen: boolean
  onClose: () => void
  date: Date
  dayIndex: number
  allRooms: boolean
  room: Room
  rooms: Room[]
  onConfirm: (reason: string) => void
}

const PRESET_REASONS_VI = [
  'Bảo trì kỹ thuật & thiết bị âm thanh ánh sáng (AV)',
  'Tổ chức sự kiện học thuật & hội thảo chính thức của Khoa',
  'Vệ sinh & khử khuẩn cơ sở vật chất định kỳ',
  'Phục vụ kỳ thi học kỳ & bảo vệ đồ án tốt nghiệp',
  'Nghỉ lễ theo quy định của Nhà trường',
]

const PRESET_REASONS_EN = [
  'AV and technical facility maintenance',
  'Official Faculty symposium & academic keynote',
  'Routine facility sanitation & deep cleaning',
  'Capstone thesis presentations & exam period',
  'University holiday schedule',
]

export function ConfirmBlockDayModal({
  isOpen,
  onClose,
  date,
  dayIndex,
  allRooms,
  room,
  rooms,
  onConfirm,
}: ConfirmBlockDayModalProps) {
  const { bookings, settings } = useStore()
  const { user } = useLookups()
  const { t, locale } = useI18n()

  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const open = parseHM(settings.openTime)
  const close = parseHM(settings.closeTime)
  const dayOpen = at(date, open.h, open.m)
  const dayClose = at(date, close.h, close.m)

  // Target rooms being locked
  const targetRoomIds = useMemo(() => {
    return allRooms && rooms && rooms.length > 0 ? rooms.map((r) => r.id) : [room.id]
  }, [allRooms, rooms, room.id])

  // Find all conflicting bookings in the locked time window
  const conflictingBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        targetRoomIds.includes(b.roomId) &&
        (b.status === 'PENDING' || b.status === 'APPROVED' || b.status === 'KEY_CHECKED_OUT') &&
        overlaps(b.start, b.end, dayOpen, dayClose),
    )
  }, [bookings, targetRoomIds, dayOpen, dayClose])

  const pendingConflicts = conflictingBookings.filter((b) => b.status === 'PENDING')
  const approvedConflicts = conflictingBookings.filter(
    (b) => b.status === 'APPROVED' || b.status === 'KEY_CHECKED_OUT',
  )

  const presets = locale === 'vi' ? PRESET_REASONS_VI : PRESET_REASONS_EN

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError(locale === 'vi' ? 'Vui lòng nhập lý do khóa phòng.' : 'A reason is required to lock the room.')
      return
    }
    setError(null)
    onConfirm(reason.trim())
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[560px] rounded-lg border border-ink bg-paper shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-rule bg-ice/60 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-plum text-paper">
              <Lock size={16} />
            </div>
            <div>
              <Eyebrow className="!text-plum">FACILITY CUSTODY GUARD · CONFIRMATION</Eyebrow>
              <h3 className="font-display text-[17px] font-bold text-ink">
                {locale === 'vi' ? 'Xác nhận khóa phòng cả ngày' : 'Confirm Full-Day Facility Lock'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1.5 text-steel hover:bg-paper hover:text-ink transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto scrollbar-thin">
          {/* Lock Scope & Time Spec */}
          <div className="rounded-md border border-rule bg-ice/30 p-3.5 grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <div className="font-mono text-[10px] text-steel uppercase font-semibold">
                {locale === 'vi' ? 'PHẠM VI KHÓA' : 'TARGET FACILITY'}
              </div>
              <div className="font-mono font-bold text-ink text-[13px] mt-0.5 flex items-center gap-1.5">
                <Building2 size={13} className="text-accent" />
                <span>
                  {allRooms ? 'ALL ROOMS (601 · 602 · 605)' : `ROOM ${room.code} (${room.name})`}
                </span>
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] text-steel uppercase font-semibold">
                {locale === 'vi' ? 'THỜI GIAN KHÓA' : 'LOCKED TIME WINDOW'}
              </div>
              <div className="font-mono font-bold text-ink text-[13px] mt-0.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-plum" />
                <span>{fmtDate(date)}</span>
              </div>
              <div className="font-mono text-[11px] text-steel mt-0.5">
                08:00 → 17:00 ({locale === 'vi' ? 'Toàn bộ giờ vận hành' : 'Full operating hours'})
              </div>
            </div>
          </div>

          {/* Conflict & Cancellation Warning */}
          {conflictingBookings.length > 0 ? (
            <div className="rounded-md border border-plum/40 bg-plum/[0.08] p-3.5 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-mono text-[11.5px] font-bold text-plum">
                <AlertTriangle size={15} />
                <span>
                  {locale === 'vi'
                    ? `CẢNH BÁO: ${conflictingBookings.length} yêu cầu đặt phòng sẽ bị TỰ ĐỘNG HỦY!`
                    : `WARNING: ${conflictingBookings.length} reservation(s) will be AUTOMATICALLY CANCELLED!`}
                </span>
              </div>
              <p className="text-[12px] text-graphite leading-relaxed">
                {locale === 'vi'
                  ? 'Khi bạn khóa phòng vào ngày này, các đơn chờ duyệt bên dưới sẽ tự động chuyển sang trạng thái TỪ CHỐI (REJECTED) kèm lý do bạn nhập.'
                  : 'Locking this facility window will automatically reject all conflicting pending and approved requests.'}
              </p>

              {/* Conflicting Request List */}
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto scrollbar-thin pr-1 mt-1">
                {conflictingBookings.map((b) => {
                  const u = user(b.userId)
                  const rCode = b.roomId.includes('602') ? '602' : b.roomId.includes('605') ? '605' : '601'
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-2 rounded-sm border border-rule/60 bg-paper px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="rounded-sm bg-plum text-paper font-mono font-bold px-1 py-0.2 text-[9.5px]">
                          RM {rCode}
                        </span>
                        <span className="font-mono text-steel">
                          {fmtTime(b.start)}–{fmtTime(b.end)}
                        </span>
                        <span className="truncate font-semibold text-ink">{u?.fullName}</span>
                        <span className="font-mono text-steel text-[10px]">({u?.studentCode})</span>
                      </div>
                      <span className="font-mono text-[9px] font-bold text-plum border border-plum/30 bg-plum/10 px-1 py-0.2 rounded-sm shrink-0">
                        {b.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-50/50 p-3 flex items-center gap-2 text-[12px] text-emerald-800 font-mono">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>
                {locale === 'vi'
                  ? 'Không có yêu cầu sinh viên nào trong khung giờ này.'
                  : 'No student reservations are currently scheduled for this window.'}
              </span>
            </div>
          )}

          {/* Reason Input Field */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor="block-reason-input" className="font-mono text-[11px] font-bold text-ink">
                {locale === 'vi' ? 'LÝ DO KHÓA PHÒNG / SỰ KIỆN *' : 'REASON FOR FACILITY LOCK *'}
              </label>
              <span className="font-mono text-[10px] text-steel">
                {locale === 'vi' ? 'Bắt buộc điền' : 'Required'}
              </span>
            </div>

            <Textarea
              id="block-reason-input"
              rows={2}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (error) setError(null)
              }}
              placeholder={
                locale === 'vi'
                  ? 'Ví dụ: Bảo trì hệ thống âm thanh ánh sáng, Diễn tập PCCC, Tổ chức hội thảo khoa...'
                  : 'e.g. AV equipment maintenance, Faculty keynote, Examination period...'
              }
              className="text-[13px]"
            />
            {error && <div className="font-mono text-[11px] font-bold text-plum">{error}</div>}

            {/* Quick 1-Click Reason Presets */}
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="font-mono text-[10px] text-steel uppercase font-semibold">
                {locale === 'vi' ? 'Chọn lý do nhanh mẫu:' : '1-Click Preset Reasons:'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setReason(p)
                      if (error) setError(null)
                    }}
                    className={cx(
                      'rounded-sm border px-2 py-1 font-mono text-[10px] transition-colors text-left cursor-pointer',
                      reason === p
                        ? 'border-plum bg-plum text-paper font-semibold'
                        : 'border-rule bg-ice/60 text-graphite hover:border-ink hover:text-ink hover:bg-paper',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-rule bg-ice/40 px-6 py-3.5 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>

          <Button
            variant="dark"
            size="sm"
            onClick={handleConfirm}
            disabled={!reason.trim()}
            className="!bg-plum hover:!bg-[#3D2938] text-white gap-1.5 font-bold shadow-xs disabled:opacity-50"
          >
            <Lock size={13} />
            <span>
              {locale === 'vi'
                ? `Xác nhận khóa phòng ${allRooms ? '(Cả 3 phòng)' : `(RM ${room.code})`}`
                : `Confirm & Lock ${allRooms ? 'All Rooms' : `Room ${room.code}`}`}
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
