import { useMemo, useState } from 'react'
import { Check, CheckCircle2, Eye, TriangleAlert, Users, X } from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { parseBookingMembers, type Booking } from '@/lib/types'
import { durationMin, fmtDate, fmtDuration, fmtRange, fmtShort, fmtTime, overlaps } from '@/lib/time'
import { Button, Input, cx } from '@/components/ui'
import { QUICK_REJECT_REASONS } from './types'

interface ApprovalBoardProps {
  pending: Booking[]
  onInspect: (b: Booking) => void
}

export function ApprovalBoard({ pending, onInspect }: ApprovalBoardProps) {
  const { approveBooking, rejectBooking, bookings, blocks } = useStore()
  const { user, room } = useLookups()
  const { locale } = useI18n()
  const vi = locale === 'vi'

  const [filterRoom, setFilterRoom] = useState<string>('ALL')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [rejectError, setRejectError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filterRoom === 'ALL') return pending
    return pending.filter((b) => b.roomId === filterRoom)
  }, [pending, filterRoom])

  const pendingRooms = useMemo(() => {
    return Array.from(new Set(pending.map((b) => b.roomId)))
  }, [pending])

  const checkConflict = (b: Booking): boolean => {
    const clashBooking = bookings.some(
      (x) =>
        x.id !== b.id &&
        x.roomId === b.roomId &&
        ['APPROVED', 'KEY_CHECKED_OUT'].includes(x.status) &&
        overlaps(new Date(x.start), new Date(x.end), new Date(b.start), new Date(b.end)),
    )
    const clashBlock = blocks.some(
      (k) =>
        k.active &&
        k.roomId === b.roomId &&
        overlaps(new Date(k.start), new Date(k.end), new Date(b.start), new Date(b.end)),
    )
    return clashBooking || clashBlock
  }

  const handleConfirmReject = (id: string) => {
    if (!rejectReason.trim()) {
      setRejectError(vi ? 'Vui lòng chọn hoặc nhập lý do từ chối.' : 'Please select or enter a rejection reason.')
      return
    }
    const err = rejectBooking(id, rejectReason)
    if (err) {
      setRejectError(err)
    } else {
      setRejectingId(null)
      setRejectReason('')
      setRejectError(null)
    }
  }

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-rule bg-paper px-6 py-16 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={22} />
        </div>
        <div className="text-[15px] font-semibold text-ink">
          {vi ? 'Không có yêu cầu nào đang chờ duyệt' : 'All caught up! No pending requests'}
        </div>
        <p className="max-w-[420px] text-[13px] text-steel">
          {vi
            ? 'Khi sinh viên gửi yêu cầu đặt phòng mới, đơn sẽ xuất hiện tại đây để bạn xét duyệt nhanh.'
            : 'New student room booking requests will appear here for quick review.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Compact Room Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-paper px-4 py-3">
        <div className="text-[13px] text-graphite">
          {vi ? (
            <>
              Hiển thị <strong className="text-ink">{filtered.length}</strong> / {pending.length} yêu cầu chờ duyệt
            </>
          ) : (
            <>
              Showing <strong className="text-ink">{filtered.length}</strong> of {pending.length} pending requests
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-steel">{vi ? 'PHÒNG:' : 'ROOM:'}</span>
          <button
            type="button"
            onClick={() => setFilterRoom('ALL')}
            className={cx(
              'rounded-[2px] px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors cursor-pointer',
              filterRoom === 'ALL'
                ? 'bg-ink text-paper'
                : 'border border-rule bg-paper text-graphite hover:border-ink',
            )}
          >
            {vi ? `Tất cả (${pending.length})` : `All (${pending.length})`}
          </button>
          {pendingRooms.map((rid) => {
            const r = room(rid)
            const count = pending.filter((b) => b.roomId === rid).length
            return (
              <button
                key={rid}
                type="button"
                onClick={() => setFilterRoom(rid)}
                className={cx(
                  'rounded-[2px] px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors cursor-pointer',
                  filterRoom === rid
                    ? 'bg-ink text-paper'
                    : 'border border-rule bg-paper text-graphite hover:border-ink',
                )}
              >
                {vi ? `Phòng ${r?.code}` : `RM ${r?.code}`} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-rule bg-paper py-10 text-center text-[13px] text-steel">
          {vi ? 'Không có đơn chờ duyệt nào cho phòng này.' : 'No pending requests for the selected room.'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((b) => {
            const u = user(b.userId)
            const r = room(b.roomId)
            const conflict = checkConflict(b)
            const competing = pending
              .filter(
                (other) =>
                  other.id !== b.id &&
                  other.roomId === b.roomId &&
                  overlaps(new Date(other.start), new Date(other.end), new Date(b.start), new Date(b.end)),
              )
              .sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime())

            const allCompeting = [b, ...competing].sort(
              (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(),
            )
            const rank = allCompeting.findIndex((x) => x.id === b.id) + 1
            const isFirstToRequest = rank === 1
            const isRejecting = rejectingId === b.id
            const duration = fmtDuration(durationMin(b.start, b.end))
            const memberList = parseBookingMembers(b)

            return (
              <div
                key={b.id}
                className={cx(
                  'flex flex-col justify-between rounded-lg border bg-paper p-5 shadow-xs transition-shadow hover:shadow-md',
                  competing.length > 0 || conflict
                    ? 'border-plum/60 border-l-[4px] border-l-plum'
                    : 'border-rule border-l-[4px] border-l-accent',
                )}
              >
                <div>
                  {/* Top Row: Room, Time & Clear Status */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[16px] font-bold text-ink">
                        {vi ? `Phòng ${r?.code}` : `RM ${r?.code}`}
                      </span>
                      <span className="font-mono text-[12px] text-graphite">
                        {fmtShort(b.start)} · {fmtRange(b.start, b.end)}
                      </span>
                      <span className="rounded-[2px] bg-ice px-1.5 py-0.5 font-mono text-[10px] text-steel">
                        {duration}
                      </span>
                    </div>

                    {competing.length > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="flex items-center gap-1 rounded-[2px] bg-plum/15 px-2 py-0.5 font-mono text-[10px] font-bold text-plum border border-plum/30">
                          <TriangleAlert size={11} />
                          {vi ? `${competing.length + 1} đơn trùng giờ` : `${competing.length + 1} competing`}
                        </span>
                        <span
                          className={cx(
                            'rounded-[2px] px-1.5 py-0.5 font-mono text-[9.5px] font-bold',
                            isFirstToRequest
                              ? 'bg-emerald-600 text-white'
                              : 'bg-plum/15 text-plum',
                          )}
                        >
                          {isFirstToRequest
                            ? vi
                              ? 'Gửi sớm nhất (Ưu tiên)'
                              : '1st to submit (Priority)'
                            : vi
                              ? `Xếp thứ #${rank}`
                              : `#${rank} in queue`}
                        </span>
                      </div>
                    ) : conflict ? (
                      <span className="flex items-center gap-1 rounded-[2px] bg-plum/10 px-2 py-0.5 font-mono text-[10px] font-bold text-plum">
                        <TriangleAlert size={11} /> {vi ? 'Trùng lịch đã có' : 'Conflict'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-[2px] bg-tint/60 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-blue">
                        <Check size={11} /> {vi ? 'Khung giờ trống' : 'Slot clear'}
                      </span>
                    )}
                  </div>

                  {/* Student & Submission Info */}
                  <div className="mt-3 flex items-start justify-between gap-3 border-y border-rule/70 py-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[14px] font-semibold text-ink">{u?.fullName}</span>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[11px] text-steel">
                        <span className="font-semibold text-accent">
                          {u?.hcmutId || u?.utsId
                            ? `HCMUT: ${u.hcmutId ?? '—'} · UTS: ${u.utsId ?? '—'}`
                            : (u?.studentCode ?? '—')}
                        </span>
                        {b.phone && <span>· {b.phone}</span>}
                      </div>
                      <div className="font-mono text-[11px] text-steel">
                        {vi ? 'Gửi lúc: ' : 'Submitted: '}
                        <span className="text-ink">
                          {fmtDate(b.createdAt)} · {fmtTime(b.createdAt)}
                        </span>
                      </div>

                      {memberList.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                          <span className="flex items-center gap-1 text-steel font-semibold">
                            <Users size={12} /> {vi ? `Thành viên (${memberList.length}):` : `Members (${memberList.length}):`}
                          </span>
                          {memberList.map((m, mi) => (
                            <span
                              key={mi}
                              className="inline-flex items-center gap-1 rounded-sm border border-rule bg-ice px-1.5 py-0.5 text-[10.5px] text-ink"
                            >
                              {m.name ? `${m.name} · ` : ''}
                              {[m.hcmutId && `HCMUT ${m.hcmutId}`, m.utsId && `UTS ${m.utsId}`].filter(Boolean).join(' / ') || '—'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onInspect(b)}
                      className="gap-1 !text-[11px] shrink-0"
                    >
                      <Eye size={12} /> {vi ? 'Xem trên lịch' : 'View on calendar'}
                    </Button>
                  </div>

                  {/* Purpose */}
                  <div className="mt-2.5 text-[13px] leading-relaxed text-graphite">
                    <span className="font-semibold text-ink">{b.title}</span>
                    {b.purpose && b.purpose !== b.title && (
                      <p className="mt-0.5 text-[12.5px] text-steel">“{b.purpose}”</p>
                    )}
                  </div>
                </div>

                {/* Inline Rejection Form OR Action Buttons */}
                {isRejecting ? (
                  <div className="mt-4 rounded-[4px] border border-plum/30 bg-plum/[0.04] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-plum">
                        {vi ? 'CHỌN HOẶC NHẬP LÝ DO TỪ CHỐI:' : 'REJECTION REASON:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null)
                          setRejectReason('')
                        }}
                        className="text-steel hover:text-ink cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {QUICK_REJECT_REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => {
                            setRejectReason(reason)
                            setRejectError(null)
                          }}
                          className={cx(
                            'rounded-[2px] border px-2 py-1 text-left text-[11px] transition-colors cursor-pointer',
                            rejectReason === reason
                              ? 'border-plum bg-plum text-paper font-semibold'
                              : 'border-edge bg-paper text-graphite hover:border-plum',
                          )}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>

                    <div className="mt-2">
                      <Input
                        value={rejectReason}
                        onChange={(e) => {
                          setRejectReason(e.target.value)
                          setRejectError(null)
                        }}
                        placeholder={vi ? 'Hoặc nhập lý do từ chối khác...' : 'Or enter a custom reason...'}
                        className="bg-paper text-[12px]"
                      />
                    </div>

                    {rejectError && (
                      <div className="mt-1 font-mono text-[11px] text-plum">{rejectError}</div>
                    )}

                    <div className="mt-2.5 flex items-center justify-end gap-2">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setRejectingId(null)
                          setRejectReason('')
                        }}
                      >
                        {vi ? 'Hủy' : 'Cancel'}
                      </Button>
                      <Button size="xs" variant="plum" onClick={() => handleConfirmReject(b.id)}>
                        {vi ? 'Xác nhận từ chối' : 'Confirm rejection'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-rule pt-3">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setRejectingId(b.id)
                        setRejectReason(QUICK_REJECT_REASONS[0])
                        setRejectError(null)
                      }}
                      className="hover:!border-plum hover:!text-plum"
                    >
                      <X size={12} /> {vi ? 'Từ chối' : 'Reject'}
                    </Button>

                    <Button
                      size="xs"
                      variant="dark"
                      onClick={() => approveBooking(b.id)}
                      className="gap-1 bg-ink text-paper hover:bg-black"
                    >
                      <Check size={12} strokeWidth={2.5} />{' '}
                      {competing.length > 0
                        ? vi
                          ? `Duyệt & từ chối ${competing.length} đơn trùng`
                          : `Approve & decline (${competing.length})`
                        : vi
                          ? 'Duyệt đơn'
                          : 'Approve'}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
