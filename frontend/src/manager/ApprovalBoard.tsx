import { useI18n } from '@/lib/i18n'
import { useMemo, useState } from 'react'
import { Check, Eye, X } from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import type { Booking } from '@/lib/types'
import { fmtRange, fmtShort, overlaps } from '@/lib/time'
import { CONFLICT_COLORS, conflictMap } from '@/lib/conflicts'
import { Button, Input, Select, cx } from '@/components/ui'
import { QUICK_REJECT_REASONS } from './types'

interface ApprovalBoardProps {
  onInspect: (b: Booking, anchor: HTMLElement) => void
}

export function ApprovalBoard({ onInspect }: ApprovalBoardProps) {
  const { approveBooking, rejectBooking, pendingQueue: pending, bookings, blocks, notify } = useStore()
  const { user, room } = useLookups()
  const { t, locale } = useI18n()
  const [filterRoom, setFilterRoom] = useState('ALL')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const conflicts = useMemo(() => {
    const byId = new Map(bookings.map((booking) => [booking.id, booking]))
    for (const booking of pending) byId.set(booking.id, booking)
    return conflictMap([...byId.values()])
  }, [pending, bookings])
  const pendingRooms = useMemo(() => Array.from(new Set(pending.map((b) => b.roomId))), [pending])
  const activeFilter = pendingRooms.includes(filterRoom) ? filterRoom : 'ALL'
  const filtered = pending.filter((b) => activeFilter === 'ALL' || b.roomId === activeFilter)
  const rejecting = pending.find((b) => b.id === rejectingId)
  const rejectionPresets = QUICK_REJECT_REASONS.map((key) => t(key))

  const handleApprove = async (id: string) => {
    if (busy) return
    setBusy(true)
    try {
      const error = await approveBooking(id)
      if (error) notify(error, 'error')
      else notify(t('staff.bookingApproved'))
    } catch (error) {
      notify(error instanceof Error ? error.message : t('staff.approveError'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmReject = async () => {
    if (busy || !rejecting) return
    if (!rejectReason.trim()) {
      setRejectError(t('staff.rejectRequired'))
      return
    }
    setBusy(true)
    try {
      const error = await rejectBooking(rejecting.id, rejectReason.trim())
      if (error) {
        setRejectError(error)
        notify(error, 'error')
      } else {
        notify(t('staff.bookingRejected'))
        setRejectingId(null)
        setRejectReason('')
        setRejectError(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('staff.rejectError')
      setRejectError(message)
      notify(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="requests-title" className="min-w-0 rounded-lg border border-rule bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <h2 id="requests-title" className="flex items-center gap-2 text-[16px] font-semibold">
          {t('staff.requests')} <span className="font-mono text-[11px] text-steel">{t('staff.pendingCount', { count: pending.length })}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-1" aria-label={t('staff.filterRequests')}>
          {['ALL', ...pendingRooms].map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeFilter === id}
              onClick={() => {
                setFilterRoom(id)
                setRejectingId(null)
              }}
              disabled={busy}
              className={cx('rounded-sm border px-2 py-1 font-mono text-[11px] disabled:opacity-35',
                activeFilter === id ? 'border-ink bg-ink text-paper' : 'border-rule text-graphite hover:border-ink')}
            >
              {id === 'ALL' ? t('common.all') : t('staff.roomNumber', { code: room(id)?.code ?? '—' })} ({id === 'ALL' ? pending.length : pending.filter((b) => b.roomId === id).length})
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[256px] overflow-auto scrollbar-thin" tabIndex={0} aria-label={t('staff.scrollRequests')}>
        <ul className="min-w-[900px] divide-y divide-rule">
          {filtered.map((b) => {
            const u = user(b.userId)
            const info = conflicts.get(b.id)
            const colors = info ? CONFLICT_COLORS[info.letter] : null
            const blocked = blocks.some((block) => block.active && block.roomId === b.roomId && overlaps(block.start, block.end, b.start, b.end))
            const conflictLabel = info?.rivals.map((rival) =>
              t('staff.rivalConflict', { letter: conflicts.get(rival.id)?.letter ?? '—', name: user(rival.userId)?.fullName ?? t('staff.anotherBooking'), range: fmtRange(rival.start, rival.end) }),
            ).join('; ')
            return (
              <li
                key={b.id}
                aria-label={`${b.title}, ${t('staff.roomNumber', { code: room(b.roomId)?.code ?? '—' })}, ${fmtShort(b.start, locale)} ${fmtRange(b.start, b.end)}${conflictLabel ? `; ${conflictLabel}` : ''}`}
                className={cx('relative grid h-16 grid-cols-[78px_180px_minmax(150px,1fr)_minmax(130px,1fr)_auto] items-center gap-3 px-3 text-[12px]',
                  info && 'outline-2 -outline-offset-2 outline-danger')}
              >
                {colors && <span aria-hidden="true" className={cx('absolute inset-y-0 left-0 w-1', colors.bar)} />}
                <span className="font-mono font-semibold">{t('staff.roomNumber', { code: room(b.roomId)?.code ?? '—' })}</span>
                <span className="font-mono text-[11px]">{fmtShort(b.start, locale)} · {fmtRange(b.start, b.end)}</span>
                <span className="truncate" title={`${u?.fullName ?? t('staff.booker')}${u?.studentCode ? ` · ${u.studentCode}` : ''}`}>
                  {u?.fullName ?? t('staff.booker')}{u?.studentCode && ` · ${u.studentCode}`}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  {info && colors && <span title={conflictLabel} className={cx('shrink-0 rounded-sm px-1.5 py-0.5 font-mono font-bold', colors.badge, colors.text)}>{info.letter} · {t('staff.conflict')}</span>}
                  {blocked && <span className="shrink-0 font-mono text-[10px] text-danger">{t('staff.blocked')}</span>}
                  <span className="truncate text-steel" title={b.purpose || b.title}>{b.purpose || b.title}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <Button size="xs" variant="outline" disabled={busy} onClick={(event) => onInspect(b, event.currentTarget)}><Eye size={12} /> {t('staff.inspect')}</Button>
                  <Button size="xs" disabled={busy} onClick={() => void handleApprove(b.id)}><Check size={12} /> {t('staff.approve')}</Button>
                  <Button size="xs" variant="plum" disabled={busy} onClick={() => {
                    setRejectingId(b.id)
                    setRejectReason('')
                    setRejectError(null)
                  }}>{t('staff.rejectEllipsis')}</Button>
                </div>
              </li>
            )
          })}
        </ul>
        {filtered.length === 0 && <p className="px-3 py-3 text-[12px] text-steel">{t('staff.requestsEmpty')}</p>}
      </div>
      {rejecting && (
        <form className="border-t border-rule bg-ice/40 px-3 py-2" onSubmit={(event) => {
          event.preventDefault()
          void handleConfirmReject()
        }}>
          <div className="mb-2 flex items-center justify-between gap-2 text-[12px]">
            <span className="truncate font-semibold">{t('staff.rejectRoom', { code: room(rejecting.roomId)?.code ?? '—', name: user(rejecting.userId)?.fullName ?? t('staff.booker') })}</span>
            <button type="button" aria-label={t('staff.cancelReject')} disabled={busy} onClick={() => setRejectingId(null)}><X size={14} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label={t('staff.rejectPreset')} disabled={busy} value={rejectionPresets.includes(rejectReason) ? rejectReason : ''} className="!w-auto max-w-full !py-1 !text-[12px]" onChange={(event) => {
              setRejectReason(event.target.value)
              setRejectError(null)
            }}>
              <option value="">{t('staff.selectReason')}</option>
              {rejectionPresets.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </Select>
            <Input aria-label={t('staff.rejectReason')} aria-invalid={!!rejectError} aria-describedby={rejectError ? 'request-reject-error' : undefined} disabled={busy} value={rejectReason} className="min-w-48 flex-1 !py-1 !text-[12px]" placeholder={t('staff.rejectPlaceholder')} onChange={(event) => {
              setRejectReason(event.target.value)
              setRejectError(null)
            }} />
            <Button size="xs" variant="outline" disabled={busy} onClick={() => setRejectingId(null)}>{t('staff.cancel')}</Button>
            <Button type="submit" size="xs" variant="plum" disabled={busy}>{t('staff.confirmReject')}</Button>
          </div>
          {rejectError && <p id="request-reject-error" role="alert" className="mt-1 text-[12px] text-danger">{rejectError}</p>}
        </form>
      )}
    </section>
  )
}
