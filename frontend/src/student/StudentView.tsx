import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { ACTIVE_STATUSES, useStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { addDays, at, ensureWorkday, fmtDuration, fmtShort, minutesOfDay, parseHM, sameDay, startOfWeek } from '@/lib/time'
import { Button, Eyebrow, Tag, cx } from '@/components/ui'
import { NavItem, PageHeader, TopNav } from '@/components/Shell'
import { RoomTabs } from '@/components/RoomTabs'
import { Reveal, ScrollRevealText, SplitText } from '@/components/effects'
import { WeekCalendar, type Selection } from './WeekCalendar'
import { BookingModal } from './BookingModal'
import { MyBookingsDrawer } from './MyBookings'
import { DigitalPass } from './DigitalPass'
import { StudentBookingPopover } from './StudentBookingPopover'

export function StudentView() {
  const { rooms, bookings, myBookings, blocks, settings, currentUser, notify, connection, refreshData, refreshMyBookings } = useStore()
  const { t, locale } = useI18n()
  const [roomId, setRoomId] = useState<string>(() => rooms[0]?.id ?? '')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selection, setSelection] = useState<Selection | null>(null)
  const [activeBooking, setActiveBooking] = useState<{ id: string; el: HTMLElement } | null>(null)
  const checkingBooking = useRef<typeof activeBooking>(null)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    const first = rooms[0]
    if (first && (!roomId || roomId === 'ALL' || !rooms.some((entry) => entry.id === roomId))) {
      setRoomId(first.id)
    }
  }, [rooms, roomId])

  const room = rooms.find((entry) => entry.id === roomId) ?? rooms[0]
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
          eyebrow={t('student.eyebrow')}
          title={t(connection === 'connecting' ? 'student.loadingRooms' : connection === 'offline' ? 'student.inventoryUnavailable' : 'student.noRooms')}
          right={<Button variant="outline" onClick={() => setDrawer(true)}>{t('nav.myBookings')}</Button>}
        />
        {connection === 'offline' && <Button className="mt-4" onClick={() => void refreshData()}>{t('student.retryConnection')}</Button>}
      </main>
      <MyBookingsDrawer open={drawer} onClose={() => setDrawer(false)} />
    </>
  )
  const thisWeek = startOfWeek(now)
  const openReservation = () => {
    const open = parseHM(settings.openTime)
    const close = parseHM(settings.closeTime)
    const first = open.h * 60 + open.m
    const last = close.h * 60 + close.m
    let day = ensureWorkday(weekStart > now ? weekStart : now)
    let start = sameDay(now, day) && minutesOfDay(now) >= first
      ? first + 30 * (Math.floor((minutesOfDay(now) - first) / 30) + 1) : first
    if (start >= last) {
      day = ensureWorkday(addDays(day, 1))
      start = first
    }
    checkingBooking.current = null
    setActiveBooking(null)
    setSelection({ start: at(day, 0, start), end: at(day, 0, Math.min(last, start + 30, start + settings.maxDurationMinutes)), roomId: room.id })
  }

  return (
    <>
      <TopNav>
        <NavItem active>{t('nav.bookRoom')}</NavItem>
        <NavItem onClick={() => setDrawer(true)} badge={active.length}>
          {t('nav.myBookings')}
        </NavItem>
      </TopNav>

      <main className="mx-auto max-w-[1440px] px-6 pt-10">
        <PageHeader
          eyebrow={t('student.eyebrow')}
          title={t('student.heroTitle')}
          body={t('student.heroBody')}
          right={
            <Reveal stagger className="grid grid-cols-2 border-t border-l border-rule sm:grid-cols-4">
              {[
                [t('student.bookingWindow'), t('student.windowValue', { count: settings.maxAdvanceDays })],
                [t('common.hours'), `${settings.openTime}–${settings.closeTime}`],
                [t('common.maxLength'), fmtDuration(settings.maxDurationMinutes, locale)],
                [t('common.activeBookings'), `${active.length} / ${settings.maxActiveBookings}`],
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
              activeId={room.id}
              showAllTab={false}
              onChange={(id) => {
                checkingBooking.current = null
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
                    aria-label={t('student.previousWeek')}
                    onClick={() => {
                      checkingBooking.current = null
                      setWeekStart((w) => addDays(w, -7))
                      setActiveBooking(null)
                    }}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    className="!rounded-md !p-1.5"
                    aria-label={t('student.nextWeek')}
                    onClick={() => {
                      checkingBooking.current = null
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
                      checkingBooking.current = null
                      setWeekStart(thisWeek)
                      setActiveBooking(null)
                    }}
                  >
                    {t('student.thisWeek')}
                  </Button>
                  <div className="ml-2 font-mono text-[13px] font-semibold text-ink">
                    {fmtShort(weekStart, locale)} — {fmtShort(addDays(weekStart, 6), locale)} · {t('student.monToSun')}
                  </div>
                  <Button size="xs" onClick={openReservation}>{t('student.newReservation')}</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-graphite">
                  <Legend swatch="border border-accent bg-accent" label={t('student.yours')} />
                  <Legend swatch="border border-dashed border-meta" label={t('student.yoursPending')} />
                  <Legend swatch="border border-[#b9c0cb] bg-reserved" label={t('student.reserved')} />
                  <Legend swatch="hatch-slate border border-ink" label={t('student.eventBlock')} />
                  <Legend swatch="hatch border border-edge bg-paper" label={t('student.unavailable')} />
                  <Legend swatch="border border-accent bg-tint" label={t('student.selection')} />
                </div>
              </div>
              {room.status !== 'AVAILABLE' && (
                <div className="border-b border-plum/30 bg-plum/[0.06] px-4 py-2 font-mono text-[12px] font-semibold text-plum">
                  {t('student.roomSuspended', { code: room.code, status: t(`student.roomStatus.${room.status}`) })}
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
                          notify(t('student.bookingRefreshFailed'), 'error')
                          return
                        }
                      }
                      setActiveBooking(target)
                    }}
                    activeId={activeBooking?.id}
                    allRooms={false}
                    rooms={rooms}
                  />
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal as="aside" stagger className="flex flex-col gap-6">
            <div className="rounded-lg bg-ice p-6">
              <Eyebrow>
                {t('student.roomFloor', { code: room.code, floor: room.floor })}
              </Eyebrow>
              <h3 className="mt-3 font-display text-feature font-w450 text-ink">
                <SplitText key={room.id} text={room.name} />
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-px border border-rule bg-rule">
                <div className="bg-paper px-3 py-2">
                  <div className="font-mono text-[10px] text-steel">{t('student.approval')}</div>
                  <div className="font-mono text-[13px] font-semibold text-accent">{t(room.autoApprove ? 'student.autoWhenFree' : 'student.managerRole')}</div>
                </div>
                <div className="bg-paper px-3 py-2">
                  <div className="font-mono text-[10px] text-steel">{t('student.keyPickup')}</div>
                  <div className="font-mono text-[12px] font-semibold text-ink">{t('student.managerOffice')}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {room.features.map((f) => (
                  <Tag key={f}>{f}</Tag>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-ink pt-4">
              <Eyebrow tone="ink">{t('student.howItWorks')}</Eyebrow>
              {[
                ['01', t('student.step1')],
                ['02', t('student.step2')],
                ['03', t('student.step3')],
              ].map(([n, tVal]) => (
                <div key={n} className="flex gap-3 border-b border-dashed border-rule pb-3 last:border-0">
                  <span className="font-mono text-[12px] font-semibold text-accent">{n}</span>
                  <span className="text-[14px] leading-[1.5] text-graphite">
                    <ScrollRevealText text={tVal} />
                  </span>
                </div>
              ))}
            </div>

            {nextPass ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Eyebrow tone="ink">{t(nextPass.status === 'KEY_CHECKED_OUT' ? 'student.keyInCustody' : 'student.nextKeyPickup')}</Eyebrow>
                  <button onClick={() => setDrawer(true)} className="flex items-center gap-1 text-[13px] font-semibold text-ink hover:text-accent">
                    {t('student.allBookings')} <ArrowRight size={14} />
                  </button>
                </div>
                <DigitalPass
                  booking={nextPass}
                  room={rooms.find((r) => r.id === nextPass.roomId)}
                  holder={currentUser.fullName}
                  studentCode={currentUser.studentCode}
                  hcmutId={currentUser.hcmutId}
                  utsId={currentUser.utsId}
                />
              </div>
            ) : (
              <Button variant="outline" onClick={() => setDrawer(true)}>
                {t('student.openMyBookings')} <ArrowRight size={14} />
              </Button>
            )}
          </Reveal>
        </div>
      </main>

      {selection && <BookingModal room={room} rooms={[room]} allowRoomChange={false} selection={selection} onClose={() => setSelection(null)} />}
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
