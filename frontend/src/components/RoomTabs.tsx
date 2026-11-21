import type { CSSProperties } from 'react'
import type { Room } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { cx } from './ui'

const ROOM_COLORS = [
  { dot: 'bg-room-1', style: { '--room-color': 'var(--color-room-1)' } as CSSProperties },
  { dot: 'bg-room-2', style: { '--room-color': 'var(--color-room-2)' } as CSSProperties },
  { dot: 'bg-room-3', style: { '--room-color': 'var(--color-room-3)' } as CSSProperties },
]

export function roomColor(roomOrIndex: Room | number) {
  const index = typeof roomOrIndex === 'number' ? roomOrIndex : roomOrIndex.code === '602' ? 1 : roomOrIndex.code === '605' ? 2 : 0
  return ROOM_COLORS[index % ROOM_COLORS.length] ?? ROOM_COLORS[0]
}

/** Google Sheets-style room tabs that attach to the calendar sheet below. */
export function RoomTabs({
  rooms,
  activeId,
  onChange,
  badge,
  showAllTab = true,
}: {
  rooms: Room[]
  activeId: string
  onChange: (id: string) => void
  badge?: (roomId: string) => number
  showAllTab?: boolean
}) {
  const { t } = useI18n()
  const allOn = activeId === 'ALL'
  const totalBadge = rooms.reduce((sum, r) => sum + (badge?.(r.id) ?? 0), 0)

  return (
    <div className="flex w-full items-end gap-1 overflow-visible select-none" role="tablist" data-cursor-zone>
      {showAllTab && (
        <button
          type="button"
          role="tab"
          aria-selected={allOn}
          onClick={() => onChange('ALL')}
          className={cx(
            'relative -mb-px flex flex-1 min-w-0 flex-col items-start gap-0.5 rounded-t-md border px-3 sm:px-4 pt-2.5 pb-2 text-left transition-colors cursor-pointer select-none',
            allOn ? 'z-10 border-ink border-b-paper bg-paper shadow-2xs' : 'border-rule bg-ice hover:border-edge hover:bg-paper',
          )}
        >
          {allOn && <span className="absolute inset-x-[-1px] top-[-1px] h-[3px] rounded-t-md bg-accent" />}
          <span className={cx('flex items-center gap-2 font-mono text-[14px] font-semibold', allOn ? 'text-ink' : 'text-graphite')}>
            <span className="flex items-center gap-1">
              {rooms.map((r) => (
                <span key={r.id} className={cx('h-2.5 w-2.5 shrink-0 rounded-full', roomColor(r).dot)} />
              ))}
            </span>
            <span className="truncate">[ {t('student.allRooms')} ]</span>
            {totalBadge > 0 && <span className="rounded-sm bg-ink px-1 font-mono text-[10px] leading-[1.5] text-paper shrink-0">{totalBadge}</span>}
          </span>
          <span className="font-mono text-[10px] text-steel">{t('core.combined', { rooms: rooms.map((r) => r.code).join(' · ') })}</span>
        </button>
      )}

      {rooms.map((r, i) => {
        const on = r.id === activeId
        const n = badge?.(r.id) ?? 0
        const c = roomColor(r)
        return (
          <button
            type="button"
            key={r.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(r.id)}
            className={cx(
              'relative -mb-px flex flex-1 min-w-0 flex-col items-start gap-0.5 rounded-t-md border px-3 sm:px-4 pt-2.5 pb-2 text-left transition-colors cursor-pointer select-none',
              on ? 'z-10 border-ink border-b-paper bg-paper shadow-2xs' : 'border-rule bg-ice hover:border-edge hover:bg-paper',
            )}
          >
            {on && <span className={cx('absolute inset-x-[-1px] top-[-1px] h-[3px] rounded-t-md', c.dot)} />}
            <span className={cx('flex items-center gap-2 font-mono text-[14px] font-semibold', on ? 'text-ink' : 'text-graphite')}>
              <span className={cx('h-2.5 w-2.5 rounded-full shrink-0', c.dot)} />
              [ {String(i + 1).padStart(2, '0')} / {t('common.room')} {r.code} ]
              {n > 0 && <span className="rounded-sm bg-ink px-1 font-mono text-[10px] leading-[1.5] text-paper">{n}</span>}
            </span>
            <span className="font-mono text-[10px] text-steel truncate w-full">{r.status !== 'AVAILABLE' ? t(`core.${r.status}`) : r.name}</span>
          </button>
        )
      })}
    </div>
  )
}
