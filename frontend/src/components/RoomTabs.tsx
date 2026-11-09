import type { Room } from '@/lib/types'
import { cx } from './ui'

export function getRoomColor(code?: string) {
  if (code === '602') {
    return {
      code: '602',
      label: 'Room 602',
      dot: 'bg-slate',
      bar: 'bg-slate',
      badge: 'bg-slate text-white',
      solid: 'border-slate bg-slate text-white',
      soft: 'border-slate bg-ice text-slate',
      pending: 'border-dashed border-2 border-slate bg-ice text-slate hover:bg-reserved',
    }
  }
  if (code === '605') {
    return {
      code: '605',
      label: 'Room 605',
      dot: 'bg-plum',
      bar: 'bg-plum',
      badge: 'bg-plum text-white',
      solid: 'border-plum bg-plum text-white',
      soft: 'border-plum bg-plum/[0.08] text-plum',
      pending: 'border-dashed border-2 border-plum bg-plum/[0.08] text-plum hover:bg-plum/[0.15]',
    }
  }
  return {
    code: '601',
    label: 'Room 601',
    dot: 'bg-accent',
    bar: 'bg-accent',
    badge: 'bg-accent text-white',
    solid: 'border-accent bg-accent text-white',
    soft: 'border-accent bg-tint/50 text-ink-blue',
    pending: 'border-dashed border-2 border-accent bg-tint/30 text-ink-blue hover:bg-tint/50',
  }
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
  const allOn = activeId === 'ALL'
  const totalBadge = rooms.reduce((sum, r) => sum + (badge?.(r.id) ?? 0), 0)

  return (
    <div className="flex w-full items-end gap-1 overflow-visible select-none" role="tablist" data-cursor-zone>
      {showAllTab && (
        <button
          role="tab"
          aria-selected={allOn}
          onClick={() => onChange('ALL')}
          className={cx(
            'relative -mb-px flex flex-1 min-w-0 flex-col items-start gap-0.5 rounded-t-md border px-3 sm:px-4 pt-2.5 pb-2 text-left transition-colors cursor-pointer select-none',
            allOn ? 'z-10 border-ink border-b-paper bg-paper shadow-2xs' : 'border-rule bg-ice hover:border-edge hover:bg-paper',
          )}
        >
          {allOn && <span className="absolute inset-x-[-1px] top-[-1px] h-[3px] rounded-t-md bg-accent" />}
          <span className={cx('flex items-center gap-1.5 sm:gap-2 font-mono text-[13px] sm:text-[14px] font-semibold w-full truncate', allOn ? 'text-ink' : 'text-graphite')}>
            <span className="flex items-center gap-1 shrink-0">
              <span className="h-2 w-2 rounded-sm bg-accent shrink-0" />
              <span className="h-2 w-2 rounded-sm bg-slate shrink-0" />
              <span className="h-2 w-2 rounded-sm bg-plum shrink-0" />
            </span>
            <span className="truncate">[ ALL ROOMS ]</span>
            {totalBadge > 0 && <span className="rounded-sm bg-ink px-1 font-mono text-[10px] leading-[1.5] text-paper shrink-0">{totalBadge}</span>}
          </span>
          <span className="font-mono text-[10px] text-steel truncate w-full">601 · 602 · 605 COMBINED</span>
        </button>
      )}

      {rooms.map((r, i) => {
        const on = r.id === activeId
        const n = badge?.(r.id) ?? 0
        const c = getRoomColor(r.code)
        return (
          <button
            key={r.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(r.id)}
            className={cx(
              'relative -mb-px flex flex-1 min-w-0 flex-col items-start gap-0.5 rounded-t-md border px-3 sm:px-4 pt-2.5 pb-2 text-left transition-colors cursor-pointer select-none',
              on ? 'z-10 border-ink border-b-paper bg-paper shadow-2xs' : 'border-rule bg-ice hover:border-edge hover:bg-paper',
            )}
          >
            {on && <span className={cx('absolute inset-x-[-1px] top-[-1px] h-[3px] rounded-t-md', c.bar)} />}
            <span className={cx('flex items-center gap-1.5 sm:gap-2 font-mono text-[13px] sm:text-[14px] font-semibold w-full truncate', on ? 'text-ink' : 'text-graphite')}>
              <span className={cx('h-2 w-2 rounded-sm shrink-0', c.dot)} />
              <span className="truncate">[ {String(i + 1).padStart(2, '0')} / ROOM {r.code} ]</span>
              {n > 0 && <span className="rounded-sm bg-ink px-1 font-mono text-[10px] leading-[1.5] text-paper shrink-0">{n}</span>}
            </span>
            <span className="font-mono text-[10px] text-steel truncate w-full">{r.status !== 'AVAILABLE' ? r.status : r.name}</span>
          </button>
        )
      })}
    </div>
  )
}
