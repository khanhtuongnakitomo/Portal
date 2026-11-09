import { KeyRound } from 'lucide-react'
import { useLookups } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { parseBookingMembers, type Booking, type Room } from '@/lib/types'
import { fmtDate, fmtRange, fmtTime } from '@/lib/time'
import { cx } from '@/components/ui'
import { UtsLogo } from '@/components/UtsLogo'

export function DigitalPass({
  booking,
  room,
  holder,
  studentCode,
  hcmutId,
  utsId,
}: {
  booking: Booking
  room?: Room
  holder: string
  studentCode?: string
  hcmutId?: string
  utsId?: string
}) {
  const { user } = useLookups()
  const { t, locale } = useI18n()
  const u = user(booking.userId)
  const resolvedHcmut = hcmutId || u?.hcmutId || studentCode || u?.studentCode || '2110123'
  const resolvedUts = utsId || u?.utsId || '14234567'
  const out = booking.status === 'KEY_CHECKED_OUT'
  const overdue = out && new Date() > new Date(booking.end)
  return (
    <div className="relative overflow-hidden rounded-lg border border-ink bg-paper">
      <div className={cx('flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2 text-paper', 'bg-accent')}>
        <div className="flex items-center gap-2.5">
          <UtsLogo variant="dark" className="h-6 w-auto shrink-0" />
          <span className="font-mono text-[11px] font-bold tracking-[0.06em]">
            {t('student.passTitle')}
          </span>
        </div>
        {out && (
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-bold">
            <KeyRound size={12} /> {overdue ? t('key.overdueBadge') : `${t('student.returnBefore')} ${fmtTime(booking.end)}`}
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
            {overdue
              ? t('student.passOverdue')
              : out
                ? t('student.passInCustody')
                : t('student.passNotIssued')}
          </span>
          <div>
            <div className="font-mono text-[11px] font-semibold text-meta">ROOM</div>
            <div className="font-display text-[56px] leading-[0.95] font-w450 text-ink">{room?.code}</div>
            <div className="text-[14px] font-semibold text-graphite">{room?.name}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-rule pt-3">
            <div>
              <div className="font-mono text-[10px] font-semibold text-steel">DATE</div>
              <div className="font-mono text-[13px] font-semibold whitespace-nowrap">{fmtDate(booking.start)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] font-semibold text-steel">TIME</div>
              <div className="font-mono text-[13px] font-semibold whitespace-nowrap">{fmtRange(booking.start, booking.end)}</div>
            </div>
            <div className="col-span-2">
              <div className="font-mono text-[10px] font-semibold text-steel">HOLDER</div>
              <div className="truncate text-[13px] font-semibold text-ink">{holder}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] font-semibold text-steel">HCMUT ID</div>
              <div className="font-mono text-[13px] font-semibold text-meta">{resolvedHcmut}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] font-semibold text-steel">UTS ID</div>
              <div className="font-mono text-[13px] font-semibold text-meta">{resolvedUts}</div>
            </div>
            {(() => {
              const memberList = parseBookingMembers(booking)
              if (memberList.length === 0) return null
              return (
                <div className="col-span-2 border-t border-dashed border-rule pt-2 flex flex-col gap-1">
                  <div className="font-mono text-[10px] font-semibold text-steel uppercase">
                    PARTICIPATING MEMBERS ({memberList.length})
                  </div>
                  <div className="flex flex-col gap-1">
                    {memberList.map((m, mi) => (
                      <div key={mi} className="flex items-center justify-between font-mono text-[11px] bg-paper px-2 py-1 rounded-sm border border-rule">
                        <span className="font-sans font-medium text-ink truncate">{m.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                          {m.hcmutId && <span className="text-steel">HCMUT: <strong className="text-ink">{m.hcmutId}</strong></span>}
                          {m.hcmutId && m.utsId && <span>·</span>}
                          {m.utsId && <span className="text-steel">UTS: <strong className="text-accent">{m.utsId}</strong></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
