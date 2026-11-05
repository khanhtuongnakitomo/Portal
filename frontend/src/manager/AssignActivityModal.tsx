import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Check, Clock, Sparkles, TriangleAlert, Users, X } from 'lucide-react'
import { useLookups, useStore } from '@/lib/store'
import type { Room } from '@/lib/types'
import { at, fmtDate, fmtDuration, fmtRange, overlaps, parseHM, addDays } from '@/lib/time'
import { Button, Eyebrow, Field, Input, Textarea, cx } from '@/components/ui'
import { CATEGORY_PRESETS, type ActivityCategory } from './types'

export interface AssignModalInitial {
  roomId: string
  date: Date
  startTime?: string // "09:00"
  endTime?: string   // "11:00"
  mode?: 'EVENT' | 'BLOCK'
  category?: ActivityCategory
  title?: string
}

interface AssignActivityModalProps {
  isOpen: boolean
  initial?: AssignModalInitial | null
  onClose: () => void
  onSuccess?: () => void
}

function toDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function snapToWorkday(d: Date): Date {
  const dow = d.getDay()
  if (dow === 6) return addDays(d, 2)
  if (dow === 0) return addDays(d, 1)
  return d
}

function generateTimeOptions(openTime = '08:00', closeTime = '17:00', step = 30): string[] {
  const open = parseHM(openTime)
  const close = parseHM(closeTime)
  const startMin = open.h * 60 + open.m
  const endMin = close.h * 60 + close.m
  const options: string[] = []
  for (let m = startMin; m <= endMin; m += step) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    options.push(`${hh}:${mm}`)
  }
  return options
}

