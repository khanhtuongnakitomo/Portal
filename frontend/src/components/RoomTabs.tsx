import type { Room } from '@/lib/types'
import { cx } from './ui'

export function getRoomColor(code?: string) {
  if (code === '602') {
    return {
      code: '602',
      label: 'Room 602',
      dot: 'bg-emerald-600',
      bar: 'bg-emerald-600',
      badge: 'bg-emerald-600 text-white',
      solid: 'border-emerald-700 bg-emerald-600 text-white',
      soft: 'border-emerald-600 bg-emerald-500/15 text-emerald-950',
      pending: 'border-dashed border-2 border-emerald-600 bg-emerald-500/12 text-emerald-950 hover:bg-emerald-500/20',
    }
  }
  if (code === '605') {
    return {
      code: '605',
      label: 'Room 605',
      dot: 'bg-violet-600',
      bar: 'bg-violet-600',
      badge: 'bg-violet-600 text-white',
      solid: 'border-violet-700 bg-violet-600 text-white',
      soft: 'border-violet-600 bg-violet-500/15 text-violet-950',
      pending: 'border-dashed border-2 border-violet-600 bg-violet-500/12 text-violet-950 hover:bg-violet-500/20',
    }
  }
  return {
    code: '601',
    label: 'Room 601',
    dot: 'bg-blue-600',
    bar: 'bg-blue-600',
    badge: 'bg-blue-600 text-white',
    solid: 'border-blue-700 bg-blue-600 text-white',
    soft: 'border-blue-600 bg-blue-500/15 text-blue-950',
    pending: 'border-dashed border-2 border-blue-600 bg-blue-500/12 text-blue-950 hover:bg-blue-500/20',
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
    <div className="scrollbar-thin flex items-end gap-1 overflow-x-auto pl-[64px]" role="tablist" data-cursor-zone>
      {showAllTab && (
        <button
          role="tab"
          aria-selected={allOn}
          onClick={() => onChange('ALL')}
          className={cx(
            'relative -mb-px flex shrink-0 flex-col items-start gap-0.5 rounded-t-md border px-4 pt-2.5 pb-2 text-left transition-colors',
            allOn ? 'z-10 border-ink border-b-paper bg-paper' : 'border-rule bg-ice hover:border-edge hover:bg-paper',
          )}
        >
          {allOn && <span className="absolute inset-x-[-1px] top-[-1px] h-[3px] rounded-t-md bg-accent" />}
          <span className={cx('flex items-center gap-2 font-mono text-[14px] font-semibold', allOn ? 'text-ink' : 'text-graphite')}>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shrink-0" />
              <span className="h-2.5 w-2.5 rounded-full bg-violet-600 shrink-0" />
            </span>
            [ ALL ROOMS ]
            {totalBadge > 0 && <span className="rounded-sm bg-ink px-1 font-mono text-[10px] leading-[1.5] text-paper">{totalBadge}</span>}
          </span>
          <span className="font-mono text-[10px] text-steel">601 · 602 · 605 COMBINED</span>
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
              'relative -mb-px flex shrink-0 flex-col items-start gap-0.5 rounded-t-md border px-4 pt-2.5 pb-2 text-left transition-colors',
              on ? 'z-10 border-ink border-b-paper bg-paper' : 'border-rule bg-ice hover:border-edge hover:bg-paper',
            )}
          >
            {on && <span className={cx('absolute inset-x-[-1px] top-[-1px] h-[3px] rounded-t-md', c.bar)} />}
            <span className={cx('flex items-center gap-2 font-mono text-[14px] font-semibold', on ? 'text-ink' : 'text-graphite')}>
              <span className={cx('h-2.5 w-2.5 rounded-full shrink-0', c.dot)} />
              [ {String(i + 1).padStart(2, '0')} / ROOM {r.code} ]
              {n > 0 && <span className="rounded-sm bg-ink px-1 font-mono text-[10px] leading-[1.5] text-paper">{n}</span>}
            </span>
            <span className="font-mono text-[10px] text-steel">{r.status !== 'AVAILABLE' ? r.status : r.name}</span>
          </button>
        )
      })}
    </div>
  )
}
