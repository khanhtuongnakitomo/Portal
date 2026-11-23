import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from './i18n'
import { createApi, mapUser, type ApiAuth, type ApiResponse } from './api'
import { addDays, at, CAMPUS_TZ, durationMin, isWeekend, overlaps, parseHM, sameDay, startOfWeek, toCampusIso } from './time'
import type { AccountStatus, AuditLog, Booking, BookingMember, Role, Room, RoomBlock, RoomStatus, Settings, User } from './types'

export interface Toast {
  id: number
  message: string
  tone: 'ok' | 'error'
}

export const ACTIVE_STATUSES: Booking['status'][] = ['PENDING', 'APPROVED', 'KEY_CHECKED_OUT']

type Result = string | null
type UserQuery = { page: number; search?: string; role?: Role; status?: AccountStatus }
type AuditQuery = { page: number; action?: string; targetType?: string }
type Slot = { roomId: string; start: Date; end: Date }
type BookingInput = Slot & { title: string; purpose: string; attendeeCount: number; memberList?: BookingMember[] }
type BlockInput = Slot & { reason: string; displace: boolean }
type BlockInterval = Pick<Slot, 'start' | 'end'>
type Session = { token: string; user: User; expiresAt: number }
type Read = 'calendar' | 'rooms' | 'settings' | 'mine' | 'today' | 'overdue' | 'pending' | 'users' | 'audit'
type Api = ReturnType<typeof createApi>
type CalendarRange = { from: Date; to: Date }
type CalendarRead = { range: CalendarRange; started: number; applied: number; pending: boolean; ok?: boolean }

export interface Store {
  currentUser: User | null
  users: User[]
  usersTotal: number
  rooms: Room[]
  bookings: Booking[]
  myBookings: Booking[]
  blocks: RoomBlock[]
  managerToday: Booking[]
  overdueKeys: Booking[]
  pendingQueue: Booking[]
  settings: Settings
  settingsLoaded: boolean
  audit: AuditLog[]
  auditTotal: number
  toasts: Toast[]
  connection: 'connecting' | 'live' | 'offline'
  sessionRecovery: 'checking' | 'offline' | null
  retrySession(): Promise<void>
  notify(message: string, tone?: Toast['tone']): void
  login(email: string, password: string): Promise<Result>
  startSession(auth: ApiAuth): void
  register(input: { fullName: string; email: string; password: string; studentCode: string }): Promise<Result>
  updateProfile(input: { fullName: string }): Promise<Result>
  logout(): void
  setVisibleRange(from: Date, to: Date): void
  refreshData(): Promise<void>
  refreshSettings(): Promise<void>
  refreshMyBookings(): Promise<boolean>
  refreshKeyDesk(): Promise<void>
  createBooking(input: BookingInput): Promise<Result>
  cancelBooking(id: string): Promise<Result>
  approveBooking(id: string, note?: string): Promise<Result>
  rejectBooking(id: string, note: string): Promise<Result>
  checkoutKey(id: string, passCode: string): Promise<Result>
  returnKey(id: string): Promise<Result>
  createBlock(input: BlockInput): Promise<Result>
  cancelBlock(roomId: string, expected?: BlockInterval): Promise<Result>
  saveRoom(room: Room): Promise<Result>
  setRoomStatus(id: string, status: RoomStatus): Promise<Result>
  updateUserRole(id: string, role: Role, studentCode?: string): Promise<Result>
  setUserStatus(id: string, status: AccountStatus): Promise<Result>
  createManagerAccount(input: { fullName: string; email: string; password: string }): Promise<Result>
  loadUsers(query: UserQuery): Promise<void>
  loadAudit(query: AuditQuery): Promise<void>
  updateSettings(settings: Settings): Promise<Result>
  assignRoomSchedule(input: Slot & { title: string; purpose: string; category?: string; mode?: 'EVENT' | 'BLOCK'; attendeeCount?: number; displace?: boolean }): Promise<Result>
  validateSlot(roomId: string, start: Date, end: Date, ignoreBookingId?: string): Result
  user(id: string): User | undefined
  room(id: string): Room | undefined
}

