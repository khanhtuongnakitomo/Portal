import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Room } from '@/lib/types'
import { addDays, at, dayKey, durationMin, fmtDate, fmtDuration, fmtTime, fromLocalInput, overlaps, parseHM, toLocalInput } from '@/lib/time'
import { Button, Field, Input, LedgerRow, Modal, Select, Textarea, cx } from '@/components/ui'
import type { Selection } from './WeekCalendar'
import { roomColor } from '@/components/RoomTabs'

export function BookingModal({
  room,
  rooms,
  allowRoomChange,
  selection,
  onClose,
}: {
  room: Room
  rooms?: Room[]
  allowRoomChange?: boolean
  selection: Selection
  onClose: () => void
}) {
  const { createBooking, validateSlot, settings, bookings, notify, setVisibleRange } = useStore()
  const availableRooms = rooms?.length ? rooms : [room]
  const [selectedRoomId, setSelectedRoomId] = useState(selection.roomId ?? room.id)
  const [date, setDate] = useState(() => toLocalInput(selection.start).slice(0, 10))
  const [start, setStart] = useState(() => fmtTime(selection.start))
  const [end, setEnd] = useState(() => fmtTime(selection.end))
  const [attendees, setAttendees] = useState('1')
  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const day = fromLocalInput(date)
    if (day) setVisibleRange(day, addDays(day, 1))
  }, [date, setVisibleRange])

  const chosenDay = fromLocalInput(date)
  const day = chosenDay ?? selection.start
  const o = parseHM(settings.openTime)
  const c = parseHM(settings.closeTime)
  const times: string[] = []
  for (let m = o.h * 60 + o.m; m < c.h * 60 + c.m; m += 30) times.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  times.push(settings.closeTime)
  const startTimes = times.slice(0, -1)
  const endTimes = times.slice(1)
  const toDate = (hm: string) => {
    const { h, m } = parseHM(hm)
    return at(day, h, m)
  }
  const s = toDate(start)
  const e = toDate(end)
  const dur = durationMin(s, e)

  const activeRoom = availableRooms.find((r) => r.id === selectedRoomId) ?? room
  const slotErr = !chosenDay ? 'Choose a date.' : validateSlot(activeRoom.id, s, e)
  const attendeeCount = Number(attendees)
  const validCount = Number.isInteger(attendeeCount) && attendeeCount >= 1 && attendeeCount <= activeRoom.capacity

  const competingPending = bookings.filter(
    (b) => b.roomId === activeRoom.id && b.status === 'PENDING' && !b.isMine && overlaps(b.start, b.end, s, e),
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending || slotErr || !validCount || !title.trim() || !purpose.trim()) return
    setError(null)
    setPending(true)
    try {
      const error = await createBooking({ roomId: activeRoom.id, start: s, end: e, title, purpose, attendeeCount })
      if (error) {
        setError(error)
        notify(error, 'error')
      } else {
        notify('Reservation submitted.')
        onClose()
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal open onClose={() => { if (!pending) onClose() }} title="Confirm reservation" eyebrow={`NEW ENTRY · ROOM ${activeRoom.code}`} width="max-w-[720px]">
      <form onSubmit={submit}>
      <div className="grid md:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4 p-6">
          {allowRoomChange && availableRooms.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-[11px] text-steel">SELECT ROOM</div>
              <div className="grid grid-cols-3 gap-2">
                {availableRooms.map((r) => {
                  const rc = roomColor(r)
                  const isSel = r.id === activeRoom.id
                  const errCheck = validateSlot(r.id, s, e)
                  return (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={isSel}
                      disabled={pending}
                      onClick={() => { setSelectedRoomId(r.id); setError(null) }}
                      className={cx(
                        'flex flex-col items-start rounded-md border p-2 text-left transition-all',
                        isSel ? 'border-accent bg-tint text-ink-blue' : 'border-rule bg-ice hover:border-edge',
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-mono text-[13px] font-semibold">
                        <span className={cx('h-2 w-2 rounded-full', rc.dot)} />
                        Room {r.code}
                      </div>
                      <div className="font-mono text-[10px] text-steel">
                        {errCheck ? 'Unavailable' : 'Available'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <Field label="Date">
            <Input type="date" value={date} min={dayKey(new Date())} max={dayKey(addDays(new Date(), settings.maxAdvanceDays))} required onChange={(ev) => { setDate(ev.target.value); setError(null) }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <Select value={start} onChange={(ev) => { setStart(ev.target.value); setError(null) }} className="font-mono">
                {!startTimes.includes(start) && <option value={start}>{start}</option>}
                {startTimes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="End">
              <Select value={end} onChange={(ev) => { setEnd(ev.target.value); setError(null) }} className="font-mono">
                {!endTimes.includes(end) && <option value={end}>{end}</option>}
                {endTimes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Attendees" hint={`1–${activeRoom.capacity}`}>
            <Input type="number" min={1} max={activeRoom.capacity} step={1} required value={attendees} onChange={(ev) => setAttendees(ev.target.value)} />
          </Field>
          <Field label="Booking title" hint={`${title.length}/60`}>
            <Input maxLength={60} value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="e.g. Capstone sprint review" />
          </Field>
          <Field label="Purpose" hint={`${purpose.length}/160`}>
            <Textarea rows={3} maxLength={160} value={purpose} onChange={(ev) => setPurpose(ev.target.value)} placeholder="e.g. Weekly progress review with supervisor and team" />
          </Field>

          {competingPending.length > 0 && (
            <div className="border border-amber bg-amber-soft px-3.5 py-2.5 text-[13px] text-ink">
              ⚡ {competingPending.length} other student request(s) are currently pending approval for this time window. You may still submit a competing request — the Manager will review all requests and approve one.
            </div>
          )}

          {(error || slotErr) && <div role="alert" className="border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">{error || slotErr}</div>}
        </div>
        <aside className="flex flex-col justify-between gap-6 border-t border-rule bg-ice p-6 md:border-t-0 md:border-l">
          <div>
            <div className="mb-3 font-display text-[44px] leading-none font-w450 text-ink">{activeRoom.code}</div>
            <LedgerRow k="Room" v={activeRoom.name} />
            <LedgerRow k="Date" v={fmtDate(day)} mono />
            <LedgerRow k="Window" v={`${fmtTime(s)} → ${fmtTime(e)}`} mono />
            <LedgerRow k="Duration" v={dur > 0 ? fmtDuration(dur) : '—'} mono />
          </div>
          <div className="flex gap-2 text-[12px] leading-[1.5] text-graphite">
            <Info size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>Requests may need manager approval. Once approved, collect the key with your Student ID.</span>
          </div>
        </aside>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-rule px-6 py-4">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="md" disabled={pending || !!slotErr || !validCount || !purpose.trim() || !title.trim()}>
          {pending ? 'Submitting…' : 'Confirm reservation'} <ArrowRight size={16} />
        </Button>
      </div>
      </form>
    </Modal>
  )
}
