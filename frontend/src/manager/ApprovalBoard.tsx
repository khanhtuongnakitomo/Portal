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
  const [filterRoom, setFilterRoom] = useState('ALL')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const conflicts = useMemo(() => conflictMap(pending.concat(bookings)), [pending, bookings])
  const pendingRooms = useMemo(() => Array.from(new Set(pending.map((b) => b.roomId))), [pending])
  const activeFilter = pendingRooms.includes(filterRoom) ? filterRoom : 'ALL'
  const filtered = pending.filter((b) => activeFilter === 'ALL' || b.roomId === activeFilter)
  const rejecting = pending.find((b) => b.id === rejectingId)

  const handleApprove = async (id: string) => {
    if (busy) return
    setBusy(true)
    try {
      const error = await approveBooking(id)
      if (error) notify(error, 'error')
      else notify('Booking approved.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to approve booking.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmReject = async () => {
    if (busy || !rejecting) return
    if (!rejectReason.trim()) {
      setRejectError('Please select or enter a rejection reason.')
      return
    }
    setBusy(true)
    try {
      const error = await rejectBooking(rejecting.id, rejectReason.trim())
      if (error) {
        setRejectError(error)
        notify(error, 'error')
      } else {
        notify('Booking rejected.')
        setRejectingId(null)
        setRejectReason('')
        setRejectError(null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reject booking.'
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
          Requests <span className="font-mono text-[11px] text-steel">{pending.length} pending</span>
        </h2>
        <div className="flex flex-wrap items-center gap-1" aria-label="Filter requests by room">
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
              {id === 'ALL' ? 'ALL' : `RM ${room(id)?.code ?? '—'}`} ({id === 'ALL' ? pending.length : pending.filter((b) => b.roomId === id).length})
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[256px] overflow-auto scrollbar-thin" tabIndex={0} aria-label="Pending requests, four rows at a time">
        <ul className="min-w-[900px] divide-y divide-rule">
          {filtered.map((b) => {
            const u = user(b.userId)
            const info = conflicts.get(b.id)
            const colors = info ? CONFLICT_COLORS[info.letter] : null
            const blocked = blocks.some((block) => block.active && block.roomId === b.roomId && overlaps(block.start, block.end, b.start, b.end))
            const conflictLabel = info?.rivals.map((rival) =>
              `conflicts with ${conflicts.get(rival.id)?.letter ?? 'another booking'}: ${user(rival.userId)?.fullName ?? 'another booking'} ${fmtRange(rival.start, rival.end)}`,
            ).join('; ')
            return (
              <li
                key={b.id}
                aria-label={`${b.title}, RM ${room(b.roomId)?.code ?? '—'}, ${fmtShort(b.start)} ${fmtRange(b.start, b.end)}${conflictLabel ? `; ${conflictLabel}` : ''}`}
                className={cx('relative grid h-16 grid-cols-[78px_180px_minmax(150px,1fr)_minmax(130px,1fr)_auto] items-center gap-3 px-3 text-[12px]',
                  info && 'outline-2 -outline-offset-2 outline-danger')}
              >
                {colors && <span aria-hidden="true" className={cx('absolute inset-y-0 left-0 w-1', colors.bar)} />}
                <span className="font-mono font-semibold">RM {room(b.roomId)?.code ?? '—'}</span>
                <span className="font-mono text-[11px]">{fmtShort(b.start)} · {fmtRange(b.start, b.end)}</span>
                <span className="truncate" title={`${u?.fullName ?? 'Student'}${u?.studentCode ? ` · ${u.studentCode}` : ''}`}>
                  {u?.fullName ?? 'Student'}{u?.studentCode && ` · ${u.studentCode}`}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  {info && colors && <span title={conflictLabel} className={cx('shrink-0 rounded-sm px-1.5 py-0.5 font-mono font-bold', colors.badge, colors.text)}>{info.letter} · CONFLICT</span>}
                  {blocked && <span className="shrink-0 font-mono text-[10px] text-danger">BLOCKED</span>}
                  <span className="truncate text-steel" title={b.purpose || b.title}>{b.purpose || b.title}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <Button size="xs" variant="outline" disabled={busy} onClick={(event) => onInspect(b, event.currentTarget)}><Eye size={12} /> Inspect</Button>
                  <Button size="xs" disabled={busy} onClick={() => void handleApprove(b.id)}><Check size={12} /> Approve</Button>
                  <Button size="xs" variant="plum" disabled={busy} onClick={() => {
                    setRejectingId(b.id)
                    setRejectReason('')
                    setRejectError(null)
                  }}>Reject…</Button>
                </div>
              </li>
            )
          })}
        </ul>
        {filtered.length === 0 && <p className="px-3 py-3 text-[12px] text-steel">No pending requests for this selection.</p>}
      </div>
      {rejecting && (
        <form className="border-t border-rule bg-ice/40 px-3 py-2" onSubmit={(event) => {
          event.preventDefault()
          void handleConfirmReject()
        }}>
          <div className="mb-2 flex items-center justify-between gap-2 text-[12px]">
            <span className="truncate font-semibold">Reject RM {room(rejecting.roomId)?.code} · {user(rejecting.userId)?.fullName ?? 'Student'}</span>
            <button type="button" aria-label="Cancel rejection" disabled={busy} onClick={() => setRejectingId(null)}><X size={14} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label="Preset rejection reason" disabled={busy} value={QUICK_REJECT_REASONS.includes(rejectReason) ? rejectReason : ''} className="!w-auto max-w-full !py-1 !text-[12px]" onChange={(event) => {
              setRejectReason(event.target.value)
              setRejectError(null)
            }}>
              <option value="">Select a reason…</option>
              {QUICK_REJECT_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </Select>
            <Input aria-label="Rejection reason" aria-invalid={!!rejectError} aria-describedby={rejectError ? 'request-reject-error' : undefined} disabled={busy} value={rejectReason} className="min-w-48 flex-1 !py-1 !text-[12px]" placeholder="Required reason or custom explanation" onChange={(event) => {
              setRejectReason(event.target.value)
              setRejectError(null)
            }} />
            <Button size="xs" variant="outline" disabled={busy} onClick={() => setRejectingId(null)}>Cancel</Button>
            <Button type="submit" size="xs" variant="plum" disabled={busy}>Confirm rejection</Button>
          </div>
          {rejectError && <p id="request-reject-error" role="alert" className="mt-1 text-[12px] text-danger">{rejectError}</p>}
        </form>
      )}
    </section>
  )
}
