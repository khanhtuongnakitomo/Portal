import { useState } from 'react'
import { Ban, Clock, User, X } from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import type { RoomBlock } from '@/lib/types'
import { durationMin, fmtDate, fmtDuration, fmtRange, fmtStamp, sameDay } from '@/lib/time'
import { Button, Dialog, Eyebrow, cx } from '@/components/ui'

interface BlockInspectorModalProps {
  block: RoomBlock | null
  onClose: () => void
}

export function BlockInspectorModal({ block, onClose }: BlockInspectorModalProps) {
  const { cancelBlock, notify } = useStore()
  const { room, user } = useLookups()

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!block) return null

  const r = room(block.roomId)
  const creator = user(block.createdBy)
  const s = new Date(block.start)
  const e = new Date(block.end)
  const dur = durationMin(s, e)

  const close = () => { if (!pending) onClose() }
  const handleCancel = async () => {
    if (pending) return
    setError(null)
    setPending(true)
    try {
      const error = await cancelBlock(block.roomId, { start: s, end: e })
      if (error) {
        setError(error)
        notify(error, 'error')
      } else {
        notify('Room block cancelled. Slots released.')
        onClose()
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onClose={close} labelledBy="block-inspector-title" className="max-w-[480px]">
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
            onClick={close}
            disabled={pending}
            aria-label="Close"
            className="rounded-[4px] p-1.5 text-steel hover:bg-paper hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between border-b border-rule/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[20px] font-bold text-ink">
                RM {r?.code}
              </span>
              <span className="font-mono text-[12px] text-steel">
                · {r?.name} (Cap {r?.capacity})
              </span>
            </div>
            <span
              className={cx(
                'rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-bold',
                block.active ? 'bg-plum text-paper' : 'bg-edge text-steel',
              )}
            >
              {block.active ? 'ACTIVE BLOCK' : 'CANCELLED'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 rounded-[4px] border border-rule bg-ice/40 p-3">
            <div className="flex items-center gap-2 font-mono text-[12px] text-ink font-semibold">
              <Clock size={14} className="text-steel" />
              <span>{sameDay(s, e) ? `${fmtDate(s)} · ${fmtRange(block.start, block.end)}` : `${fmtStamp(s)} – ${fmtStamp(e)}`}</span>
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

          {error && <p role="alert" className="text-[13px] font-semibold text-plum">{error}</p>}

          {/* Action Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-rule pt-4">
            <Button variant="outline" size="sm" onClick={close} disabled={pending}>
              Close
            </Button>

            {block.active && (
              <Button variant="plum" size="sm" onClick={handleCancel} disabled={pending} className="gap-1.5">
                <Ban size={14} /> Cancel & Release Block
              </Button>
            )}
          </div>
        </div>
    </Dialog>
  )
}
