import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { ACTIVE_STATUSES, useLookups, useStore } from '@/lib/store'
import type { Booking } from '@/lib/types'
import { fmtDuration, fmtRange, durationMin, fmtShort } from '@/lib/time'
import { Button, EmptyState, Eyebrow, StatusChip, cx } from '@/components/ui'
import { DigitalPass } from './DigitalPass'
import { BlurText, Reveal } from '@/components/effects'

type Filter = 'active' | 'history' | 'all'

export function MyBookingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { bookings, currentUser, cancelBooking } = useStore()
  const { room } = useLookups()
  const [filter, setFilter] = useState<Filter>('active')

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  const mine = useMemo(
    () => bookings.filter((b) => b.userId === currentUser?.id).sort((a, b) => +new Date(a.start) - +new Date(b.start)),
    [bookings, currentUser],
  )
  const list = mine.filter((b) => (filter === 'all' ? true : filter === 'active' ? ACTIVE_STATUSES.includes(b.status) : !ACTIVE_STATUSES.includes(b.status)))
  const counts = { active: mine.filter((b) => ACTIVE_STATUSES.includes(b.status)).length, history: mine.filter((b) => !ACTIVE_STATUSES.includes(b.status)).length, all: mine.length }

  return (
    <div className={cx('fixed inset-0 z-50', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <div className={cx('absolute inset-0 bg-ink/30 transition-opacity', open ? 'opacity-100' : 'opacity-0')} onClick={onClose} />
      <aside
        className={cx(
          'absolute top-0 right-0 flex h-full w-full max-w-[560px] flex-col border-l border-ink bg-paper transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-start justify-between border-b border-rule px-6 pt-6 pb-5">
          <div className="flex flex-col gap-2">
            <Eyebrow>LEDGER · {currentUser?.studentCode}</Eyebrow>
            <h2 className="font-display text-section font-w450">
              <BlurText text="My bookings" />
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-steel hover:bg-ice hover:text-ink">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex gap-1 border-b border-rule px-6 py-2">
          {(['active', 'history', 'all'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cx('flex items-center gap-2 rounded-md px-2.5 py-1 text-[13px] font-medium capitalize', filter === f ? 'text-ink shadow-subtle' : 'text-steel hover:text-ink')}
            >
              {f}
              <span className="font-mono text-[11px] text-steel">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">
          {list.length === 0 ? (
            <EmptyState title="NO ENTRIES" body="Drag across the calendar to create a booking." />
          ) : (
            <Reveal stagger className="flex flex-col gap-5">
              {list.map((b) => (
                <BookingEntry key={b.id} b={b} onCancel={() => cancelBooking(b.id)} roomName={room(b.roomId)?.name} roomCode={room(b.roomId)?.code}>
                  {(b.status === 'APPROVED' || b.status === 'KEY_CHECKED_OUT') && currentUser && (
                    <DigitalPass booking={b} room={room(b.roomId)} holder={currentUser.fullName} studentCode={currentUser.studentCode} />
                  )}
                </BookingEntry>
              ))}
            </Reveal>
          )}
        </div>
      </aside>
    </div>
  )
}

function BookingEntry({ b, onCancel, roomName, roomCode, children }: { b: Booking; onCancel: () => void; roomName?: string; roomCode?: string; children?: React.ReactNode }) {
  const cancellable = b.status === 'PENDING' || b.status === 'APPROVED'
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 border-t border-ink pt-3">
        <div className="w-14 shrink-0">
          <div className="font-mono text-[11px] text-steel">{fmtShort(b.start).split(' ')[1]}</div>
          <div className="font-display text-[28px] leading-none font-w450">{fmtShort(b.start).split(' ')[0]}</div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-semibold">ROOM {roomCode}</span>
            <span className="font-mono text-[12px] text-steel">
              {fmtRange(b.start, b.end)} · {fmtDuration(durationMin(b.start, b.end))}
            </span>
            <StatusChip status={b.status} className="ml-auto" />
          </div>
          <div className="text-[14px] font-medium text-ink">{b.title}</div>
          {b.purpose !== b.title && <div className="text-[13px] text-graphite">{b.purpose}</div>}
          <div className="text-[12px] text-steel">
            {roomName} · <span className="font-mono">{b.phone}</span> · <span className="font-mono">{b.id}</span>
          </div>
          {b.note && (
            <div className={cx('mt-1 border-l-2 px-2 py-1 text-[12px]', b.status === 'REJECTED' ? 'border-plum bg-plum/[0.06] text-plum' : 'border-accent bg-ice text-graphite')}>
              <span className="font-mono text-[10px] font-semibold">MANAGER NOTE · </span>
              {b.note}
            </div>
          )}
          {cancellable && (
            <div className="mt-1 flex items-center gap-2">
              {confirm ? (
                <>
                  <span className="text-[12px] text-graphite">Cancel this booking?</span>
                  <Button size="xs" variant="plum" onClick={onCancel}>
                    Yes, cancel
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setConfirm(false)}>
                    Keep
                  </Button>
                </>
              ) : (
                <button onClick={() => setConfirm(true)} className="text-[12px] font-semibold text-graphite underline decoration-edge underline-offset-4 hover:text-plum">
                  Cancel booking
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
