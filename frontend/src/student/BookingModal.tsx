import { useEffect, useState } from 'react'
import { ArrowRight, Info, Plus, Trash2, Users } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import type { BookingMember, Room } from '@/lib/types'
import { at, durationMin, fmtDate, fmtDuration, fmtTime, parseHM } from '@/lib/time'
import { Button, Field, Input, LedgerRow, Modal, Select, Textarea, cx } from '@/components/ui'
import type { Selection } from './WeekCalendar'
import { getRoomColor } from '@/components/RoomTabs'

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
  selection: Selection | null
  onClose: () => void
}) {
  const { createBooking, validateSlot, settings, bookings, currentUser } = useStore()
  const { t, locale } = useI18n()
  const availableRooms = rooms && rooms.length > 0 ? rooms : [room]
  const [selectedRoomId, setSelectedRoomId] = useState(room.id)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState('')
  const [memberList, setMemberList] = useState<BookingMember[]>([
    { hcmutId: '', utsId: '' },
  ])
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Prefill contact number from the student's most recent booking
  const lastPhone = bookings.filter((b) => b.userId === currentUser?.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]?.phone ?? ''

  useEffect(() => {
    setSelectedRoomId(room.id)
  }, [room.id, selection])

  useEffect(() => {
    if (selection) {
      setStart(fmtTime(selection.start))
      // Clamp initial selection end to max 120 minutes from start
      const selDur = durationMin(selection.start, selection.end)
      if (selDur > 120) {
        const clampedEnd = new Date(selection.start.getTime() + 120 * 60000)
        setEnd(fmtTime(clampedEnd))
      } else {
        setEnd(fmtTime(selection.end))
      }
      setError(null)
      setPurpose('')
      setTitle('')
      setMemberList([{ hcmutId: '', utsId: '' }])
      setConfirmed(false)
      setPhone(lastPhone)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

  const addMemberRow = () => {
    setMemberList((prev) => [...prev, { hcmutId: '', utsId: '' }])
  }

  const updateMember = (index: number, field: 'hcmutId' | 'utsId', value: string) => {
    setMemberList((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    )
  }

  const removeMember = (index: number) => {
    setMemberList((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  if (!selection) return null
  const day = selection.start
  const o = parseHM(settings.openTime)
  const c = parseHM(settings.closeTime)
  const times: string[] = []
  for (let m = o.h * 60 + o.m; m <= c.h * 60 + c.m; m += 30) {
    times.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }

  const toDate = (hm: string) => {
    const { h, m } = parseHM(hm)
    return at(day, h, m)
  }

  const activeStartStr = start || fmtTime(selection.start)
  const startMinutes = (() => {
    const { h, m } = parseHM(activeStartStr)
    return h * 60 + m
  })()

  // End time dropdown only lists slots up to 2 hours (120 mins) after Start time
  const validEndTimes = times.filter((t) => {
    const { h, m } = parseHM(t)
    const tMin = h * 60 + m
    return tMin > startMinutes && tMin - startMinutes <= 120
  })

  const s = toDate(activeStartStr)
  const e = toDate(end || fmtTime(selection.end))
  const dur = durationMin(s, e)
  const overMaxDuration = dur > 120

  const handleStartChange = (newStart: string) => {
    setStart(newStart)
    const { h: sh, m: sm } = parseHM(newStart)
    const sMin = sh * 60 + sm
    const { h: eh, m: em } = parseHM(end || fmtTime(selection.end))
    const eMin = eh * 60 + em
    if (eMin <= sMin || eMin - sMin > 120) {
      const nextValidMin = Math.min(c.h * 60 + c.m, sMin + 60)
      const nh = Math.floor(nextValidMin / 60)
      const nm = nextValidMin % 60
      setEnd(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`)
    }
  }

  const activeRoom = availableRooms.find((r) => r.id === selectedRoomId) ?? room
  const slotErr = overMaxDuration
    ? 'Maximum booking duration is 2 hours (120 minutes).'
    : validateSlot(activeRoom.id, s, e)

  const competingPending = bookings.filter(
    (b) => b.roomId === activeRoom.id && b.status === 'PENDING' && new Date(b.start) < e && new Date(b.end) > s,
  )

  const validMemberList = memberList
    .map((m) => ({
      hcmutId: m.hcmutId.trim().toUpperCase(),
      utsId: m.utsId.trim().toUpperCase(),
    }))
    .filter((m) => m.hcmutId || m.utsId)

  const hasIncomplete = memberList.some(
    (m) => !m.hcmutId.trim() && !m.utsId.trim(),
  )

  const submit = async () => {
    if (submitting) return
    if (!confirmed) {
      setError(
        locale === 'vi'
          ? 'Vui lòng đánh dấu xác nhận cam kết trách nhiệm trước khi gửi yêu cầu.'
          : 'Please acknowledge and confirm the responsibility statement before submitting.',
      )
      return
    }
    if (dur > 120) {
      setError(
        locale === 'vi'
          ? 'Thời gian mượn phòng tối đa là 2 giờ (120 phút).'
          : 'Maximum booking duration is 2 hours (120 minutes).',
      )
      return
    }
    if (validMemberList.length === 0) {
      setError(
        locale === 'vi'
          ? 'Vui lòng nhập ít nhất 1 thành viên với mã số sinh viên HCMUT hoặc UTS.'
          : 'Please add at least 1 participating group member with HCMUT or UTS ID.',
      )
      return
    }
    if (hasIncomplete) {
      setError(
        locale === 'vi'
          ? 'Vui lòng nhập mã số sinh viên (HCMUT hoặc UTS) cho tất cả các dòng thành viên đã tạo.'
          : 'Please provide at least one Student ID (HCMUT or UTS) for each member row.',
      )
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const err = await createBooking({
        roomId: activeRoom.id,
        start: s,
        end: e,
        phone,
        title,
        purpose,
        memberList: validMemberList,
      })
      if (err) setError(err)
      else onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const hcmutId = currentUser?.hcmutId || currentUser?.studentCode || '—'
  const utsId = currentUser?.utsId || '—'

  return (
    <Modal
      open
      onClose={onClose}
      title={t('bookingModal.modalTitle')}
      eyebrow={`${t('bookingModal.modalEyebrow')} · ROOM ${activeRoom.code}`}
      width="max-w-[740px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button
            size="md"
            onClick={submit}
            disabled={
              submitting ||
              !confirmed ||
              !!slotErr ||
              overMaxDuration ||
              dur <= 0 ||
              !purpose.trim() ||
              !title.trim() ||
              !phone.trim() ||
              validMemberList.length === 0 ||
              hasIncomplete
            }
          >
            {submitting ? (locale === 'vi' ? 'Đang gửi…' : 'Submitting…') : t('bookingModal.submitBtn')} <ArrowRight size={16} />
          </Button>
        </div>
      }
    >
      <div className="grid md:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-3.5 p-4 sm:p-5">
          {allowRoomChange && availableRooms.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] text-steel">SELECT ROOM</label>
              <div className="grid grid-cols-3 gap-2">
                {availableRooms.map((r) => {
                  const rc = getRoomColor(r.code)
                  const isSel = r.id === activeRoom.id
                  const errCheck = validateSlot(r.id, s, e)
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoomId(r.id)}
                      className={cx(
                        'flex flex-col items-start rounded-md border p-2 text-left transition-all',
                        isSel ? rc.solid : 'border-rule bg-ice hover:border-edge',
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-mono text-[13px] font-semibold">
                        <span className={cx('h-2 w-2 rounded-sm', isSel ? 'bg-white' : rc.dot)} />
                        Room {r.code}
                      </div>
                      <div className={cx('font-mono text-[10px]', isSel ? 'text-white/80' : 'text-steel')}>
                        {errCheck ? 'Unavailable' : 'Available'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" hint="08:00–17:00">
              <Select value={activeStartStr} onChange={(ev) => handleStartChange(ev.target.value)} className="font-mono">
                {times.slice(0, -1).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="End" hint="max 2h (120m)">
              <Select value={end} onChange={(ev) => setEnd(ev.target.value)} className="font-mono">
                {validEndTimes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t('bookingModal.phoneLabel')} hint={t('bookingModal.phoneHint')}>
            <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(ev) => setPhone(ev.target.value)} placeholder="+84 90 123 4567" className="font-mono" />
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
                  {t('bookingModal.membersRequired')}
                </span>
              </span>
              <span className="font-mono text-[11px] text-steel">
                {validMemberList.length} {locale === 'vi' ? 'thành viên đã thêm' : `member${validMemberList.length === 1 ? '' : 's'} added`}
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
                          onClick={() => removeMember(idx)}
                          className="text-steel hover:text-plum p-1 rounded-sm hover:bg-plum/10 cursor-pointer transition-colors text-[11px] flex items-center gap-1 font-mono"
                          title="Remove member"
                          aria-label={`Remove member ${idx + 1}`}
                        >
                          <Trash2 size={13} />
                          <span>{t('common.remove')}</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block font-mono text-[10px] font-semibold text-steel mb-1">
                          {t('bookingModal.hcmutIdCol')}
                        </label>
                        <Input
                          placeholder="e.g. 2110124"
                          value={m.hcmutId}
                          onChange={(ev) => updateMember(idx, 'hcmutId', ev.target.value)}
                          className="!py-1.5 font-mono text-[13px]"
                          maxLength={7}
                        />
                      </div>

                      <div>
                        <label className="block font-mono text-[10px] font-semibold text-steel mb-1">
                          {t('bookingModal.utsIdCol')}
                        </label>
                        <Input
                          placeholder="e.g. 14234568"
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
                  onClick={addMemberRow}
                  className="inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap rounded-sm border border-edge bg-paper px-3 py-1.5 font-mono text-[11.5px] font-bold text-ink hover:border-ink hover:bg-ice transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus size={13} /> <span>{t('bookingModal.addMemberBtn')}</span>
                </button>
                <span className="font-mono text-[10px] text-steel leading-relaxed sm:text-right">
                  {t('bookingModal.membersHint')}
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
              <strong>Notice:</strong> {competingPending.length} other student request(s) are currently pending approval for this time window. You may still submit a competing request — the Manager will review all requests and approve one.
            </div>
          )}

          {(error || slotErr) && (
            <div className="border-l-2 border-red-600 bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">
              {error || slotErr}
            </div>
          )}
        </div>
        <aside className="flex flex-col justify-between gap-5 border-t border-rule bg-ice p-4 sm:p-5 md:border-t-0 md:border-l">
          <div>
            <div className="mb-2.5 font-display text-[38px] leading-none font-w450 text-ink">{activeRoom.code}</div>
            <LedgerRow k="Room" v={activeRoom.name} />
            <LedgerRow k="Date" v={fmtDate(day)} mono />
            <LedgerRow k="Window" v={`${fmtTime(s)} → ${fmtTime(e)}`} mono />
            <LedgerRow k="Duration" v={dur > 0 ? `${fmtDuration(dur)} (max 2h)` : '—'} mono />
            <LedgerRow k="HCMUT ID" v={hcmutId} mono />
            <LedgerRow k="UTS ID" v={utsId} mono />
            <LedgerRow k="Members" v={`${validMemberList.length} added`} mono />
          </div>
          <div className="flex gap-2 text-[11.5px] leading-[1.5] text-graphite">
            <Info size={14} className="mt-0.5 shrink-0 text-accent" />
            <span>Requests enter the manager approval queue. Once approved, collect the key with your Student ID.</span>
          </div>
        </aside>
      </div>
    </Modal>
  )
}