const Ctx = createContext<Store | null>(null)
// One atomic storage item contains the bearer token, display identity and expiry.
const TOKEN_KEY = 'tne_access_token'
const clientErrors: Record<string, string> = {
  'The server returned an invalid session.': 'core.invalidSession',
  'The server returned an invalid response.': 'core.invalidResponse',
  'Cannot connect to the booking server.': 'core.offlineError',
  'Session expired. Please sign in again.': 'core.expired',
}
const INITIAL_SETTINGS: Settings = {
  timezone: CAMPUS_TZ,
  openTime: '08:00',
  closeTime: '17:00',
  maxDurationMinutes: 240,
  maxAdvanceDays: 7,
  maxActiveBookings: 3,
}

function readSession(serialized: string | null): Session | null {
  if (!serialized) return null
  try {
    const session = JSON.parse(serialized) as Session
    return session && typeof session.token === 'string' && session.token && Number.isFinite(session.expiresAt) ? session : null
  } catch {
    return null
  }
}

function sameIdentity(saved: Session | null, active: Session | null) {
  return !!saved && !!active && saved.token === active.token && JSON.stringify(saved.user) === JSON.stringify(active.user)
}

function clearLegacyStorage() {
  localStorage.removeItem('tne_current_user')
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key?.startsWith('tne_v')) localStorage.removeItem(key)
  }
}

function defaultRange() {
  const week = startOfWeek(new Date())
  return { from: addDays(week, -1), to: addDays(week, 8) }
}

function rangeKey({ from, to }: CalendarRange) {
  return `${+from}:${+to}`
}

function mergeCalendarRange<T extends { id: string; start: string; end: string }>(
  current: T[], incoming: T[], { from, to }: CalendarRange, newer: CalendarRange[],
) {
  const protectedByNewerRead = (item: T) => newer.some((range) => overlaps(item.start, item.end, range.from, range.to))
  const merged = new Map<string, T>()
  const protectedIds = new Set<string>()
  for (const item of current) {
    if (protectedByNewerRead(item)) protectedIds.add(item.id)
    if (protectedIds.has(item.id) || !overlaps(item.start, item.end, from, to)) merged.set(item.id, item)
  }
  for (const item of incoming) {
    if (!protectedIds.has(item.id) && !protectedByNewerRead(item)) merged.set(item.id, item)
  }
  return [...merged.values()]
}

