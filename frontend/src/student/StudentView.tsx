import { useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { ACTIVE_STATUSES, useStore } from '@/lib/store'
import { addDays, at, ensureWorkday, fmtShort, parseHM, startOfWeek } from '@/lib/time'
import { Button, Eyebrow, Tag, cx } from '@/components/ui'
import { NavItem, PageHeader, TopNav } from '@/components/Shell'
import { RoomTabs, roomColor } from '@/components/RoomTabs'
import { Reveal, ScrollRevealText, SplitText } from '@/components/effects'
import { WeekCalendar, type Selection } from './WeekCalendar'
import { BookingModal } from './BookingModal'
import { MyBookingsDrawer } from './MyBookings'
import { DigitalPass } from './DigitalPass'
import { StudentBookingPopover } from './StudentBookingPopover'

export function StudentView() {
  const { rooms, bookings, myBookings, blocks, settings, currentUser, notify, connection, refreshData, refreshMyBookings } = useStore()
  const [roomId, setRoomId] = useState<string>('ALL')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selection, setSelection] = useState<Selection | null>(null)
  const [activeBooking, setActiveBooking] = useState<{ id: string; el: HTMLElement } | null>(null)
  const checkingBooking = useRef<typeof activeBooking>(null)
  const [drawer, setDrawer] = useState(false)

  const selectedRoom = rooms.find((entry) => entry.id === roomId)
  const isAllRooms = !selectedRoom
  const room = selectedRoom ?? rooms.find((entry) => entry.status === 'AVAILABLE') ?? rooms[0]
  const activeBookingObj = myBookings.find((b) => b.id === activeBooking?.id)

  const now = new Date()
  const active = myBookings.filter((b) => ACTIVE_STATUSES.includes(b.status) && new Date(b.end) > now)
  const nextPass = myBookings
    .filter((b) => b.passCode && (b.status === 'KEY_CHECKED_OUT' || (b.status === 'APPROVED' && new Date(b.end) > now)))
    .sort((a, b) => Number(b.status === 'KEY_CHECKED_OUT') - Number(a.status === 'KEY_CHECKED_OUT') || +new Date(a.start) - +new Date(b.start))[0]

  if (!currentUser) return null
  if (!room) return (
    <>
      <TopNav />
      <main className="mx-auto max-w-[1440px] px-6 pt-10">
        <PageHeader
          eyebrow="STUDENT WORKSPACE · ROOM RESERVATION"
          title={connection === 'connecting' ? 'Loading rooms…' : connection === 'offline' ? 'Room inventory unavailable' : 'No rooms listed'}
          right={<Button variant="outline" onClick={() => setDrawer(true)}>My bookings</Button>}
        />
        {connection === 'offline' && <Button className="mt-4" onClick={() => void refreshData()}>Retry connection</Button>}
      </main>
      <MyBookingsDrawer open={drawer} onClose={() => setDrawer(false)} />
    </>
  )
  const thisWeek = startOfWeek(now)
  const openReservation = () => {
    const { h, m } = parseHM(settings.openTime)
    const day = ensureWorkday(weekStart > now ? weekStart : now)
    setActiveBooking(null)
    setSelection({ start: at(day, h, m), end: at(day, h, m + 30), roomId: room.id })
  }

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
          body="Choose a room and time in the weekly ledger, or use the reservation form. Collect the physical key with your student ID once approved."
          right={
            <Reveal stagger className="grid grid-cols-2 border-t border-l border-rule sm:grid-cols-4">
              {[
                ['WINDOW', `Up to ${settings.maxAdvanceDays} days ahead`],
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
                    {fmtShort(weekStart)} — {fmtShort(addDays(weekStart, 6))} · MON–SUN
                  </div>
                  <Button size="xs" onClick={openReservation}>New reservation</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-graphite">
                  {isAllRooms && (
                    <>
                      {rooms.map((entry) => <Legend key={entry.id} swatch={roomColor(entry).dot} label={`RM ${entry.code}`} />)}
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
                    selection={selection}
                    onSelect={(s) => {
                      checkingBooking.current = null
                      setActiveBooking(null)
                      setSelection(s)
                    }}
                    onReject={(m) => notify(m, 'error')}
                    onEventClick={async (b, el) => {
                      setSelection(null)
                      const wasOpen = activeBooking?.id === b.id || checkingBooking.current?.id === b.id
                      checkingBooking.current = null
                      setActiveBooking(null)
                      if (wasOpen) return
                      const target = { id: b.id, el }
                      const personal = myBookings.find((booking) => booking.id === b.id)
                      if (personal?.status !== b.status || ((b.status === 'APPROVED' || b.status === 'KEY_CHECKED_OUT') && !personal?.passCode)) {
                        checkingBooking.current = target
                        const refreshed = await refreshMyBookings()
                        if (checkingBooking.current !== target) return
                        checkingBooking.current = null
                        if (!el.isConnected) return
                        if (!refreshed) {
                          notify('Could not refresh the booking. Try again.', 'error')
                          return
                        }
                      }
                      setActiveBooking(target)
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
                {isAllRooms ? 'ALL ROOMS' : `ROOM ${room.code} · LEVEL ${room.floor}`}
              </Eyebrow>
              <h3 className="mt-3 font-display text-feature font-w450 text-ink">
                <SplitText key={isAllRooms ? 'all' : room.id} text={isAllRooms ? 'Combined Room Schedule' : room.name} />
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-px border border-rule bg-rule">
                <div className="bg-paper px-3 py-2">
                  <div className="font-mono text-[10px] text-steel">APPROVAL</div>
                  <div className="font-mono text-[13px] font-semibold text-accent">{isAllRooms ? 'VARIES BY ROOM' : room.autoApprove ? 'AUTO WHEN FREE' : 'MANAGER'}</div>
                </div>
                <div className="bg-paper px-3 py-2">
                  <div className="font-mono text-[10px] text-steel">KEY DESK</div>
                  <div className="font-mono text-[13px] font-semibold">LEVEL 1</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(isAllRooms ? [...new Set(rooms.flatMap((entry) => entry.features))] : room.features).map((f) => (
                  <Tag key={f}>{f}</Tag>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-ink pt-4">
              <Eyebrow tone="ink">HOW IT WORKS</Eyebrow>
              {[
                ['01', 'Select an open calendar slot or start a new reservation.'],
                ['02', 'Enter the purpose of the booking and number of attendees.'],
                ['03', 'Check My bookings for the status of your reservation.'],
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

      {selection && <BookingModal room={room} rooms={rooms} allowRoomChange={isAllRooms} selection={selection} onClose={() => setSelection(null)} />}
      <MyBookingsDrawer open={drawer} onClose={() => setDrawer(false)} />
      {activeBooking && activeBookingObj && (
        <StudentBookingPopover
          key={activeBooking.id}
          booking={activeBookingObj}
          anchor={activeBooking.el}
          onClose={() => setActiveBooking((current) => current?.id === activeBooking.id ? null : current)}
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
