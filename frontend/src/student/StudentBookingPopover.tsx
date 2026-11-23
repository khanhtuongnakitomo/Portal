import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Users, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { parseBookingMembers, type Booking } from '@/lib/types'
import { durationMin, fmtDate, fmtDuration, fmtTime } from '@/lib/time'
import { cx } from '@/components/ui'

export function StudentBookingPopover({
  booking: b,
  anchor,
  onClose,
}: {
  booking: Booking
  anchor: HTMLElement
  onClose: () => void
}) {
  const { cancelBooking, currentUser, user, room, notify } = useStore()
  const { t, locale } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; side: 'left' | 'right'; arrowTop: number } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const u = b.isMine ? currentUser ?? user(b.userId) : user(b.userId)
  const r = room(b.roomId)

  const isCollected = b.status === 'KEY_CHECKED_OUT'
  const isCompleted = b.status === 'COMPLETED'
  const isCancelled = b.status === 'CANCELLED' || b.status === 'REJECTED'
  const canCancel = b.isMine && (b.status === 'PENDING' || b.status === 'APPROVED')
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    return () => { if (anchor.isConnected) anchor.focus({ preventScroll: true }) }
  }, [anchor])

  useLayoutEffect(() => {
    const place = () => {
      if (!anchor.isConnected) return onClose()
      const a = anchor.getBoundingClientRect()
      const w = Math.min(410, window.innerWidth - 24)
      const h = Math.min(ref.current?.offsetHeight ?? 380, window.innerHeight - 24)
      const gap = 10
      const side: 'left' | 'right' = a.right + gap + w <= window.innerWidth - 12 ? 'right' : 'left'
      const left = side === 'right' ? a.right + gap : Math.max(12, a.left - gap - w)
      const top = Math.max(12, Math.min(a.top - 8, window.innerHeight - h - 12))
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

  const handleCancel = async () => {
    if (!canCancel || pending) return
    setPending(true)
    setError(null)
    try {
      const error = await cancelBooking(b.id)
      if (error) {
        setError(error)
        notify(error, 'error')
      } else {
        notify(t('student.reservationCancelled'))
        onClose()
      }
    } finally {
      setPending(false)
    }
  }

  // Format timestamp: "FRI 06 NOV • 10:30 → 14:30 (4h)"
  const dateStr = fmtDate(b.start, locale)
  const startStr = fmtTime(b.start)
  const endStr = fmtTime(b.end)
  const durStr = fmtDuration(durationMin(b.start, b.end), locale)
  const timestamp = `${dateStr} • ${startStr} → ${endStr} (${durStr})`

  // Room header: "ROOM 601 • SEMINAR HALL"
  const roomTitle = r ? t('student.roomTitle', { code: r.code, name: r.name }) : t('student.roomReservation')

  // Status badge
  const badgeText = t(`student.bookingStatus.${b.status}`)
        ? 'KEY IN CUSTODY'
        : b.status

  const badgeStyle =
    b.status === 'PENDING'
      ? 'border-dashed border-meta text-meta bg-paper'
      : b.status === 'APPROVED'
        ? 'border-accent bg-tint text-ink-blue'
        : b.status === 'KEY_CHECKED_OUT'
          ? 'border-accent bg-accent text-paper'
          : b.status === 'COMPLETED'
            ? 'border-rule bg-ice text-steel'
            : 'border-plum text-plum bg-plum/[0.07]'

  const studentName = u?.fullName || t('student.holder')
  const hcmutId = u?.hcmutId || u?.studentCode || '—'
  const utsId = u?.utsId || '—'

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={t('student.bookingNamed', { title: b.title })}
      tabIndex={-1}
      className="fixed z-50 w-[min(410px,calc(100%-24px))] rounded-lg border border-[#E0E0E0] bg-[#ffffff] shadow-nav"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      {pos && (
        <span
          className={cx(
            'absolute h-3 w-3 rotate-45 border-[#E0E0E0] bg-[#ffffff]',
            pos.side === 'right' ? '-left-[7px] border-b border-l' : '-right-[7px] border-t border-r',
          )}
          style={{ top: pos.arrowTop }}
        />
      )}
      <div className="flex max-h-[calc(100dvh-26px)] flex-col overflow-y-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#E0E0E0] px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="font-mono text-[11px] font-bold tracking-wider text-steel truncate">
            {roomTitle}
          </div>
          <div>
            <span className={cx('inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider', badgeStyle)}>
              <span className={cx('h-1.5 w-1.5 rounded-sm', b.status === 'KEY_CHECKED_OUT' ? 'bg-tint' : 'bg-current')} />
              {badgeText}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="-mr-1.5 rounded-md p-1 text-steel hover:bg-ice hover:text-ink transition-colors cursor-pointer"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 px-5 py-4">
        {/* Date & Time */}
        <div className="border border-[#E0E0E0] bg-[#F4F5F7] px-3.5 py-2.5 rounded-sm">
          <div className="font-mono text-[10px] font-semibold tracking-wider text-steel uppercase">
            {t('student.reservedTime')}
          </div>
          <div className="mt-0.5 font-mono text-[13px] font-semibold text-ink">
            {timestamp}
          </div>
        </div>

        {/* Details: Title & Purpose */}
        <div className="flex flex-col gap-1">
          <h4 className="font-display text-[17px] font-w450 leading-snug text-ink">
            {b.title}
          </h4>
          {b.purpose && (
            <p className="text-[13px] leading-relaxed text-graphite">
              {b.purpose}
            </p>
          )}
        </div>

        {/* Student metadata */}
        <div className="flex flex-col gap-2 border-t border-dashed border-[#E0E0E0] pt-3">
          <div>
            <div className="font-mono text-[10px] font-semibold tracking-wider text-steel uppercase">
              {t('student.holderIdentification')}
            </div>
            <div className="mt-1 font-mono text-[12px] font-medium text-ink">
              <div className="font-semibold text-ink">{studentName}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] font-semibold text-meta">
                <span>{t('student.hcmutId')}: {hcmutId}</span>
                <span className="text-steel">·</span>
                <span>{t('student.utsId')}: {utsId}</span>
              </div>
            </div>
          </div>

          {(() => {
            const memberList = parseBookingMembers(b)
            if (memberList.length === 0) return null
            return (
              <div className="border-t border-dashed border-[#E0E0E0] pt-2">
                <div className="flex items-center justify-between font-mono text-[10px] font-semibold tracking-wider text-steel uppercase">
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {t('student.memberCount', { count: memberList.length })}
                  </span>
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {memberList.map((m, mi) => (
                    <div key={mi} className="flex items-center justify-between font-mono text-[11px] bg-ice/60 px-2 py-1 rounded-sm border border-rule/50">
                      <span className="font-sans font-medium text-ink truncate">{m.name}</span>
                      <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                        {m.hcmutId && <span className="text-steel">{t('student.hcmutId')}: <strong className="text-ink">{m.hcmutId}</strong></span>}
                        {m.hcmutId && m.utsId && <span>·</span>}
                        {m.utsId && <span className="text-steel">{t('student.utsId')}: <strong className="text-accent">{m.utsId}</strong></span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {b.isMine && b.passCode && (b.status === 'APPROVED' || isCollected) && (
          <div className="rounded-sm border border-accent bg-tint px-3 py-2">
            <p className="font-mono text-[10px] font-semibold text-ink-blue">{t('student.passCode')}</p>
            <p className="selectable break-all font-mono text-[15px] font-semibold text-ink">{b.passCode}</p>
          </div>
        )}

        {/* Warning / status note if not cancellable */}
        {isCollected && (
          <div className="rounded-sm border border-plum/30 bg-plum/[0.05] px-3 py-2 text-[12px] font-mono text-plum">
            {t('student.noCancelCollected')}
          </div>
        )}
        {isCompleted && (
          <div className="rounded-sm border border-rule bg-ice px-3 py-2 text-[12px] font-mono text-steel">
            {t('student.noCancelCompleted')}
          </div>
        )}
        {isCancelled && (
          <div className="rounded-sm border border-rule bg-ice px-3 py-2 text-[12px] font-mono text-steel">
            {t(b.status === 'REJECTED' ? 'student.reservationRejected' : 'student.reservationCancelled')}
          </div>
        )}
        {b.note && <p className="text-[12px] text-graphite">{t('student.reviewNote')}: {b.note}</p>}
        {error && <p role="alert" className="text-[12px] text-plum">{error}</p>}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 border-t border-[#E0E0E0] pt-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={!canCancel || pending}
            className={cx(
              'inline-flex items-center justify-center rounded-sm px-3 py-1.5 font-mono text-[12px] font-semibold transition-colors cursor-pointer',
              canCancel
                ? 'border border-plum/60 text-plum bg-paper hover:bg-plum hover:text-paper hover:border-plum'
                : 'border border-[#E0E0E0] bg-[#F4F5F7] text-steel/50 cursor-not-allowed',
            )}
          >
            {t(pending ? 'student.cancelling' : 'student.cancelReservation')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-sm border border-[#E0E0E0] bg-paper px-3.5 py-1.5 font-mono text-[12px] font-semibold text-graphite hover:bg-ice hover:text-ink transition-colors cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  )
}
