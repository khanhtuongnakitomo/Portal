import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Eye, Mail, Phone, Search, TriangleAlert, Users, X } from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import { parseBookingMembers, type Booking } from '@/lib/types'
import { durationMin, fmtDate, fmtDuration, fmtRange, fmtShort, fmtTime, overlaps } from '@/lib/time'
import { Button, EmptyState, Eyebrow, Field, Input, Tag, Textarea, cx } from '@/components/ui'
import { QUICK_REJECT_REASONS } from './types'

interface ApprovalBoardProps {
  pending: Booking[]
  onInspect: (b: Booking) => void
}

export function ApprovalBoard({ pending, onInspect }: ApprovalBoardProps) {
  const { approveBooking, rejectBooking, bookings, blocks, notify } = useStore()
  const { user, room } = useLookups()

  const [filterRoom, setFilterRoom] = useState<string>('ALL')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [rejectError, setRejectError] = useState<string | null>(null)

  // Filtered pending list
  const filtered = useMemo(() => {
    let list = pending
    if (filterRoom !== 'ALL') {
      list = list.filter((b) => b.roomId === filterRoom)
    }
    return list
  }, [pending, filterRoom])

  // Get unique room IDs from pending
  const pendingRooms = useMemo(() => {
    const ids = Array.from(new Set(pending.map((b) => b.roomId)))
    return ids
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

  const handleApprove = (id: string) => {
    approveBooking(id)
  }

  const handleConfirmReject = (id: string) => {
    if (!rejectReason.trim()) {
      setRejectError('Please select or enter a rejection reason.')
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

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-rule bg-ice/30 p-4">
      {/* Header and Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <div className="flex items-center gap-2">
          <Eyebrow>APPROVAL DESK · 1-CLICK ACTIONS</Eyebrow>
          <span className="rounded-sm bg-accent px-2 py-0.5 font-mono text-[11px] font-bold text-paper">
            {pending.length} PENDING
          </span>
        </div>

        {/* Room Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-steel">ROOM:</span>
          <button
            type="button"
            onClick={() => setFilterRoom('ALL')}
            className={cx(
              'rounded-[2px] px-2 py-1 font-mono text-[11px] font-semibold transition-colors',
              filterRoom === 'ALL'
                ? 'bg-ink text-paper'
                : 'border border-rule bg-paper text-graphite hover:border-ink',
            )}
          >
            ALL ({pending.length})
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
                  'rounded-[2px] px-2 py-1 font-mono text-[11px] font-semibold transition-colors',
                  filterRoom === rid
                    ? 'bg-ink text-paper'
                    : 'border border-rule bg-paper text-graphite hover:border-ink',
                )}
              >
                RM {r?.code} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Cards List */}
      {filtered.length === 0 ? (
        <div className="py-6 text-center">
          <span className="font-mono text-[12px] text-steel">
            NO PENDING REQUESTS MATCHING THIS SELECTION
          </span>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
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

            return (
              <div
                key={b.id}
                className={cx(
                  'flex flex-col justify-between rounded-md border bg-paper p-4 shadow-xs transition-shadow hover:shadow-md',
                  competing.length > 0
                    ? 'border-plum/80 border-l-[4px] border-l-plum'
                    : conflict
                      ? 'border-plum/50 border-l-[4px] border-l-plum'
                      : 'border-rule border-l-[4px] border-l-accent',
                )}
              >
                <div>
                  {/* Top Row: Room, Date & Conflict Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[16px] font-bold text-ink">
                        RM {r?.code}
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
                          <TriangleAlert size={11} /> {competing.length + 1} COMPETING REQUESTS
                        </span>
                        <span
                          className={cx(
                            'rounded-[2px] px-1.5 py-0.2 font-mono text-[9px] font-bold',
                            isFirstToRequest
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-plum/20 text-plum border border-plum/30',
                          )}
                        >
                          {isFirstToRequest
                            ? '1ST TO SUBMIT (FIRST-COME PRIORITY)'
                            : `#${rank} IN QUEUE (SUBMITTED LATER)`}
                        </span>
                      </div>
                    ) : conflict ? (
                      <span className="flex items-center gap-1 rounded-[2px] bg-plum/10 px-2 py-0.5 font-mono text-[10px] font-bold text-plum">
                        <TriangleAlert size={11} /> CONFLICT
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-[2px] bg-tint/60 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-blue">
                        <Check size={11} /> SLOT CLEAR
                      </span>
                    )}
                  </div>

                  {/* Student Credentials */}
                  <div className="mt-2.5 flex items-center justify-between border-y border-rule/70 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-sans text-[13px] font-semibold text-ink">
                        {u?.fullName}
                      </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-steel">
                        <span className="font-bold text-accent">
                          {u?.hcmutId || u?.utsId ? `HCMUT: ${u.hcmutId ?? '—'} · UTS: ${u.utsId ?? '—'}` : (u?.studentCode ?? '—')}
                        </span>
                        {b.phone && <span>· {b.phone}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-steel">
                        <span>
                          Requested at: <strong className="text-ink">{fmtDate(b.createdAt)} · {fmtTime(b.createdAt)}</strong>
                        </span>
                        {competing.length > 0 && isFirstToRequest && (
                          <span className="rounded-[2px] bg-emerald-50 px-1 text-[10px] font-bold text-emerald-700 border border-emerald-300">
                            Earliest submission
                          </span>
                        )}
                      </div>
                      {(() => {
                        const memberList = parseBookingMembers(b)
                        if (memberList.length === 0) return null
                        return (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                            <span className="flex items-center gap-1 font-bold text-steel">
                              <Users size={12} /> MEMBERS ({memberList.length}):
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {memberList.map((m, mi) => (
                                <span
                                  key={mi}
                                  className="inline-flex items-center gap-1.5 rounded-sm border border-rule bg-ice px-1.5 py-0.5 text-[10.5px]"
                                  title={`${m.name} (HCMUT: ${m.hcmutId} · UTS: ${m.utsId})`}
                                >
                                  <span className="font-sans font-medium text-ink">{m.name}</span>
                                  <span className="font-mono text-[10px] text-steel">
                                    [HCMUT: <strong className="text-ink">{m.hcmutId || '—'}</strong> · UTS: <strong className="text-accent">{m.utsId || '—'}</strong>]
                                  </span>
                                </span>
                              ))}
                            </div>
                            {b.attendeeCount && (
                              <span className="text-[10px] text-steel">
                                ({b.attendeeCount} total)
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onInspect(b)}
                      className="gap-1 !text-[11px] shrink-0"
                    >
                      <Eye size={12} /> Inspect on Grid
                    </Button>
                  </div>

                  {/* Purpose */}
                  <div className="mt-2 text-[12px] leading-relaxed text-graphite">
                    <span className="font-mono text-[10px] font-semibold text-steel uppercase">
                      Purpose:{' '}
                    </span>
                    <span className="italic font-normal">“{b.purpose}”</span>
                  </div>
                </div>

                {/* Inline Rejection Drawer */}
                {isRejecting ? (
                  <div className="mt-3 rounded-[4px] border border-plum/30 bg-plum/[0.04] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-plum">
                        REJECTION REASON (1-CLICK PRESETS):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null)
                          setRejectReason('')
                        }}
                        className="text-steel hover:text-ink"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Quick reason chips */}
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
                            'rounded-[2px] border px-2 py-1 text-left text-[11px] transition-colors',
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
                        placeholder="Or type custom rejection reason..."
                        className="bg-paper text-[12px]"
                      />
                    </div>

                    {rejectError && (
                      <div className="mt-1 font-mono text-[11px] text-plum">
                        {rejectError}
                      </div>
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
                        Cancel
                      </Button>
                      <Button
                        size="xs"
                        variant="plum"
                        onClick={() => handleConfirmReject(b.id)}
                      >
                        Confirm Rejection
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons */
                  <div className="mt-3.5 flex items-center justify-end gap-2 border-t border-rule pt-2.5">
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
                      <X size={12} /> Reject...
                    </Button>

                    <Button
                      size="xs"
                      variant="dark"
                      onClick={() => handleApprove(b.id)}
                      className="gap-1 bg-ink text-paper hover:bg-black"
                    >
                      <Check size={12} strokeWidth={2.5} />{' '}
                      {competing.length > 0 ? `Approve & Decline (${competing.length})` : '1-Click Approve'}
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