export function AssignActivityModal({
  isOpen,
  initial,
  onClose,
  onSuccess,
}: AssignActivityModalProps) {
  const store = useStore()
  const { rooms, bookings, blocks, settings, notify } = store
  const { user } = useLookups()

  const [mode, setMode] = useState<'EVENT' | 'BLOCK'>('EVENT')
  const [roomId, setRoomId] = useState<string>(rooms[0]?.id ?? '')
  const [dateStr, setDateStr] = useState<string>(() => toDateString(snapToWorkday(new Date())))
  const [startTime, setStartTime] = useState<string>('09:00')
  const [endTime, setEndTime] = useState<string>('11:00')
  const [category, setCategory] = useState<ActivityCategory>('LECTURE')
  const [title, setTitle] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [attendees, setAttendees] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync state when initial payload changes
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    if (initial) {
      if (initial.roomId) setRoomId(initial.roomId)
      if (initial.date) setDateStr(toDateString(snapToWorkday(initial.date)))
      if (initial.startTime) setStartTime(initial.startTime)
      if (initial.endTime) setEndTime(initial.endTime)
      if (initial.mode) setMode(initial.mode)
      if (initial.category) setCategory(initial.category)
      if (initial.title) setTitle(initial.title)
    } else {
      setRoomId(rooms[0]?.id ?? '')
      setDateStr(toDateString(snapToWorkday(new Date())))
      setStartTime('09:00')
      setEndTime('11:00')
      setMode('EVENT')
      setCategory('LECTURE')
      setTitle('')
      setNotes('')
      setAttendees('')
    }
  }, [isOpen, initial, rooms])

  // ESC to close
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const timeOptions = useMemo(
    () => generateTimeOptions(settings.openTime, settings.closeTime, 30),
    [settings.openTime, settings.closeTime],
  )

  // Construct start and end Date objects
  const { startDate, endDate, isValidRange, durationMinutes, isWeekend } = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const base = new Date(y, m - 1, d)
    const sHm = parseHM(startTime)
    const eHm = parseHM(endTime)
    const sDate = at(base, sHm.h, sHm.m)
    const eDate = at(base, eHm.h, eHm.m)
    const sMin = sHm.h * 60 + sHm.m
    const eMin = eHm.h * 60 + eHm.m
    const dur = eMin - sMin
    const isWeekend = base.getDay() === 0 || base.getDay() === 6
    return {
      startDate: sDate,
      endDate: eDate,
      isValidRange: dur > 0,
      durationMinutes: dur,
      isWeekend,
    }
  }, [dateStr, startTime, endTime])

  // Overlap and displacement detection
  const { overlappingBookings, overlappingBlocks } = useMemo(() => {
    if (!isValidRange || !roomId) return { overlappingBookings: [], overlappingBlocks: [] }
    const bks = bookings.filter(
      (b) =>
        b.roomId === roomId &&
        (b.status === 'PENDING' || b.status === 'APPROVED' || b.status === 'KEY_CHECKED_OUT') &&
        overlaps(new Date(b.start), new Date(b.end), startDate, endDate),
    )
    const blks = blocks.filter(
      (k) => k.active && k.roomId === roomId && overlaps(new Date(k.start), new Date(k.end), startDate, endDate),
    )
    return { overlappingBookings: bks, overlappingBlocks: blks }
  }, [bookings, blocks, roomId, startDate, endDate, isValidRange])

  if (!isOpen) return null

  const selectedRoom: Room | undefined = rooms.find((r) => r.id === roomId)

  // Quick duration shortcuts
  const applyDuration = (hours: number) => {
    const sHm = parseHM(startTime)
    const startMins = sHm.h * 60 + sHm.m
    const endMins = Math.min(17 * 60, startMins + hours * 60)
    const hh = String(Math.floor(endMins / 60)).padStart(2, '0')
    const mm = String(endMins % 60).padStart(2, '0')
    setEndTime(`${hh}:${mm}`)
  }

  const applyFullDay = () => {
    setStartTime('08:00')
    setEndTime('17:00')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isWeekend) {
      setError('Activities can only be scheduled on workdays (Monday–Friday).')
      return
    }

    if (!isValidRange) {
      setError('End time must be strictly after start time.')
      return
    }

    if (!title.trim()) {
      setError('Activity title is required.')
      return
    }

    // If Mode 1 (EVENT) and there is a conflict, warn the manager
    if (mode === 'EVENT' && (overlappingBookings.length > 0 || overlappingBlocks.length > 0)) {
      setError(
        'This slot has overlapping reservations or blocks. To displace existing bookings with priority, switch to "Full Room Override / Block" mode.',
      )
      return
    }

    setIsSubmitting(true)

    const fullTitle = title.trim().startsWith(`[${category}]`) ? title.trim() : `[${category}] ${title.trim()}`
    const fullPurpose = notes.trim() || `${category} scheduled by Facilities Desk`

    try {
      // Use assignRoomSchedule if present on store (per instruction)
      const storeWithAssign = store as typeof store & {
        assignRoomSchedule?: (input: {
          roomId: string
          start: Date
          end: Date
          title: string
          purpose: string
          category?: string
          mode?: 'EVENT' | 'BLOCK'
          attendeeCount?: number
        }) => string | null
      }

      if (typeof storeWithAssign.assignRoomSchedule === 'function') {
        const err = storeWithAssign.assignRoomSchedule({
          roomId,
          start: startDate,
          end: endDate,
          title: fullTitle,
          purpose: fullPurpose,
          category,
          mode,
          attendeeCount: attendees ? parseInt(attendees, 10) : undefined,
        })
        if (err) {
          setError(err)
          setIsSubmitting(false)
          return
        }
      } else {
        // Fallback to store.createBlock
        const err = store.createBlock({
          roomId,
          start: startDate,
          end: endDate,
          reason: `${fullTitle} · ${fullPurpose}`,
        })
        if (err) {
          setError(err)
          setIsSubmitting(false)
          return
        }
      }

      notify(`Room ${selectedRoom?.code ?? ''} scheduled for ${category} successfully.`)
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule room.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-[620px] flex-col overflow-hidden rounded-lg border border-ink bg-paper shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule bg-ice px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Eyebrow>FACILITIES DESK · SCHEDULE ASSIGNMENT</Eyebrow>
              <span className="inline-flex items-center gap-1 rounded-[2px] bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                <Sparkles size={11} /> DESK CONTROL
              </span>
            </div>
            <h2 id="assign-modal-title" className="font-display text-[20px] font-w450 text-ink">
              Assign room schedule or event
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-[4px] p-1.5 text-steel transition-colors hover:bg-paper hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">
            {/* Mode Switcher */}
            <div>
              <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] font-semibold text-steel uppercase">
                <span>Scheduling Mode</span>
                <span className="text-[10px] text-graphite">
                  {mode === 'EVENT' ? 'Direct approved calendar slot' : 'University priority override'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-[4px] border border-rule bg-ice p-1">
                <button
                  type="button"
                  onClick={() => setMode('EVENT')}
                  className={cx(
                    'flex flex-col items-center justify-center rounded-[3px] py-2 px-3 text-center transition-all',
                    mode === 'EVENT'
                      ? 'border border-ink bg-paper font-semibold text-ink shadow-xs'
                      : 'text-steel hover:text-ink',
                  )}
                >
                  <span className="text-[13px]">Activity Schedule</span>
                  <span className="font-mono text-[10px] text-accent">APPROVED EVENT</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('BLOCK')}
                  className={cx(
                    'flex flex-col items-center justify-center rounded-[3px] py-2 px-3 text-center transition-all',
                    mode === 'BLOCK'
                      ? 'border border-ink bg-ink font-semibold text-paper shadow-xs'
                      : 'text-steel hover:text-ink',
                  )}
                >
                  <span className="text-[13px]">Full Room Override</span>
                  <span className="font-mono text-[10px] text-plum">DISPLACES BOOKINGS</span>
                </button>
              </div>
            </div>

            {/* Room Selector */}
            <div>
              <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] font-semibold text-steel uppercase">
                <span>Assigned Room</span>
                <span className="font-mono text-[11px] text-ink font-bold">
                  RM {selectedRoom?.code} · Cap {selectedRoom?.capacity}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {rooms.map((r) => {
                  const isSel = r.id === roomId
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoomId(r.id)}
                      className={cx(
                        'flex flex-col rounded-[4px] border px-3 py-2 text-left transition-all',
                        isSel
                          ? 'border-ink bg-tint/30 text-ink ring-1 ring-ink'
                          : 'border-rule bg-paper text-graphite hover:border-edge hover:bg-ice/50',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[14px] font-bold">RM {r.code}</span>
                        <span className="font-mono text-[11px] text-steel">Cap {r.capacity}</span>
                      </div>
                      <span className="truncate text-[11px] text-steel">{r.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Activity Category Chips */}
            <div>
              <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] font-semibold text-steel uppercase">
                <span>Activity Category</span>
                <span className="font-mono text-[10px] text-accent">1-CLICK PRESET</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {CATEGORY_PRESETS.map((p) => {
                  const isCat = category === p.category
                  return (
                    <button
                      key={p.category}
                      type="button"
                      onClick={() => {
                        setCategory(p.category)
                        if (!title || CATEGORY_PRESETS.some((c) => title.startsWith(`[${c.category}]`))) {
                          setTitle(`[${p.category}] `)
                        }
                      }}
                      className={cx(
                        'flex flex-col items-center justify-center rounded-[3px] border py-2 px-1 text-center transition-all',
                        isCat
                          ? 'border-ink bg-ink text-paper font-semibold shadow-xs'
                          : 'border-rule bg-paper text-graphite hover:border-ink hover:text-ink',
                      )}
                      title={p.sublabel}
                    >
                      <span className="font-mono text-[11px] font-bold">{p.tag}</span>
                      <span className="text-[10px] opacity-80">{p.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date & Time Range */}
            <div className="rounded-[4px] border border-rule bg-ice/40 p-3.5">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Date" error={isWeekend ? 'Workdays only (Mon–Fri)' : undefined}>
                  <Input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className={cx("font-mono !text-[13px] bg-paper", isWeekend && "border-plum text-plum")}
                  />
                </Field>

                <Field label="Start Hour">
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-[38px] w-full rounded-[2px] border border-edge bg-paper px-2.5 font-mono text-[13px] text-ink focus:border-ink focus:outline-hidden"
                  >
                    {timeOptions.slice(0, -1).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="End Hour">
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-[38px] w-full rounded-[2px] border border-edge bg-paper px-2.5 font-mono text-[13px] text-ink focus:border-ink focus:outline-hidden"
                  >
                    {timeOptions.slice(1).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Weekend Validation Alert */}
              {isWeekend && (
                <div className="mt-3 flex items-center gap-2 rounded-[3px] border border-plum/40 bg-plum/10 p-2.5 font-mono text-[11px] font-semibold text-plum">
                  <TriangleAlert size={14} className="shrink-0" />
                  <span>Activities can only be scheduled on workdays (Monday–Friday).</span>
                </div>
              )}

              {/* Quick Duration Shortcuts */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-rule/70 pt-2.5">
                <span className="mr-1 flex items-center gap-1 font-mono text-[10px] font-semibold text-steel uppercase">
                  <Clock size={11} /> Quick Duration:
                </span>
                {[
                  { label: '1h', h: 1 },
                  { label: '1.5h', h: 1.5 },
                  { label: '2h', h: 2 },
                  { label: '3h', h: 3 },
                  { label: '4h', h: 4 },
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => applyDuration(q.h)}
                    className="rounded-[2px] border border-edge bg-paper px-2 py-0.5 font-mono text-[11px] text-graphite hover:border-ink hover:text-ink"
                  >
                    {q.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={applyFullDay}
                  className="rounded-[2px] border border-accent/40 bg-accent/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent hover:bg-accent hover:text-paper"
                >
                  Full Day (08:00–17:00)
                </button>
                <div className="ml-auto font-mono text-[11px] font-bold text-ink">
                  {isValidRange ? fmtDuration(durationMinutes) : 'Invalid Range'}
                </div>
              </div>
            </div>

            {/* Title & Organizer Info */}
            <Field label="Activity Title" hint="Required">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Software Architecture - Midterm Examination"
                className="bg-paper"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Organizer / Instructor Notes" hint="Optional">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Prof. David Miller · SE Dept"
                  className="bg-paper"
                />
              </Field>
              <Field label="Estimated Attendees" hint="Optional">
                <Input
                  type="number"
                  min={1}
                  max={selectedRoom?.capacity ?? 100}
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder={`Max ${selectedRoom?.capacity ?? 40}`}
                  className="font-mono bg-paper"
                />
              </Field>
            </div>

            {/* Live Conflict & Displacement Status Banner */}
            <div className="flex flex-col gap-2">
              {overlappingBookings.length === 0 && overlappingBlocks.length === 0 ? (
                <div className="flex items-center gap-2 rounded-[4px] border border-[#0F62FE]/30 bg-tint/20 px-3.5 py-2.5 text-[12px] text-ink">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-paper">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-mono text-[11px] font-bold text-accent">SLOT FULLY CLEAR</span>
                    <span className="text-[12px] text-steel">
                      No overlapping bookings or blocks on {fmtDate(startDate)} ({fmtRange(startDate, endDate)}).
                    </span>
                  </div>
                </div>
              ) : mode === 'BLOCK' ? (
                <div className="flex items-start gap-2.5 rounded-[4px] border border-plum/40 bg-plum/10 px-3.5 py-2.5 text-[12px] text-ink">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0 text-plum" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[11px] font-bold text-plum">
                      PRIORITY OVERRIDE WILL DISPLACE {overlappingBookings.length} BOOKING(S)
                    </span>
                    <span className="text-[12px] text-graphite">
                      {overlappingBookings.map((b) => {
                        const u = user(b.userId)
                        return `${u?.studentCode ?? 'Student'} (${fmtRange(b.start, b.end)})`
                      }).join(', ')}
                    </span>
                    <span className="font-mono text-[10px] text-steel">
                      Displaced requests will receive an automated university displacement notice.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-[4px] border border-plum/40 bg-plum/10 px-3.5 py-2.5 text-[12px] text-plum">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0 text-plum" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[11px] font-bold">SLOT CONFLICT DETECTED</span>
                    <span>
                      {overlappingBookings.length} booking(s) and {overlappingBlocks.length} block(s) overlap this slot.
                      Choose an open slot, or switch to <b>Full Room Override</b> mode above.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-[4px] border border-plum bg-paper px-3.5 py-2.5 text-[13px] font-medium text-plum">
                {error}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-between border-t border-rule pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button
              type="submit"
              variant={mode === 'BLOCK' ? 'dark' : 'accent'}
              disabled={isSubmitting || !isValidRange || !title.trim() || isWeekend}
              className="gap-2"
            >
              <Check size={14} />
              {isSubmitting
                ? 'Assigning Schedule...'
                : mode === 'BLOCK'
                  ? `Confirm Room Override (RM ${selectedRoom?.code})`
                  : `Assign ${category} Schedule`}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
