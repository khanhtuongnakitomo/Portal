import { useState } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import type { Room } from '@/lib/types'
import { fmtStamp, overlaps } from '@/lib/time'
import { Button, Dialog, Field, StatusChip, Textarea } from '@/components/ui'

interface ConfirmBlockDayModalProps {
  room: Room
  start: Date
  end: Date
  onClose: () => void
  onConfirm: (reason: string, displace: boolean) => Promise<string | null>
}

export function ConfirmBlockDayModal({ room, start, end, onClose, onConfirm }: ConfirmBlockDayModalProps) {
  const { bookings, pendingQueue, blocks, notify } = useStore()
  const { user } = useLookups()
  const { t, locale } = useI18n()
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conflicts = Array.from(new Map([...pendingQueue, ...bookings].map((booking) => [booking.id, booking])).values()).filter((booking) =>
    booking.roomId === room.id && overlaps(booking.start, booking.end, start, end) &&
    (booking.status === 'PENDING' || booking.status === 'APPROVED' || booking.status === 'KEY_CHECKED_OUT'),
  )
  const keysOut = conflicts.some((booking) => booking.status === 'KEY_CHECKED_OUT')
  const existingBlock = blocks.some((block) => block.roomId === room.id && block.active && Date.parse(block.end) > Date.now())
  const affected = conflicts.filter((booking) => booking.status !== 'KEY_CHECKED_OUT')
  const signature = affected.map((booking) => booking.id).sort().join(',')
  const displace = !!signature && signature === confirmed
  const disabled = busy || !reason.trim() || keysOut || existingBlock || (!!signature && !displace)
  const close = () => { if (!busy) onClose() }

  return (
    <Dialog open onClose={close} labelledBy="confirm-block-title" className="max-w-[560px]">
      <form className="flex min-h-0 flex-col" onSubmit={async (event) => {
        event.preventDefault()
        if (disabled) return
        setBusy(true)
        setError(null)
        try {
          const result = await onConfirm(reason.trim(), displace)
          if (result !== null) {
            setConfirmed(null)
            setError(result)
            notify(result, 'error')
          } else {
            onClose()
          }
        } finally {
          setBusy(false)
        }
      }}>
        <header className="flex items-center gap-2 border-b border-rule bg-ice px-5 py-4">
          <Lock size={16} className="text-plum" />
          <h2 id="confirm-block-title" className="font-display text-[18px] text-ink">{t('staff.confirmBlock')}</h2>
        </header>
        <div className="flex flex-col gap-4 overflow-auto p-5">
          <p className="text-[13px] font-semibold">{t('staff.roomNumber', { code: room.code })} · {room.name} · {fmtStamp(start, locale)} → {fmtStamp(end, locale)}</p>
          {conflicts.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border border-plum/40 bg-plum/10 p-3 text-[12px]">
              <h3 className="flex items-center gap-2 font-semibold text-plum"><AlertTriangle size={15} /> {t('staff.slotConflict')}</h3>
              <ul className="max-h-36 space-y-2 overflow-auto">
                {conflicts.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{user(booking.userId)?.fullName ?? booking.title} · {fmtStamp(booking.start, locale)} → {fmtStamp(booking.end, locale)}</span>
                    <StatusChip status={booking.status} />
                  </li>
                ))}
              </ul>
              {keysOut && <p>{t('staff.keysBeforeBlock')}</p>}
              {affected.length > 0 && !keysOut && !existingBlock && (
                <label className="flex items-start gap-2 font-semibold">
                  <input type="checkbox" checked={displace} disabled={busy} onChange={(event) => setConfirmed(event.target.checked ? signature : null)} />
                  {t('staff.blockDisplacement', { count: affected.length })}
                </label>
              )}
            </div>
          )}
          {existingBlock && <p className="text-[12px] text-plum">{t('staff.blockExists')}</p>}
          <Field label={t('common.reason')} hint={t('common.required')} error={error}>
            <Textarea rows={2} required value={reason} disabled={busy} onChange={(event) => { setReason(event.target.value); setError(null) }} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {['maintenance', 'symposium', 'sanitation', 'exams', 'holiday'].map((key) => {
              const preset = t(`staff.blockPreset_${key}`)
              return <Button key={key} type="button" size="xs" variant="outline" disabled={busy} onClick={() => { setReason(preset); setError(null) }}>{preset}</Button>
            })}
          </div>
        </div>
        <footer className="flex justify-between gap-2 border-t border-rule bg-ice/40 px-5 py-3">
          <Button type="button" variant="outline" disabled={busy} onClick={close}>{t('common.cancel')}</Button>
          <Button type="submit" variant="plum" disabled={disabled}>{busy ? t('common.loading') : t('staff.createBlock')}</Button>
        </footer>
      </form>
    </Dialog>
  )
}
