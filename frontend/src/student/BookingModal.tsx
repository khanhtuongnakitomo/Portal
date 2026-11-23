import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Info, Plus, Trash2, Users } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import type { BookingMember, Room } from '@/lib/types'
import { addDays, at, dayKey, durationMin, fmtDate, fmtDuration, fmtTime, fromLocalInput, overlaps, parseHM } from '@/lib/time'
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
  const { createBooking, validateSlot, settings, bookings, notify, currentUser, setVisibleRange } = useStore()
  const { t, locale } = useI18n()
  const availableRooms = rooms?.length ? rooms : [room]
  const [selectedRoomId, setSelectedRoomId] = useState(selection.roomId ?? room.id)
  const [date, setDate] = useState(() => dayKey(selection.start))
  const [start, setStart] = useState(() => fmtTime(selection.start))
  const [end, setEnd] = useState(() => fmtTime(selection.end))
  const [attendees, setAttendees] = useState('1')
  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState('')
  const [memberList, setMemberList] = useState<BookingMember[]>([
    { hcmutId: '', utsId: '' },
  ])
  const [confirmed, setConfirmed] = useState(false)
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
  const validEndTimes = (from: string) => endTimes.filter((value) => {
    const minutes = durationMin(toDate(from), toDate(value))
    return minutes > 0 && minutes <= settings.maxDurationMinutes
  })
  const toDate = (hm: string) => {
    const { h, m } = parseHM(hm)
    return at(day, h, m)
  }
  const s = toDate(start)
  const e = toDate(end)
  const dur = durationMin(s, e)
  const endOptions = validEndTimes(start)

  const handleStartChange = (newStart: string) => {
    setStart(newStart)
    const options = validEndTimes(newStart)
    if (!options.includes(end)) setEnd(options[0] ?? newStart)
    setError(null)
  }

  const activeRoom = availableRooms.find((r) => r.id === selectedRoomId) ?? room
  const slotErr = !chosenDay ? t('student.chooseDate') : validateSlot(activeRoom.id, s, e)
  const attendeeCount = Number(attendees)
  const validCount = Number.isInteger(attendeeCount) && attendeeCount >= 1 && attendeeCount <= activeRoom.capacity
  const requireMembers = currentUser?.role === 'USER'
  const validMemberList = memberList.map(({ hcmutId, utsId }) => ({ hcmutId: hcmutId.trim(), utsId: utsId.trim() }))
    .filter((member) => member.hcmutId || member.utsId)
  const validMembers = validMemberList.length === memberList.length || (!requireMembers && memberList.length === 1 && validMemberList.length === 0)
  const canSubmit = !pending && !slotErr && validCount && validMembers && confirmed && !!title.trim() && !!purpose.trim()

  const updateMember = (index: number, field: 'hcmutId' | 'utsId', value: string) => {
    setMemberList((entries) => entries.map((entry, i) => i === index ? { ...entry, [field]: value } : entry))
  }

  const competingPending = bookings.filter(
    (b) => b.roomId === activeRoom.id && b.status === 'PENDING' && !b.isMine && overlaps(b.start, b.end, s, e),
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    setPending(true)
    try {
      const error = await createBooking({ roomId: activeRoom.id, start: s, end: e, title, purpose, attendeeCount, memberList: validMemberList })
      if (error) {
        setError(error)
        notify(error, 'error')
      } else {
        notify(t('student.reservationSubmitted'))
        onClose()
      }
    } finally {
      setPending(false)
    }
  }

  const hcmutId = currentUser?.hcmutId || currentUser?.studentCode || '—'
  const utsId = currentUser?.utsId || '—'

  return (
    <Modal open onClose={() => { if (!pending) onClose() }} title={t('bookingModal.modalTitle')} eyebrow={`${t('bookingModal.modalEyebrow')} · ${t('student.roomCode', { code: activeRoom.code })}`} width="max-w-[740px]">
      <form onSubmit={submit}>
      <div className="grid md:grid-cols-[1fr_260px]">
        <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3.5 p-4 sm:p-5">
          {allowRoomChange && availableRooms.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-[11px] text-steel">{t('student.selectRoom')}</div>
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
                        <span className={cx('h-2 w-2 shrink-0 rounded-sm', rc.dot)} />
                        {t('student.roomCode', { code: r.code })}
                      </div>
                      <div className="font-mono text-[10px] text-steel">
                        {t(errCheck ? 'student.unavailable' : 'student.available')}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <Field label={t('common.date')}>
            <Input type="date" value={date} min={dayKey(new Date())} max={dayKey(addDays(new Date(), settings.maxAdvanceDays))} required onChange={(ev) => { setDate(ev.target.value); setError(null) }} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('student.startTime')} hint={`${settings.openTime}–${settings.closeTime}`}>
              <Select value={start} onChange={(ev) => handleStartChange(ev.target.value)} className="font-mono">
                {!startTimes.includes(start) && <option value={start}>{start}</option>}
                {startTimes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('student.endTime')} hint={t('student.durationLimit', { duration: fmtDuration(settings.maxDurationMinutes, locale) })}>
              <Select value={end} onChange={(ev) => { setEnd(ev.target.value); setError(null) }} className="font-mono">
                {!endOptions.includes(end) && <option value={end}>{end}</option>}
                {endOptions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t('bookingModal.attendeesLabel')} hint={`1–${activeRoom.capacity}`}>
            <Input type="number" min={1} max={activeRoom.capacity} step={1} required value={attendees} onChange={(ev) => setAttendees(ev.target.value)} />
          </Field>
          <Field label={t('bookingModal.titleLabel')} hint={`${title.length}/60`}>
            <Input maxLength={60} value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder={t('bookingModal.titlePlaceholder')} />
          </Field>
          <Field label={t('bookingModal.purposeLabel')} hint={`${purpose.length}/160`}>
            <Textarea rows={2} maxLength={160} value={purpose} onChange={(ev) => setPurpose(ev.target.value)} placeholder={t('bookingModal.purposePlaceholder')} />
          </Field>
          {/* Mandatory Member Student IDs Form */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <Users size={14} className="text-steel" />
                <span>{t('bookingModal.membersLabel')}</span>
                <span className="font-mono text-[10px] font-bold text-plum bg-plum/[0.08] px-1.5 py-0.2 rounded-sm border border-plum/20">
                  {t(requireMembers ? 'bookingModal.membersRequired' : 'common.optional')}
                </span>
              </span>
              <span className="font-mono text-[11px] text-steel">
                {t('student.membersAdded', { count: validMemberList.length })}
              </span>
            </div>

            <div className="rounded-md border border-edge bg-ice/40 p-2.5 sm:p-3 flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                {memberList.map((m, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-rule bg-paper p-2.5 flex flex-col gap-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-rule/50 pb-1.5">
                      <span className="font-mono text-[11px] font-bold text-ink flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-accent text-paper text-[10px]">
                          {idx + 1}
                        </span>
                        <span>{t('bookingModal.memberNum')} #{idx + 1}</span>
                      </span>
                      {memberList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setMemberList((entries) => entries.filter((_, i) => i !== idx))}
                          className="text-steel hover:text-plum p-1 rounded-sm hover:bg-plum/10 cursor-pointer transition-colors text-[11px] flex items-center gap-1 font-mono"
                          aria-label={t('student.removeMember', { count: idx + 1 })}
                        >
                          <Trash2 size={13} />
                          <span>{t('common.remove')}</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label htmlFor={`hcmut-member-${idx}`} className="block font-mono text-[10px] font-semibold text-steel mb-1">
                          {t('bookingModal.hcmutIdCol')}
                        </label>
                        <Input
                          id={`hcmut-member-${idx}`}
                          inputMode="numeric"
                          pattern="[0-9]{7}"
                          placeholder="2110124"
                          value={m.hcmutId}
                          onChange={(ev) => updateMember(idx, 'hcmutId', ev.target.value)}
                          className="!py-1.5 font-mono text-[13px]"
                          maxLength={7}
                        />
                      </div>

                      <div>
                        <label htmlFor={`uts-member-${idx}`} className="block font-mono text-[10px] font-semibold text-steel mb-1">
                          {t('bookingModal.utsIdCol')}
                        </label>
                        <Input
                          id={`uts-member-${idx}`}
                          inputMode="numeric"
                          pattern="[0-9]{8}"
                          placeholder="14234568"
                          value={m.utsId}
                          onChange={(ev) => updateMember(idx, 'utsId', ev.target.value)}
                          className="!py-1.5 font-mono text-[13px]"
                          maxLength={8}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t border-rule/70 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberList((entries) => [...entries, { hcmutId: '', utsId: '' }])}
                  className="inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap rounded-sm border border-edge bg-paper px-3 py-1.5 font-mono text-[11.5px] font-bold text-ink hover:border-ink hover:bg-ice transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus size={13} /> <span>{t('bookingModal.addMemberBtn')}</span>
                </button>
                <span className="font-mono text-[10px] text-steel leading-relaxed sm:text-right">
                  {t(requireMembers ? 'bookingModal.membersHint' : 'student.membersOptionalHint')}
                </span>
              </div>
            </div>
          </div>

          {/* Mandatory Responsibility Confirmation */}
          <div className="rounded-md border border-[#E0E0E0] bg-[#F4F5F7] p-2.5 sm:p-3">
            <label className="flex cursor-pointer items-start gap-2.5 select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(ev) => setConfirmed(ev.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#0F62FE]"
              />
              <span className="text-[12px] sm:text-[12.5px] leading-[1.45] font-medium text-ink">
                {t('bookingModal.responsibilityText')}
              </span>
            </label>
          </div>

          {competingPending.length > 0 && (
            <div className="border border-amber bg-amber-soft px-3 py-2 text-[12.5px] text-ink">
              {t('student.competingNotice', { count: competingPending.length })}
            </div>
          )}

          {(error || slotErr) && <div role="alert" className="border-l-2 border-plum bg-plum/[0.06] px-3 py-2 text-[13px] font-medium text-plum">{error || slotErr}</div>}
        </fieldset>
        <aside className="flex flex-col justify-between gap-5 border-t border-rule bg-ice p-4 sm:p-5 md:border-t-0 md:border-l">
          <div>
            <div className="mb-2.5 font-display text-[38px] leading-none font-w450 text-ink">{activeRoom.code}</div>
            <LedgerRow k={t('common.room')} v={activeRoom.name} />
            <LedgerRow k={t('common.date')} v={fmtDate(day, locale)} mono />
            <LedgerRow k={t('bookingModal.timeLabel')} v={`${fmtTime(s)} → ${fmtTime(e)}`} mono />
            <LedgerRow k={t('common.duration')} v={dur > 0 ? fmtDuration(dur, locale) : '—'} mono />
            <LedgerRow k={t('student.hcmutId')} v={hcmutId} mono />
            <LedgerRow k={t('student.utsId')} v={utsId} mono />
            <LedgerRow k={t('student.members')} v={t('student.membersAdded', { count: validMemberList.length })} mono />
          </div>
          <div className="flex gap-2 text-[11.5px] leading-[1.5] text-graphite">
            <Info size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>{t('student.pickupInstructions')}</span>
          </div>
        </aside>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-rule px-6 py-4">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="md" variant="accent" disabled={!canSubmit}>
          {t(pending ? 'student.submitting' : 'bookingModal.submitBtn')} <ArrowRight size={16} />
        </Button>
      </div>
      </form>
    </Modal>
  )
}
