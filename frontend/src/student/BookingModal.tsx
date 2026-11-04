import { useEffect, useState } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Room } from '@/lib/types'
import { at, durationMin, fmtDate, fmtDuration, fmtTime, parseHM } from '@/lib/time'
import { Button, Field, Input, LedgerRow, Modal, Select, Textarea, Mono } from '@/components/ui'
import type { Selection } from './WeekCalendar'

export function BookingModal({ room, selection, onClose }: { room: Room; selection: Selection | null; onClose: () => void }) {
  const { createBooking, validateSlot, settings, bookings, currentUser } = useStore()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Prefill contact number from the student's most recent booking
  const lastPhone = bookings.filter((b) => b.userId === currentUser?.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]?.phone ?? ''

  useEffect(() => {
    if (selection) {
      setStart(fmtTime(selection.start))
      setEnd(fmtTime(selection.end))
      setError(null)
      setPurpose('')
      setTitle('')
      setPhone(lastPhone)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

  if (!selection) return null
  const day = selection.start
  const o = parseHM(settings.openTime)
  const c = parseHM(settings.closeTime)
  const times: string[] = []
  for (let m = o.h * 60 + o.m; m <= c.h * 60 + c.m; m += 30) times.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  const toDate = (hm: string) => {
    const { h, m } = parseHM(hm)
    return at(day, h, m)
  }
  const s = toDate(start || fmtTime(selection.start))
  const e = toDate(end || fmtTime(selection.end))
  const dur = durationMin(s, e)
  const slotErr = validateSlot(room.id, s, e)

  const submit = () => {
    const err = createBooking({ roomId: room.id, start: s, end: e, phone, title, purpose })
    if (err) setError(err)
    else onClose()
  }

  return (
    <Modal open onClose={onClose} title="Confirm reservation" eyebrow={`NEW ENTRY · ROOM ${room.code}`} width="max-w-[720px]">
      <div className="grid md:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <Select value={start} onChange={(ev) => setStart(ev.target.value)} className="font-mono">
                {times.slice(0, -1).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="End">
              <Select value={end} onChange={(ev) => setEnd(ev.target.value)} className="font-mono">
                {times.slice(1).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Phone number" hint="for key desk contact">
            <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(ev) => setPhone(ev.target.value)} placeholder="+84 90 123 4567" className="font-mono" />
          </Field>
          <Field label="Booking title" hint={`${title.length}/60`}>
            <Input maxLength={60} value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="e.g. Capstone sprint review" />
          </Field>
          <Field label="Purpose" hint={`${purpose.length}/160`}>
            <Textarea rows={3} maxLength={160} value={purpose} onChange={(ev) => setPurpose(ev.target.value)} placeholder="e.g. Weekly progress review with supervisor and team" />
          </Field>
          {(error || slotErr) && <div className="border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">{error || slotErr}</div>}
        </div>
        <aside className="flex flex-col justify-between gap-6 border-t border-rule bg-ice p-6 md:border-t-0 md:border-l">
          <div>
            <div className="mb-3 font-display text-[44px] leading-none font-w450 text-ink">{room.code}</div>
            <LedgerRow k="Room" v={room.name} />
            <LedgerRow k="Date" v={fmtDate(day)} mono />
            <LedgerRow k="Window" v={`${fmtTime(s)} → ${fmtTime(e)}`} mono />
            <LedgerRow k="Duration" v={dur > 0 ? fmtDuration(dur) : '—'} mono />
          </div>
          <div className="flex gap-2 text-[12px] leading-[1.5] text-graphite">
            <Info size={14} className="mt-0.5 shrink-0 text-accent" />
            {room.autoApprove ? (
              <span>
                Room {room.code} is <Mono className="text-accent">AUTO-APPROVE</Mono>. Your booking is confirmed instantly.
              </span>
            ) : (
              <span>Requests enter the manager approval queue. Once approved, collect the key with your Student ID.</span>
            )}
          </div>
        </aside>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-rule px-6 py-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button size="md" onClick={submit} disabled={!!slotErr || !purpose.trim() || !title.trim() || !phone.trim()}>
          Confirm reservation <ArrowRight size={16} />
        </Button>
      </div>
    </Modal>
  )
}