function upsert<T extends { id: string }>(entries: T[], item: T): T[] {
  return entries.some((entry) => entry.id === item.id) ? entries.map((entry) => entry.id === item.id ? item : entry) : [...entries, item]
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  // Background requests may outlive a locale change; keep the latest translator without restarting session recovery.
  const translator = useRef(t)
  useEffect(() => { translator.current = t }, [t])
  const localError = useCallback((message: string) => Object.prototype.hasOwnProperty.call(clientErrors, message) ? translator.current(clientErrors[message]) : message, [])
  const [session, setSession] = useState<Session | null>(null)
  const [sessionRecovery, setSessionRecovery] = useState<Store['sessionRecovery']>('checking')
  const [users, setUsers] = useState<User[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [blocks, setBlocks] = useState<RoomBlock[]>([])
  const [calendarUsers, setCalendarUsers] = useState<User[]>([])
  const [deskUsers, setDeskUsers] = useState<User[]>([])
  const [managerToday, setManagerToday] = useState<Booking[]>([])
  const [overdueKeys, setOverdueKeys] = useState<Booking[]>([])
  const [pendingQueue, setPendingQueue] = useState<Booking[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [audit, setAudit] = useState<AuditLog[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [reads, setReads] = useState<Partial<Record<Read, boolean>>>({})
  const activeSession = useRef<Session | null>(null)
  const restoringStorage = useRef<string | null>(null)
  const epoch = useRef(0)
  const toastId = useRef(0)
  const sequence = useRef(0)
  const pending = useRef<Partial<Record<Read, number>>>({})
  const calendarReads = useRef(new Map<string, CalendarRead>())
  const personalBookings = useRef<Booking[] | null>(null)
  const recentRanges = useRef<CalendarRange[]>([])
  const userQuery = useRef<UserQuery | null>(null)
  const auditQuery = useRef<AuditQuery | null>(null)

  const addToast = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastId.current
    setToasts((items) => [...items, { id, message, tone }])
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4500)
  }, [])

  const reset = useCallback(() => {
    ++epoch.current
    activeSession.current = null
    restoringStorage.current = null
    pending.current = {}
    calendarReads.current.clear()
    recentRanges.current = []
    personalBookings.current = null
    userQuery.current = null
    auditQuery.current = null
    setSession(null)
    setUsers([])
    setUsersTotal(0)
    setRooms([])
    setBookings([])
    setMyBookings([])
    setBlocks([])
    setCalendarUsers([])
    setDeskUsers([])
    setManagerToday([])
    setOverdueKeys([])
    setPendingQueue([])
    setSettings(null)
    setAudit([])
    setAuditTotal(0)
    setToasts([])
    setReads({})
  }, [])

  const logout = useCallback(() => {
    reset()
    setSessionRecovery(null)
    localStorage.removeItem(TOKEN_KEY)
    clearLegacyStorage()
  }, [reset])

  const install = useCallback((next: Session) => {
    activeSession.current = next
    localStorage.setItem(TOKEN_KEY, JSON.stringify(next))
    setSession(next)
    setSessionRecovery(null)
  }, [])

  const syncSession = useCallback(async () => {
    const serialized = localStorage.getItem(TOKEN_KEY)
    const saved = readSession(serialized)
    if (sameIdentity(saved, activeSession.current) || (serialized !== null && serialized === restoringStorage.current)) return
    reset()
    clearLegacyStorage()
    const started = epoch.current
    if (!saved) {
      if (serialized !== null) localStorage.removeItem(TOKEN_KEY)
      setSessionRecovery(null)
      return
    }
    restoringStorage.current = serialized
    setSessionRecovery('checking')
    const result = await createApi(saved.token, () => {}).apiMe()
    if (started !== epoch.current) return
    if (localStorage.getItem(TOKEN_KEY) !== serialized) {
      // The queued storage event will load the newer session.
      restoringStorage.current = null
      return
    }
    restoringStorage.current = null
    if (!result.ok) {
      if (result.status === 401) {
        logout()
        addToast(translator.current('core.expired'), 'error')
      } else {
        setSessionRecovery('offline')
      }
      return
    }
    install({ ...saved, user: result.data })
  }, [addToast, install, logout, reset])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === TOKEN_KEY || event.key === null)) void syncSession()
    }
    window.addEventListener('storage', onStorage)
    void syncSession()
    return () => window.removeEventListener('storage', onStorage)
  }, [syncSession])

  const expire = useCallback((token: string, started: number) => {
    if (started !== epoch.current) return
    const saved = readSession(localStorage.getItem(TOKEN_KEY))
    if (saved?.token !== token || !sameIdentity(saved, activeSession.current)) {
      void syncSession()
      return
    }
    logout()
    addToast(translator.current('core.expired'), 'error')
  }, [addToast, logout, syncSession])

  useEffect(() => {
    if (!session) return
    const started = epoch.current
    let timer: number
    const check = () => {
      const remaining = session.expiresAt - Date.now()
      if (remaining <= 0) expire(session.token, started)
      else timer = window.setTimeout(check, Math.min(remaining, 2_147_483_647))
    }
    check()
    return () => window.clearTimeout(timer)
  }, [expire, session])

  const apiForSession = useCallback(() => {
    const started = epoch.current
    const current = activeSession.current
    return createApi(current?.token ?? null, () => {
      if (current) expire(current.token, started)
    }, current?.user.id)
  }, [expire])

  const load = useCallback(async <T,>(
    key: Read,
    request: () => Promise<ApiResponse<T>>,
    apply: (data: T) => void,
    onError?: (message: string) => void,
  ) => {
    const started = epoch.current
    const id = ++sequence.current
    pending.current[key] = id
    const result = await request()
    if (started !== epoch.current || pending.current[key] !== id) return false
    setReads((state) => state[key] === result.ok ? state : { ...state, [key]: result.ok })
    if (result.ok) apply(result.data)
    else onError?.(result.message)
    return result.ok
  }, [])

  const refreshMyBookings = useCallback(async () => {
    if (!activeSession.current) return false
    const api = apiForSession()
    const started = epoch.current
    return load<Booking[]>('mine', async () => {
      const items = new Map<string, Booking>()
      for (let page = 1; ; page++) {
        const result = await api.apiGetMyBookings(page)
        if (!result.ok) return result
        if (started !== epoch.current) return { ok: false, status: 0, message: translator.current('core.changed') }
        for (const booking of result.data.items) items.set(booking.id, booking)
        if (page * result.data.limit >= result.data.total || !result.data.items.length) return { ok: true, data: [...items.values()] }
      }
    }, (items) => {
      personalBookings.current = items
      setMyBookings(items)
    })
  }, [apiForSession, load])

  const loadCalendarRange = useCallback(async (range: CalendarRange) => {
    const key = rangeKey(range)
    const started = epoch.current
    const id = ++sequence.current
    const previous = calendarReads.current.get(key)
    const read = { range, started: id, applied: previous?.applied ?? 0, pending: true, ok: previous?.ok }
    calendarReads.current.set(key, read)
    const api = apiForSession()
    const result = await api.apiGetCalendar(toCampusIso(range.from), toCampusIso(range.to))
    if (started !== epoch.current || calendarReads.current.get(key)?.started !== id) return
    read.pending = false
    read.ok = result.ok
    const statuses = recentRanges.current.map((entry) => calendarReads.current.get(rangeKey(entry))?.ok)
    const connected = statuses.includes(false) ? false : statuses.every((status) => status === true) ? true : undefined
    setReads((state) => state.calendar === connected ? state : { ...state, calendar: connected })
    if (!result.ok) return
    read.applied = id
    // A slower response may fill the rest of its range, but not overwrite newer overlapping data.
    const newer = [...calendarReads.current.values()].filter((entry) => entry.applied > id).map((entry) => entry.range)
    const { bookings, blocks, users } = result.data
    setBookings((items) => mergeCalendarRange(items, bookings, range, newer))
    setBlocks((items) => mergeCalendarRange(items, blocks, range, newer))
    setCalendarUsers((items) => [...new Map([...items, ...users].map((entry) => [entry.id, entry])).values()])
    if (activeSession.current && personalBookings.current) {
      const inNewerRange = (booking: Booking) => newer.some(({ from, to }) => overlaps(booking.start, booking.end, from, to))
      const incoming = new Set(bookings.filter((booking) => booking.isMine).map((booking) => booking.id))
      const personal = personalBookings.current
      const known = new Map(personal.map((booking) => [booking.id, booking.status]))
      const changed = bookings.some((booking) => booking.isMine && !inNewerRange(booking) && known.get(booking.id) !== booking.status)
      const removed = personal.some((booking) => booking.status !== 'CANCELLED' && booking.status !== 'REJECTED' &&
        !incoming.has(booking.id) && overlaps(booking.start, booking.end, range.from, range.to) && !inNewerRange(booking))
      if (changed || removed) await refreshMyBookings()
    }
  }, [apiForSession, refreshMyBookings])

  const refreshCalendar = useCallback(async () => {
    if (!recentRanges.current.length) recentRanges.current = [defaultRange()]
    await Promise.all(recentRanges.current.map(loadCalendarRange))
  }, [loadCalendarRange])

  const setVisibleRange = useCallback((from: Date, to: Date) => {
    if (!(to > from)) return
    const paddedFrom = addDays(from, -1)
    const upperLimit = addDays(paddedFrom, 90)
    const paddedTo = addDays(to, 1)
    const range = { from: paddedFrom, to: paddedTo < upperLimit ? paddedTo : upperLimit }
    const key = rangeKey(range)
    recentRanges.current = [range, ...recentRanges.current.filter((entry) => rangeKey(entry) !== key)].slice(0, 4)
    if (!calendarReads.current.get(key)?.pending) void loadCalendarRange(range)
  }, [loadCalendarRange])

  const refreshKeyDesk = useCallback(async () => {
    const role = activeSession.current?.user.role
    if (!role || role === 'USER') return
    const api = apiForSession()
    const started = epoch.current
    await Promise.all([
      load('today', api.apiGetManagerToday, ({ bookings, users }) => {
        setManagerToday(bookings)
        setDeskUsers((items) => [...new Map([...items, ...users].map((entry) => [entry.id, entry])).values()])
      }),
      load('overdue', api.apiGetOverdueKeys, ({ bookings, users }) => {
        setOverdueKeys(bookings)
        setDeskUsers((items) => [...new Map([...items, ...users].map((entry) => [entry.id, entry])).values()])
      }),
      load('pending', async () => {
        const bookings = new Map<string, Booking>()
        const users = new Map<string, User>()
        for (let page = 1; ; page++) {
          const result = await api.apiGetPendingBookings(page)
          if (!result.ok) return result
          if (started !== epoch.current) return { ok: false, status: 0, message: translator.current('core.changed') } as const
          for (const booking of result.data.bookings) bookings.set(booking.id, booking)
          for (const user of result.data.users) users.set(user.id, user)
          if (page * result.data.limit >= result.data.total || !result.data.bookings.length) {
            return { ok: true, data: { bookings: [...bookings.values()].sort((a, b) => +new Date(a.start) - +new Date(b.start)), users: [...users.values()] } } as const
          }
        }
      }, ({ bookings, users }) => {
        setPendingQueue(bookings)
        setDeskUsers((items) => [...new Map([...items, ...users].map((entry) => [entry.id, entry])).values()])
      }),
    ])
  }, [apiForSession, load])

  const loadUsers = useCallback(async (query: UserQuery) => {
    if (activeSession.current?.user.role !== 'ADMIN') return
    userQuery.current = query
    const api = apiForSession()
    await load('users', () => api.apiGetUsers(query), ({ items, total }) => {
      setUsers(items)
      setUsersTotal(total)
    }, (message) => {
      setUsers([])
      setUsersTotal(0)
      addToast(localError(message), 'error')
    })
  }, [addToast, apiForSession, load, localError])

  const loadAudit = useCallback(async (query: AuditQuery) => {
    if (activeSession.current?.user.role !== 'ADMIN') return
    auditQuery.current = query
    const api = apiForSession()
    await load('audit', () => api.apiGetAuditLogs(query), ({ items, total }) => {
      setAudit(items)
      setAuditTotal(total)
    }, (message) => {
      setAudit([])
      setAuditTotal(0)
      addToast(localError(message), 'error')
    })
  }, [addToast, apiForSession, load, localError])

  const refreshRooms = useCallback(async () => {
    const role = activeSession.current?.user.role
    const api = apiForSession()
    await load('rooms', () => api.apiGetRooms(role === 'MANAGER' || role === 'ADMIN'), setRooms)
  }, [apiForSession, load])

  const refreshSettings = useCallback(async () => {
    await load('settings', apiForSession().apiGetSettings, setSettings)
  }, [apiForSession, load])

  const refreshData = useCallback(async () => {
    await Promise.all([
      refreshCalendar(), refreshRooms(), refreshMyBookings(), refreshKeyDesk(),
      refreshSettings(),
      userQuery.current && loadUsers(userQuery.current), auditQuery.current && loadAudit(auditQuery.current),
    ])
  }, [loadAudit, loadUsers, refreshCalendar, refreshKeyDesk, refreshMyBookings, refreshRooms, refreshSettings])

  useEffect(() => {
    if (!sessionRecovery) void refreshData()
  }, [refreshData, sessionRecovery, session])

  useEffect(() => {
    if (!session || session.user.role === 'USER') return
    const timer = window.setInterval(() => void refreshKeyDesk(), 60_000)
    return () => window.clearInterval(timer)
  }, [refreshKeyDesk, session])

  const renderedEpoch = epoch.current

  const startSession = ({ accessToken, user, expiresIn }: ApiAuth) => {
    if (renderedEpoch !== epoch.current) throw new Error(translator.current('core.changed'))
    if (!accessToken || !user || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new Error(t('core.invalidSession'))
    }
    const next = { token: accessToken, user: mapUser(user), expiresAt: Date.now() + expiresIn * 1000 }
    reset()
    clearLegacyStorage()
    install(next)
  }

  const authenticate = async (request: (api: Api) => ReturnType<Api['apiLogin']>): Promise<Result> => {
    if (renderedEpoch !== epoch.current) return translator.current('core.changed')
    const started = epoch.current
    const initialStorage = localStorage.getItem(TOKEN_KEY)
    const result = await request(createApi(null, () => {}))
    if (started !== epoch.current || localStorage.getItem(TOKEN_KEY) !== initialStorage) return translator.current('core.changed')
    if (!result.ok) return localError(result.message)
    try {
      startSession(result.data)
    } catch (error) {
      if (error instanceof Error) return error.message
      throw error
    }
    return null
  }

  const reconcileBookings = async () => {
    await Promise.all([refreshCalendar(), refreshMyBookings(), refreshKeyDesk()])
  }

  const mutate = async <T,>(request: (api: Api) => Promise<ApiResponse<T>>, onSuccess?: (data: T) => void | Promise<void>): Promise<Result> => {
    if (renderedEpoch !== epoch.current) return translator.current('core.changed')
    const started = epoch.current
    if (!activeSession.current) return t('core.signInRequired')
    const result = await request(apiForSession())
    if (started !== epoch.current) return !result.ok && result.status === 401 ? localError(result.message) : translator.current('core.changed')
    if (!result.ok) {
      if (result.status === 409) await reconcileBookings()
      return started === epoch.current ? localError(result.message) : translator.current('core.changed')
    }
    await onSuccess?.(result.data)
    return started === epoch.current ? null : translator.current('core.changed')
  }

  const reconcileTransition = async (booking: Booking) => {
    setBookings((items) => {
      if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') return items.filter((item) => item.id !== booking.id)
      return items.map((item) => item.id === booking.id ? { ...booking, passCode: null } : item)
    })
    setMyBookings((items) => items.map((item) => item.id === booking.id ? booking : item))
    if (activeSession.current?.user.role !== 'USER' && booking.status !== 'PENDING') {
      setPendingQueue((items) => items.filter((item) => item.id !== booking.id))
    }
    setManagerToday((items) => items.map((item) => item.id === booking.id ? booking : item))
    setOverdueKeys((items) => items.filter((item) => item.id !== booking.id || booking.status === 'KEY_CHECKED_OUT'))
    await reconcileBookings()
  }

  const postBooking = (input: BookingInput, isEvent: boolean) => mutate((api) => api.apiCreateBooking({
    roomId: input.roomId, title: input.title.trim(), attendeeCount: input.attendeeCount, isEvent,
    purpose: input.memberList?.length
      ? `${input.purpose.trim()} [Members: ${input.memberList.map((m) => `${m.name?.trim() ?? ''} (${[m.hcmutId && `HCMUT: ${m.hcmutId}`, m.utsId && `UTS: ${m.utsId}`].filter(Boolean).join(' · ')})`).join(', ')}]`
      : input.purpose.trim(),
    startTime: toCampusIso(input.start), endTime: toCampusIso(input.end),
  }), async (booking) => {
    if (recentRanges.current.some(({ from, to }) => overlaps(booking.start, booking.end, from, to))) {
      setBookings((items) => upsert(items, { ...booking, passCode: null }))
    }
    if (booking.isMine) setMyBookings((items) => upsert(items, booking))
    await reconcileBookings()
  })

  const createBlock = (input: BlockInput) => mutate((api) => api.apiCreateRoomBlock({
    roomId: input.roomId, startTime: toCampusIso(input.start), endTime: toCampusIso(input.end),
    reason: input.reason.trim(), displaceBookings: input.displace,
  }), async (block) => {
    setBlocks((items) => upsert(items, block))
    await reconcileBookings()
  })

  const refreshDirectory = async () => {
    await Promise.all([userQuery.current && loadUsers(userQuery.current), auditQuery.current && loadAudit(auditQuery.current)])
  }

  const currentUser = session?.user ?? null
  const connection = sessionRecovery === 'offline' || Object.values(reads).includes(false) ? 'offline' :
    !sessionRecovery && reads.rooms && reads.calendar && reads.settings &&
    (!currentUser || (reads.mine && (currentUser.role === 'USER' || (reads.today && reads.overdue && reads.pending)))) ? 'live' : 'connecting'
  const settingsLoaded = reads.settings === true && settings !== null

  const store: Store = {
    currentUser, users, usersTotal, rooms, bookings, myBookings, blocks, managerToday, overdueKeys, pendingQueue,
    settings: settings ?? INITIAL_SETTINGS, settingsLoaded, audit, auditTotal, toasts, connection,
    sessionRecovery, retrySession: syncSession,
    notify: (message, tone) => {
      if (renderedEpoch === epoch.current) addToast(message, tone)
    },
    login: (email, password) => authenticate((api) => api.apiLogin(email, password)),
    startSession,
    register: (input) => authenticate((api) => api.apiRegister(input)),
    logout, refreshData, refreshSettings, refreshMyBookings, refreshKeyDesk, setVisibleRange, loadUsers, loadAudit,
    updateProfile: ({ fullName }) => mutate((api) => api.apiUpdateProfile(fullName), (user) => {
      const current = activeSession.current
      // A sign-out or account switch in another tab may precede its storage event.
      if (!sameIdentity(readSession(localStorage.getItem(TOKEN_KEY)), current)) return syncSession()
      if (current && current.user.id === user.id) install({ ...current, user })
    }),
    createBooking: (input) => postBooking(input, false),
    cancelBooking: (id) => mutate((api) => api.apiCancelBooking(id), reconcileTransition),
    approveBooking: (id, note) => mutate((api) => api.apiApproveBooking(id, note), reconcileTransition),
    rejectBooking: (id, note) => mutate((api) => api.apiRejectBooking(id, note), reconcileTransition),
    checkoutKey: (id, passCode) => mutate((api) => api.apiCheckoutKey(id, passCode.trim()), reconcileTransition),
    returnKey: (id) => mutate((api) => api.apiReturnKey(id), reconcileTransition),
    createBlock,
    cancelBlock: (roomId, expected) => mutate((api) => api.apiCancelRoomBlock(roomId, expected && {
      startTime: expected.start.toISOString(), endTime: expected.end.toISOString(),
    }), async () => {
      setBlocks((items) => items.filter((block) => block.roomId !== roomId || (expected &&
        (+new Date(block.start) !== +expected.start || +new Date(block.end) !== +expected.end))))
      await reconcileBookings()
    }),
    saveRoom: (room) => mutate((api) => api.apiSaveRoom(room), async (saved) => {
      setRooms((items) => upsert(items, saved))
      await Promise.all([refreshRooms(), auditQuery.current && loadAudit(auditQuery.current)])
    }),
    setRoomStatus: (id, status) => mutate((api) => api.apiUpdateRoomStatus(id, status), async (saved) => {
      setRooms((items) => upsert(items, saved))
      await Promise.all([refreshRooms(), auditQuery.current && loadAudit(auditQuery.current)])
    }),
    updateUserRole: (id, role, studentCode) => mutate((api) => api.apiUpdateUserRole(id, role, studentCode), refreshDirectory),
    setUserStatus: (id, status) => mutate((api) => api.apiUpdateUserStatus(id, status), refreshDirectory),
    createManagerAccount: (input) => mutate((api) => api.apiCreateManager(input), refreshDirectory),
    updateSettings: (value) => settingsLoaded ? mutate((api) => api.apiUpdateSettings(value), async (saved) => {
      setReads((state) => ({ ...state, settings: true }))
      delete pending.current.settings
      setSettings(saved)
      if (auditQuery.current) await loadAudit(auditQuery.current)
    }) : Promise.resolve(t('core.settingsUnavailable')),
    assignRoomSchedule(input) {
      const category = input.category || 'EVENT'
      return input.mode === 'BLOCK'
        ? createBlock({ ...input, reason: `[${category}] ${input.title}: ${input.purpose}`, displace: input.displace ?? false })
        : postBooking({ ...input, title: `[${category}] ${input.title.trim()}`, attendeeCount: input.attendeeCount ?? 1 }, true)
    },
    validateSlot(roomId, start, end, ignoreBookingId) {
      const room = rooms.find((entry) => entry.id === roomId)
      if (!room) return t('core.roomMissing')
      if (room.status !== 'AVAILABLE') return t('core.roomUnavailable')
      if (!settings) return t('core.noRules')
      if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) return t('core.invalidEnd')
      const now = new Date()
      if (start <= now) return t('core.pastStart')
      if (start > addDays(now, settings.maxAdvanceDays)) return t('core.advance', { n: settings.maxAdvanceDays })
      if (!sameDay(start, end) || isWeekend(start)) return t('core.workday')
      const open = parseHM(settings.openTime)
      const close = parseHM(settings.closeTime)
      if (start < at(start, open.h, open.m) || end > at(end, close.h, close.m)) return t('core.openHours', { open: settings.openTime, close: settings.closeTime })
      if (durationMin(start, end) > settings.maxDurationMinutes) return t('core.duration', { n: settings.maxDurationMinutes })
      if (blocks.some((block) => block.active && block.roomId === roomId && overlaps(block.start, block.end, start, end))) return t('core.blocked')
      if (bookings.some((booking) => booking.id !== ignoreBookingId && booking.roomId === roomId &&
        ((!room.autoApprove && (booking.status === 'APPROVED' || booking.status === 'KEY_CHECKED_OUT')) || (booking.status === 'PENDING' && booking.isMine)) &&
        overlaps(booking.start, booking.end, start, end))) return t('core.booked')
      if (myBookings.some((booking) => booking.id !== ignoreBookingId && booking.roomId === roomId && booking.status === 'PENDING' && overlaps(booking.start, booking.end, start, end))) return t('core.myPending')
      return null
    },
    user: (id) => (currentUser && currentUser.id === id ? currentUser : users.find((entry) => entry.id === id) ?? calendarUsers.find((entry) => entry.id === id) ?? deskUsers.find((entry) => entry.id === id)),
    room: (id) => rooms.find((entry) => entry.id === id),
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const store = useContext(Ctx)
  if (!store) throw new Error('useStore outside provider')
  return store
}

export function useLookups() {
  const { user, room } = useStore()
  return { user, room }
}
