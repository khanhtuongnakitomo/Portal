import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Ban, Clock, MapPin, Undo2, User, X } from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import type { RoomBlock } from '@/lib/types'
import { durationMin, fmtDate, fmtDuration, fmtRange } from '@/lib/time'
import { Button, Eyebrow, cx } from '@/components/ui'

interface BlockInspectorModalProps {
  block: RoomBlock | null
  onClose: () => void
}

export function BlockInspectorModal({ block, onClose }: BlockInspectorModalProps) {
  const { blocks, cancelBlock, notify } = useStore()
  const { room, user } = useLookups()

  useEffect(() => {
    if (!block) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [block, onClose])

  if (!block) return null

  const isAll = block.roomId === 'ALL'
  const r = !isAll ? room(block.roomId) : undefined
  const creator = user(block.createdBy)
  const s = new Date(block.start)
  const e = new Date(block.end)
  const dur = durationMin(s, e)

  const handleCancel = () => {
    if (isAll) {
      const matching = blocks.filter((b) => b.active && b.start === block.start && b.end === block.end)
      matching.forEach((b) => cancelBlock(b.id))
      notify('All room blocks cancelled. Slots released.')
    } else {
      cancelBlock(block.id)
      notify(`Room ${r?.code ?? ''} block cancelled. Slots released.`)
    }
    onClose()
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-inspector-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative z-10 w-full max-w-[480px] overflow-hidden rounded-lg border border-ink bg-paper shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule bg-ice px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <Eyebrow>ROOM BLOCK INSPECTOR</Eyebrow>
            <h2 id="block-inspector-title" className="font-display text-[18px] font-w450 text-ink">
              Block details & slot management
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[4px] p-1.5 text-steel hover:bg-paper hover:text-ink cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between border-b border-rule/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[20px] font-bold text-ink">
                {isAll ? 'ALL ROOMS' : `RM ${r?.code}`}
              </span>
              <span className="font-mono text-[12px] text-steel">
                · {isAll ? 'Rooms 601, 602, 605' : `${r?.name} (Cap ${r?.capacity})`}
              </span>
            </div>
            <span
              className={cx(
                'rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-bold',
                block.active ? 'bg-plum text-paper' : 'bg-edge text-steel',
              )}
            >
              {block.active ? (isAll ? 'ALL ROOMS LOCKED' : 'ACTIVE BLOCK') : 'CANCELLED'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 rounded-[4px] border border-rule bg-ice/40 p-3">
            <div className="flex items-center gap-2 font-mono text-[12px] text-ink font-semibold">
              <Clock size={14} className="text-steel" />
              <span>{fmtDate(s)}</span>
              <span>· {fmtRange(s, e)}</span>
              <span className="rounded-[2px] bg-paper px-1.5 py-0.2 font-mono text-[10px] text-steel border border-rule">
                {fmtDuration(dur)}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-steel">
              <User size={13} />
              <span>Created by {creator?.fullName ?? block.createdBy}</span>
              <span>({block.id})</span>
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] font-semibold text-steel uppercase">
              Reason / Activity Description
            </div>
            <div className="mt-1 rounded-[4px] border border-rule bg-paper p-3 text-[13px] font-medium text-ink leading-relaxed">
              {block.reason}
            </div>
          </div>

          {block.active && (
            <p className="font-mono text-[11px] text-steel">
              Cancelling this block will immediately release the time slot back into the bookable pool for students and managers.
            </p>
          )}

          {/* Action Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-rule pt-4">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>

            {block.active && (
              <Button variant="plum" size="sm" onClick={handleCancel} className="gap-1.5">
                <Ban size={14} /> Cancel & Release Block
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
