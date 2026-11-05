import { useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { ACTIVE_STATUSES, useStore } from '@/lib/store'
import { addDays, fmtShort, startOfWeek } from '@/lib/time'
import { Button, Eyebrow, Tag, cx } from '@/components/ui'
import { NavItem, PageHeader, TopNav } from '@/components/Shell'
import { RoomTabs } from '@/components/RoomTabs'
import { Reveal, ScrollRevealText, SplitText } from '@/components/effects'
import { WeekCalendar, firstBookableWeek, type Selection } from './WeekCalendar'
import { BookingModal } from './BookingModal'
import { MyBookingsDrawer } from './MyBookings'
import { DigitalPass } from './DigitalPass'
import { StudentBookingPopover } from './StudentBookingPopover'

export function StudentView() {
  const { rooms, bookings, blocks, settings, currentUser, notify } = useStore()
  const [roomId, setRoomId] = useState<string>('ALL')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(firstBookableWeek(settings)))
  const [selection, setSelection] = useState<Selection | null>(null)
  const [activeBooking, setActiveBooking] = useState<{ id: string; el: HTMLElement } | null>(null)
  const [drawer, setDrawer] = useState(false)

  const isAllRooms = roomId === 'ALL'
  const room = isAllRooms ? rooms[0] : (rooms.find((r) => r.id === roomId) ?? rooms[0])

  const activeBookingObj = bookings.find((b) => b.id === activeBooking?.id)

  const mine = useMemo(() => bookings.filter((b) => b.userId === currentUser?.id), [bookings, currentUser])
  const active = mine.filter((b) => ACTIVE_STATUSES.includes(b.status))
  const nextPass = mine
    .filter((b) => b.status === 'KEY_CHECKED_OUT' || b.status === 'APPROVED')
    .sort((a, b) => (a.status === 'KEY_CHECKED_OUT' ? -1 : b.status === 'KEY_CHECKED_OUT' ? 1 : +new Date(a.start) - +new Date(b.start)))[0]

  if (!currentUser || !room) return null
  const thisWeek = startOfWeek(new Date())

  return (
    <>
      <TopNav>
        <NavItem active>Book a room</NavItem>
        <NavItem onClick={() => setDrawer(true)} badge={active.length}>
          My bookings
        </NavItem>
      </TopNav>

      <main className="mx-auto max-w-[1440px] px-6 pt-10">
        <PageHeader
          eyebrow="STUDENT WORKSPACE · ROOM RESERVATION"
          title="Reserve a room. Collect the key."
          body="Choose a room tab, then drag across open slots in the weekly ledger. Bookings open two to seven days ahead; collect the physical key with your Student ID."
          right={
            <Reveal stagger className="grid grid-cols-2 border-t border-l border-rule sm:grid-cols-4">
              {[
                ['WINDOW', `T-${settings.minAdvanceDays} → T-${settings.maxAdvanceDays}`],
                ['HOURS', `${settings.openTime}–${settings.closeTime}`],
                ['MAX LENGTH', `${settings.maxDurationMinutes / 60}h`],
                ['ACTIVE', `${active.length} / ${settings.maxActiveBookings}`],
              ].map(([k, v]) => (
                <div key={k} className="min-w-[120px] border-r border-b border-rule px-4 py-3">
                  <div className="font-mono text-[11px] text-steel">{k}</div>
                  <div className="mt-1 font-mono text-[16px] font-semibold text-ink">{v}</div>
                </div>
              ))}
            </Reveal>
          }
        />

        <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Reveal as="section">
            <RoomTabs
              rooms={rooms}
              activeId={isAllRooms ? 'ALL' : room.id}
              onChange={(id) => {
                setRoomId(id)
                setSelection(null)
                setActiveBooking(null)
              }}
            />

            <div className="rounded-lg rounded-tl-none border border-ink bg-paper">
              {/* toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="!rounded-md !p-1.5"
                    aria-label="Previous week"
                    onClick={() => {
                      setWeekStart((w) => addDays(w, -7))
                      setActiveBooking(null)
                    }}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    className="!rounded-md !p-1.5"
                    aria-label="Next week"
                    onClick={() => {
                      setWeekStart((w) => addDays(w, 7))
                      setActiveBooking(null)
                    }}
                  >
                    <ChevronRight size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="!rounded-md"
                    onClick={() => {
                      setWeekStart(thisWeek)
                      setActiveBooking(null)
                    }}
                  >
                    This week
                  </Button>
                  <div className="ml-2 font-mono text-[13px] font-semibold text-ink">
                    {fmtShort(weekStart)} — {fmtShort(addDays(weekStart, 4))} · MON–FRI
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-graphite">
                  {isAllRooms && (
                    <>
                      <Legend swatch="bg-blue-600" label="RM 601" />
                      <Legend swatch="bg-emerald-600" label="RM 602" />
                      <Legend swatch="bg-violet-600" label="RM 605" />
                      <span className="text-rule">|</span>
                    </>
                  )}
                  <Legend swatch="border border-accent bg-accent" label="Yours" />
                  <Legend swatch="border border-dashed border-meta" label="Yours · pending" />
                  <Legend swatch="border border-[#b9c0cb] bg-reserved" label="Reserved" />
                  <Legend swatch="hatch-slate border border-ink" label="Event block" />
                  <Legend swatch="hatch border border-edge bg-paper" label="Unavailable" />
                  <Legend swatch="border border-accent bg-tint" label="Selection" />
                </div>
              </div>
              {!isAllRooms && room.status !== 'AVAILABLE' && (
                <div className="border-b border-plum/30 bg-plum/[0.06] px-4 py-2 font-mono text-[12px] font-semibold text-plum">
                  ROOM {room.code} IS {room.status} — BOOKINGS SUSPENDED
                </div>
              )}
              <div className="scrollbar-thin overflow-x-auto">
                <div className="min-w-[820px]">
                  <WeekCalendar
                    room={room}
                    weekStart={weekStart}
                    bookings={bookings}
                    blocks={blocks}
                    settings={settings}
                    currentUserId={currentUser.id}
                    selection={selection}
                    onSelect={(s) => {
                      setActiveBooking(null)
                      setSelection(s)
                    }}
                    onReject={(m) => notify(m, 'error')}
                    onEventClick={(b, el) => {
                      setSelection(null)
                      setActiveBooking((prev) => (prev?.id === b.id ? null : { id: b.id, el }))
                    }}
                    activeId={activeBooking?.id}
                    allRooms={isAllRooms}
                    rooms={rooms}
                  />
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal as="aside" stagger className="flex flex-col gap-6">
            <div className="rounded-lg bg-ice p-6">
              <Eyebrow>
                {isAllRooms ? 'ALL ROOMS · LEVEL 6' : `ROOM ${room.code} · LEVEL ${room.floor}`}
              </Eyebrow>
              <h3 className="mt-3 font-display text-feature font-w450 text-ink">
                <SplitText key={isAllRooms ? 'all' : room.id} text={isAllRooms ? 'Combined Room Schedule' : room.name} />
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-px border border-rule bg-rule">
                <div className="bg-paper px-3 py-2">
                  <div className="font-mono text-[10px] text-steel">APPROVAL</div>
                  <div className="font-mono text-[13px] font-semibold text-accent">MANAGER</div>
                </div>
                <div className="bg-paper px-3 py-2">
                  <div className="font-mono text-[10px] text-steel">KEY DESK</div>
                  <div className="font-mono text-[13px] font-semibold">LEVEL 1</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(isAllRooms ? ['Projector', 'PA System', 'Dual Display', 'Whiteboard Wall', 'Recording', 'Tiered Seating'] : room.features).map((f) => (
                  <Tag key={f}>{f}</Tag>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-ink pt-4">
              <Eyebrow tone="ink">HOW IT WORKS</Eyebrow>
              {[
                ['01', 'Drag across open slots on a highlighted day.'],
                ['02', 'Confirm your contact details and purpose in the ledger entry.'],
                ['03', 'Wait for Manager approval on your reservation.'],
              ].map(([n, t]) => (
                <div key={n} className="flex gap-3 border-b border-dashed border-rule pb-3 last:border-0">
                  <span className="font-mono text-[12px] font-semibold text-accent">{n}</span>
                  <span className="text-[14px] leading-[1.5] text-graphite">
                    <ScrollRevealText text={t} />
                  </span>
                </div>
              ))}
            </div>

            {nextPass ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Eyebrow tone="ink">{nextPass.status === 'KEY_CHECKED_OUT' ? 'KEY IN CUSTODY' : 'NEXT KEY PICKUP'}</Eyebrow>
                  <button onClick={() => setDrawer(true)} className="flex items-center gap-1 text-[13px] font-semibold text-ink hover:text-accent">
                    All bookings <ArrowRight size={14} />
                  </button>
                </div>
                <DigitalPass booking={nextPass} room={rooms.find((r) => r.id === nextPass.roomId)} holder={currentUser.fullName} studentCode={currentUser.studentCode} />
              </div>
            ) : (
              <Button variant="outline" onClick={() => setDrawer(true)}>
                Open my bookings <ArrowRight size={14} />
              </Button>
            )}
          </Reveal>
        </div>
      </main>

      <BookingModal room={room} rooms={rooms} allowRoomChange={isAllRooms} selection={selection} onClose={() => setSelection(null)} />
      <MyBookingsDrawer open={drawer} onClose={() => setDrawer(false)} />
      {activeBooking && activeBookingObj && (
        <StudentBookingPopover
          booking={activeBookingObj}
          anchor={activeBooking.el}
          onClose={() => setActiveBooking(null)}
        />
      )}
    </>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx('h-3 w-3 rounded-[1px]', swatch)} />
      {label}
    </span>
  )
}
