import { KeyRound } from 'lucide-react'
import type { Booking, Room } from '@/lib/types'
import { fmtDate, fmtRange, fmtTime } from '@/lib/time'
import { cx } from '@/components/ui'

export function DigitalPass({ booking, room, holder, studentCode }: { booking: Booking; room?: Room; holder: string; studentCode?: string }) {
  const out = booking.status === 'KEY_CHECKED_OUT'
  const overdue = out && new Date() > new Date(booking.end)
  return (
    <div className="relative overflow-hidden rounded-lg border border-ink bg-paper">
      <div className={cx('flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-paper', 'bg-accent')}>
        <span className="font-mono text-[11px] font-bold tracking-[0.06em]">KEY PICKUP SLIP • PRESENT STUDENT ID AT DESK</span>
        {out && (
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-bold">
            <KeyRound size={12} /> {overdue ? 'OVERDUE' : `RETURN BY ${fmtTime(booking.end)}`}
          </span>
        )}
      </div>
      <div className="graph-paper p-4">
        <div className="flex flex-col gap-4">
          <span
            className={cx(
              'inline-flex items-center gap-2 self-start rounded-sm border px-2 py-1 font-mono text-[12px] font-bold tracking-[0.03em]',
              overdue ? 'border-plum bg-plum text-paper' : out ? 'border-ink bg-ink text-paper' : 'border-accent bg-tint text-ink-blue',
            )}
          >
            <span className={cx('h-2 w-2', overdue || out ? 'bg-paper' : 'bg-accent')} />
            {overdue ? 'OVERDUE · RETURN KEY NOW' : out ? 'KEY IN CUSTODY' : 'READY FOR PHYSICAL KEY PICKUP'}
          </span>
          <div>
            <div className="font-mono text-[11px] font-semibold text-meta">ROOM</div>
            <div className="font-display text-[56px] leading-[0.95] font-w450 text-ink">{room?.code}</div>
            <div className="text-[14px] font-semibold text-graphite">{room?.name}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div>
              <div className="font-mono text-[10px] font-semibold text-steel">DATE</div>
              <div className="font-mono text-[13px] font-semibold whitespace-nowrap">{fmtDate(booking.start)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] font-semibold text-steel">TIME</div>
              <div className="font-mono text-[13px] font-semibold whitespace-nowrap">{fmtRange(booking.start, booking.end)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] font-semibold text-steel">HOLDER</div>
              <div className="truncate text-[13px] font-semibold">{holder}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] font-semibold text-steel">STUDENT ID</div>
              <div className="font-mono text-[13px] font-semibold">{studentCode ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
