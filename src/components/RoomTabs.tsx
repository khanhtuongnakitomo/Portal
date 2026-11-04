import type { Room } from '@/lib/types'
import { cx } from './ui'

/** Google Sheets-style room tabs that attach to the calendar sheet below. */
export function RoomTabs({ rooms, activeId, onChange, badge }: { rooms: Room[]; activeId: string; onChange: (id: string) => void; badge?: (roomId: string) => number }) {
  return (
    <div className="scrollbar-thin flex items-end gap-1 overflow-x-auto pl-[64px]" role="tablist" data-cursor-zone>
      {rooms.map((r, i) => {
        const on = r.id === activeId
        const n = badge?.(r.id) ?? 0
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
            {on && <span className="absolute inset-x-[-1px] top-[-1px] h-[3px] rounded-t-md bg-accent" />}
            <span className={cx('flex items-center gap-2 font-mono text-[14px] font-semibold', on ? 'text-ink' : 'text-graphite')}>
              [ {String(i + 1).padStart(2, '0')} / ROOM {r.code} ]
              {n > 0 && <span className="rounded-sm bg-ink px-1 font-mono text-[10px] leading-[1.5] text-paper">{n}</span>}
            </span>
            <span className="font-mono text-[10px] text-steel">{r.status !== 'AVAILABLE' ? r.status : r.autoApprove ? 'AUTO-APPROVE' : 'MANAGER APPROVAL'}</span>
          </button>
        )
      })}
    </div>
  )
}
