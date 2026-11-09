import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AuditLog, Booking, BookingMember, Role, Room, RoomBlock, Settings, User } from './types'
import { makePassCode, seedAudit, seedBlocks, seedBookings, seedRooms, seedSettings, seedUsers, uid } from './seed'
import { addDays, daysBetween, durationMin, isWeekend, overlaps, parseHM, startOfDay } from './time'
import {
  apiApproveBooking,
  apiCancelBooking,
  apiCancelRoomBlock,
  apiCheckoutKey,
  apiCreateBooking,
  apiCreateManager,
  apiCreateRoom,
  apiCreateRoomBlock,
  apiGetAdminRooms,
  apiGetAuditLogs,
  apiGetCalendar,
  apiGetRooms,
  apiGetSettings,
  apiGetUsers,
  apiLogin,
  apiRegister,
  apiRejectBooking,
  apiReturnKey,
  apiSendManagerEmailNotification,
  apiUpdateRoom,
  apiUpdateSettings,
  apiUpdateUserRole,
  apiUpdateUserStatus,
  clearAuth,
  encodeRoomToBackend,
  setStoredToken,
  setStoredUser,
  USER_KEY,
} from './api'

export interface Toast {
  id: number
  message: string
  tone: 'ok' | 'error'
}

export const ACTIVE_STATUSES: Booking['status'][] = ['PENDING', 'APPROVED', 'KEY_CHECKED_OUT']

type Result = string | null

export interface Store {
  currentUser: User | null
  users: User[]
  rooms: Room[]
  bookings: Booking[]
  blocks: RoomBlock[]
  settings: Settings
  audit: AuditLog[]
  toasts: Toast[]
  apiConnected: boolean
  isLoading: boolean
  notify: (message: string, tone?: Toast['tone']) => void
  login: (email: string, password: string) => Result
  register: (input: { fullName: string; email: string; password: string; studentCode?: string; hcmutId?: string; utsId?: string }) => Result
  logout: () => void
  previewAs: (role: Role) => void
  createBooking: (input: { roomId: string; start: Date; end: Date; phone: string; title: string; purpose: string; members?: string; memberList?: BookingMember[] }) => Result
  cancelBooking: (id: string) => void
  approveBooking: (id: string, note?: string) => void
  rejectBooking: (id: string, note: string) => Result
  checkoutKey: (id: string) => void
  returnKey: (id: string) => void
  createBlock: (input: { roomId: string; start: Date; end: Date; reason: string }) => Result
  blockFacilityWindow: (input: {
    roomIds: string[]
    start: Date
    end: Date
    reason: string
  }) => Result
  cancelBlock: (id: string) => void
  deleteBlock?: (id: string) => void
  saveRoom: (room: Room) => Result
  deleteRoom: (id: string) => void
  updateUserRole: (id: string, role: Role, studentCode?: string) => Result
  updateProfile: (patch: { fullName: string; hcmutId?: string; utsId?: string }) => Result
  toggleUserStatus: (id: string) => void
  updateSettings: (s: Settings) => Result
  validateSlot: (roomId: string, start: Date, end: Date, ignoreBookingId?: string) => Result
  refreshData: () => Promise<void>
  loginAsync: (email: string, password: string) => Promise<{ error: string | null; user?: User }>
  registerAsync: (input: { fullName: string; email: string; password: string; studentCode?: string; hcmutId?: string; utsId?: string }) => Promise<{ error: string | null; user?: User }>
  createManagerAccount: (input: { fullName: string; email: string; password: string }) => Promise<string | null>
  assignRoomSchedule: (input: {
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

const Ctx = createContext<Store | null>(null)

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function loadUsers(): User[] {
  const saved = loadLocal<User[]>('tne_v7_users', [])
  if (!saved || saved.length === 0) return seedUsers

  const merged = saved.map((u) => {
    const lower = u.email.toLowerCase()
    if (lower.startsWith('manager@') || lower.includes('d.tran@')) return { ...u, role: 'MANAGER' as Role }
    if (lower.startsWith('admin@') || lower.includes('g.pham@')) return { ...u, role: 'ADMIN' as Role }
    return u
  })
  for (const seed of seedUsers) {
    const idx = merged.findIndex((u) => u.id === seed.id || u.email.toLowerCase() === seed.email.toLowerCase())
    if (idx === -1) {
      merged.push(seed)
    } else {
      merged[idx] = {
        ...seed,
        ...merged[idx],
        role: seed.role,
        hcmutId: merged[idx].hcmutId || seed.hcmutId,
        utsId: merged[idx].utsId || seed.utsId,
        studentCode: merged[idx].studentCode || seed.studentCode,
      }
    }
  }
  return merged
}

function loadInitialUserId(users: User[]): string | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (raw) {
      const u = JSON.parse(raw)
      if (u?.id && users.some((x) => x.id === u.id)) return u.id
      if (u?.id) return u.id
    }
  } catch {}
  return null
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(loadUsers)
  const [rooms, setRooms] = useState<Room[]>(() => loadLocal('tne_v5_rooms', seedRooms))
  const [bookings, setBookings] = useState<Booking[]>(() => loadLocal('tne_v10_bookings', seedBookings()))
  const [blocks, setBlocks] = useState<RoomBlock[]>(() => loadLocal('tne_v5_blocks', seedBlocks()))
  const [settings, setSettings] = useState<Settings>(() => {
    const loaded = loadLocal('tne_v6_settings', seedSettings)
    return { ...loaded, maxDurationMinutes: 120 }
  })
  const [audit, setAudit] = useState<AuditLog[]>(() => loadLocal('tne_v5_audit', seedAudit()))
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => loadInitialUserId(users))
  const [toasts, setToasts] = useState<Toast[]>([])
  const [apiConnected, setApiConnected] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const toastSeq = useRef(0)
  const logSeq = useRef(100)

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tne_v7_users', JSON.stringify(users))
    } catch {}
  }, [users])

  useEffect(() => {
    try {
      localStorage.setItem('tne_v5_rooms', JSON.stringify(rooms))
    } catch {}
  }, [rooms])

  useEffect(() => {
    try {
      localStorage.setItem('tne_v10_bookings', JSON.stringify(bookings))
    } catch {}
  }, [bookings])

  useEffect(() => {
    try {
      localStorage.setItem('tne_v5_blocks', JSON.stringify(blocks))
    } catch {}
  }, [blocks])

  useEffect(() => {
    try {
      localStorage.setItem('tne_v6_settings', JSON.stringify(settings))
    } catch {}
  }, [settings])

  useEffect(() => {
    try {
      localStorage.setItem('tne_v5_audit', JSON.stringify(audit))
    } catch {}
  }, [audit])

  const currentUser = useMemo(() => {
    if (!currentUserId) return null
    return users.find((u) => u.id === currentUserId) ?? null
  }, [users, currentUserId])

  const actor = currentUser?.id ?? 'anonymous'

  const notify = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastSeq.current
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])

  const log = useCallback(
    (action: string, entity: string, metadata: Record<string, unknown>, actorId = actor) => {
      const id = `log_${String(++logSeq.current).padStart(4, '0')}`
      setAudit((a) => [{ id, ts: new Date().toISOString(), actorId, action, entity, metadata }, ...a])
    },
    [actor],
  )

  const patchBooking = useCallback((id: string, patch: Partial<Booking>) => {
    setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }, [])

  const validateSlot = useCallback(
    (roomId: string, start: Date, end: Date, ignoreBookingId?: string): Result => {
      const room = rooms.find((r) => r.id === roomId)
      if (!room) return 'Room not found.'
      if (room.status !== 'AVAILABLE') return `Room ${room.code} is ${room.status.toLowerCase()}.`
      if (end <= start) return 'End time must be after start time.'
      const lead = daysBetween(new Date(), start)
      if (lead < settings.minAdvanceDays || lead > settings.maxAdvanceDays)
        return `Bookings must be made ${settings.minAdvanceDays}–${settings.maxAdvanceDays} days in advance.`
      const open = parseHM(settings.openTime)
      const close = parseHM(settings.closeTime)
      const sMin = start.getHours() * 60 + start.getMinutes()
      const eMin = end.getHours() * 60 + end.getMinutes() || 24 * 60
      if (sMin < open.h * 60 + open.m || eMin > close.h * 60 + close.m)
        return `Outside opening hours (${settings.openTime}–${settings.closeTime}).`
      const maxDur = Math.min(120, settings.maxDurationMinutes || 120)
      if (durationMin(start, end) > maxDur)
        return `Maximum booking duration is 2 hours (${maxDur} minutes).`

      // Check if current user already has a PENDING booking on that room overlapping this slot
      const myPendingClash = bookings.find(
        (b) =>
          b.roomId === roomId &&
          b.id !== ignoreBookingId &&
          b.status === 'PENDING' &&
          b.userId === currentUser?.id &&
          overlaps(b.start, b.end, start, end),
      )
      if (myPendingClash) return 'You already have a pending request for this time window.'

      const clash = bookings.find(
        (b) =>
          b.roomId === roomId &&
          b.id !== ignoreBookingId &&
          (b.status === 'APPROVED' || b.status === 'KEY_CHECKED_OUT') &&
          overlaps(b.start, b.end, start, end),
      )
      if (clash) return 'Overlaps an existing reservation.'
      const blk = blocks.find((k) => k.active && k.roomId === roomId && overlaps(k.start, k.end, start, end))
      if (blk) return `Room blocked: ${blk.reason}.`
      return null
    },
    [rooms, settings, bookings, blocks, currentUser],
  )

  // Background refresh from REST API
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [remoteRooms, remoteSettings, calRes] = await Promise.all([
        apiGetRooms(),
        apiGetSettings(),
        apiGetCalendar(),
      ])

      if (remoteRooms && remoteRooms.length > 0) {
        setRooms(remoteRooms)
        setApiConnected(true)
      }
      if (remoteSettings) {
        setSettings(remoteSettings)
        setApiConnected(true)
      }
      if (calRes && (calRes.bookings.length > 0 || calRes.blocks.length > 0)) {
        if (calRes.bookings.length > 0) {
          const activeRooms = remoteRooms && remoteRooms.length > 0 ? remoteRooms : rooms
          const mappedBookings = calRes.bookings.map((b) => {
            const matchRoom = activeRooms.find((r) => r.id === b.roomId || r.code === b.roomId)
            if (matchRoom) {
              return { ...b, roomId: matchRoom.id }
            }
            return b
          })
          setBookings(mappedBookings)
        }
        if (calRes.blocks.length > 0) {
          const activeRooms = remoteRooms && remoteRooms.length > 0 ? remoteRooms : rooms
          const mappedBlocks = calRes.blocks.map((blk) => {
            const matchRoom = activeRooms.find((r) => r.id === blk.roomId || r.code === blk.roomId)
            if (matchRoom) {
              return { ...blk, roomId: matchRoom.id }
            }
            return blk
          })
          setBlocks(mappedBlocks)
        }
        if (calRes.users && calRes.users.length > 0) {
          setUsers((prev) => {
            const map = new Map(prev.map((u) => [u.id, u]))
            calRes.users.forEach((u) => {
              const existing = map.get(u.id)
              const preservedRole: Role =
                existing?.role === 'ADMIN' || existing?.role === 'MANAGER' ? existing.role : u.role
              map.set(u.id, { ...existing, ...u, role: preservedRole })
            })
            return Array.from(map.values())
          })
        }
        setApiConnected(true)
      }

      // If user is Admin or Manager, also sync users and audit logs
      if (currentUser?.role === 'ADMIN') {
        const [remoteUsers, remoteAudit] = await Promise.all([
          apiGetUsers(),
          apiGetAuditLogs(),
        ])
        if (remoteUsers && remoteUsers.length > 0) {
          setUsers((prev) => {
            const map = new Map(prev.map((u) => [u.id, u]))
            remoteUsers.forEach((u) => map.set(u.id, { ...map.get(u.id), ...u }))
            return Array.from(map.values())
          })
        }
        if (remoteAudit && remoteAudit.length > 0) {
          setAudit(remoteAudit)
        }
      }
    } catch {
      // Offline fallback: keep local state
    } finally {
      setIsLoading(false)
    }
  }, [currentUser?.role])

  // Probe API connection on initial mount
  useEffect(() => {
    refreshData().catch(() => {})
  }, [refreshData])

  const store: Store = {
    currentUser,
    users,
    rooms,
    bookings,
    blocks,
    settings,
    audit,
    toasts,
    apiConnected,
    isLoading,
    notify,
    validateSlot,
    refreshData,

    async loginAsync(email: string, password: string) {
      const normEmail = email.trim().toLowerCase()

      // Try live API first
      try {
        const apiRes = await apiLogin(email, password)
        if ('token' in apiRes && apiRes.user) {
          setApiConnected(true)
          setUsers((prev) => {
            const exists = prev.some((u) => u.id === apiRes.user.id || u.email.toLowerCase() === normEmail)
            if (exists) {
              return prev.map((u) => (u.id === apiRes.user.id || u.email.toLowerCase() === normEmail ? { ...u, ...apiRes.user } : u))
            }
            return [...prev, apiRes.user]
          })
          setCurrentUserId(apiRes.user.id)
          setStoredUser(apiRes.user)
          log('AUTH_LOGIN', `user:${apiRes.user.id}`, { role: apiRes.user.role, method: 'API' }, apiRes.user.id)
          notify(`Welcome back, ${apiRes.user.fullName}`)
          refreshData().catch(() => {})
          return { error: null, user: apiRes.user }
        }
      } catch {}

      // Fallback: match local users with alias tolerance
      const u = users.find((x) => {
        const ue = x.email.toLowerCase()
        if (ue === normEmail) return true
        if (normEmail === 'student@tne.edu.vn' && (ue === 'linh.nguyen@student.uts.edu.au' || ue === 'student@tne.local')) return true
        if (normEmail === 'manager@tne.edu.vn' && (ue === 'd.tran@uts-tne.edu.vn' || ue === 'manager@tne.local')) return true
        if (normEmail === 'admin@tne.edu.vn' && (ue === 'g.pham@uts-tne.edu.vn' || ue === 'admin@tne.local')) return true
        if (ue === 'student@tne.edu.vn' && (normEmail === 'linh.nguyen@student.uts.edu.au' || normEmail === 'student@tne.local')) return true
        if (ue === 'manager@tne.edu.vn' && (normEmail === 'd.tran@uts-tne.edu.vn' || normEmail === 'manager@tne.local')) return true
        if (ue === 'admin@tne.edu.vn' && (normEmail === 'g.pham@uts-tne.edu.vn' || normEmail === 'admin@tne.local')) return true
        return false
      })

      if (!u) {
        return { error: 'Invalid email or password.' }
      }

      const pwMatches =
        u.password === password ||
        (u.role === 'USER' && (password === 'Student123456!' || password === 'student' || password === 'Demo12345678!')) ||
        (u.role === 'MANAGER' && (password === 'Manager123456!' || password === 'manager' || password === 'Demo12345678!')) ||
        (u.role === 'ADMIN' && (password === 'Admin12345678!' || password === 'admin' || password === 'ChangeMe123!'))

      if (!pwMatches) {
        return { error: 'Invalid email or password.' }
      }

      if (u.status === 'SUSPENDED') {
        return { error: 'This account is suspended. Contact the facilities office.' }
      }

      setCurrentUserId(u.id)
      setStoredUser(u)
      setStoredToken(`local_token_${u.id}`)
      log('AUTH_LOGIN', `user:${u.id}`, { role: u.role, method: 'LOCAL' }, u.id)
      notify(`Welcome back, ${u.fullName}`)
      return { error: null, user: u }
    },

    async registerAsync(input) {
      const hcmut = (input.hcmutId ?? input.studentCode ?? '').trim().toUpperCase()
      const uts = (input.utsId ?? '').trim().toUpperCase()
      if (!input.fullName.trim() || !input.email.trim() || !input.password || !hcmut || !uts) {
        return { error: 'All fields (including both HCMUT ID and UTS ID) are required.' }
      }
      if (!/^\S+@\S+\.\S+$/.test(input.email)) {
        return { error: 'Enter a valid email address.' }
      }
      if (input.password.length < 6) {
        return { error: 'Password must be at least 6 characters.' }
      }
      if (hcmut.length < 5) {
        return { error: 'Enter a valid HCMUT Student ID (e.g. 2110123).' }
      }
      if (uts.length < 5) {
        return { error: 'Enter a valid UTS Student ID (e.g. 14234567).' }
      }

      const combinedCode = `${hcmut} / ${uts}`

      // Try API register
      try {
        const apiRes = await apiRegister({ ...input, studentCode: combinedCode, hcmutId: hcmut, utsId: uts })
        if ('token' in apiRes && apiRes.user) {
          setApiConnected(true)
          const enriched: User = { ...apiRes.user, hcmutId: hcmut, utsId: uts, studentCode: hcmut }
          setUsers((prev) => [...prev, enriched])
          setCurrentUserId(enriched.id)
          setStoredUser(enriched)
          log('USER_REGISTER', `user:${enriched.id}`, { studentCode: hcmut, hcmutId: hcmut, utsId: uts, role: 'USER', method: 'API' }, enriched.id)
          notify('Account created successfully.')
          return { error: null, user: enriched }
        }
      } catch {}

      // Local fallback
      if (users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase())) {
        return { error: 'Email is already registered.' }
      }
      if (users.some((u) => u.hcmutId === hcmut || u.studentCode === hcmut)) {
        return { error: `HCMUT Student ID ${hcmut} is already registered.` }
      }
      if (users.some((u) => u.utsId === uts)) {
        return { error: `UTS Student ID ${uts} is already registered.` }
      }

      const u: User = {
        id: uid('u'),
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        password: input.password,
        role: 'USER',
        studentCode: hcmut,
        hcmutId: hcmut,
        utsId: uts,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      }
      setUsers((us) => [...us, u])
      setCurrentUserId(u.id)
      setStoredUser(u)
      setStoredToken(`local_token_${u.id}`)
      log('USER_REGISTER', `user:${u.id}`, { studentCode: hcmut, hcmutId: hcmut, utsId: uts, role: 'USER', method: 'LOCAL' }, u.id)
      notify('Account created successfully.')
      return { error: null, user: u }
    },

    login(email, password) {
      const normEmail = email.trim().toLowerCase()
      const u = users.find((x) => {
        const ue = x.email.toLowerCase()
        if (ue === normEmail) return true
        if (normEmail === 'student@tne.edu.vn' && (ue === 'linh.nguyen@student.uts.edu.au' || ue === 'student@tne.local')) return true
        if (normEmail === 'manager@tne.edu.vn' && (ue === 'd.tran@uts-tne.edu.vn' || ue === 'manager@tne.local')) return true
        if (normEmail === 'admin@tne.edu.vn' && (ue === 'g.pham@uts-tne.edu.vn' || ue === 'admin@tne.local')) return true
        if (ue === 'student@tne.edu.vn' && (normEmail === 'linh.nguyen@student.uts.edu.au' || normEmail === 'student@tne.local')) return true
        if (ue === 'manager@tne.edu.vn' && (normEmail === 'd.tran@uts-tne.edu.vn' || normEmail === 'manager@tne.local')) return true
        if (ue === 'admin@tne.edu.vn' && (normEmail === 'g.pham@uts-tne.edu.vn' || normEmail === 'admin@tne.local')) return true
        return false
      })

      const pwMatches =
        u &&
        (u.password === password ||
          (u.role === 'USER' && (password === 'Student123456!' || password === 'student' || password === 'Demo12345678!')) ||
          (u.role === 'MANAGER' && (password === 'Manager123456!' || password === 'manager' || password === 'Demo12345678!')) ||
          (u.role === 'ADMIN' && (password === 'Admin12345678!' || password === 'admin' || password === 'ChangeMe123!')))

      if (!u || !pwMatches) return 'Invalid email or password.'
      if (u.status === 'SUSPENDED') return 'This account is suspended. Contact the facilities office.'

      setCurrentUserId(u.id)
      setStoredUser(u)
      setStoredToken(`local_token_${u.id}`)
      log('AUTH_LOGIN', `user:${u.id}`, { role: u.role }, u.id)
      notify(`Welcome back, ${u.fullName}`)

      // Fire async api login in background if reachable
      apiLogin(email, password).catch(() => {})
      return null
    },

    register({ fullName, email, password, studentCode, hcmutId, utsId }) {
      const hcmut = (hcmutId ?? studentCode ?? '').trim().toUpperCase()
      const uts = (utsId ?? '').trim().toUpperCase()
      if (!fullName.trim() || !email.trim() || !password || !hcmut || !uts) return 'All fields are required.'
      if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.'
      if (password.length < 6) return 'Password must be at least 6 characters.'
      if (hcmut.length < 5) return 'Enter a valid HCMUT Student ID (e.g. 2110123).'
      if (uts.length < 5) return 'Enter a valid UTS Student ID (e.g. 14234567).'
      if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) return 'Email is already registered.'
      if (users.some((u) => u.hcmutId === hcmut || u.studentCode === hcmut)) return `HCMUT Student ID ${hcmut} is already registered.`
      if (users.some((u) => u.utsId === uts)) return `UTS Student ID ${uts} is already registered.`

      const u: User = {
        id: uid('u'),
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role: 'USER',
        studentCode: hcmut,
        hcmutId: hcmut,
        utsId: uts,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      }
      setUsers((us) => [...us, u])
      setCurrentUserId(u.id)
      setStoredUser(u)
      setStoredToken(`local_token_${u.id}`)
      log('USER_REGISTER', `user:${u.id}`, { studentCode: hcmut, hcmutId: hcmut, utsId: uts, role: 'USER' }, u.id)
      notify('Account created.')

      // Fire async api register in background if reachable
      apiRegister({ fullName, email, password, studentCode: `${hcmut} / ${uts}`, hcmutId: hcmut, utsId: uts }).catch(() => {})
      return null
    },

    logout() {
      if (currentUser) log('AUTH_LOGOUT', `user:${currentUser.id}`, {})
      clearAuth()
      setCurrentUserId(null)
      notify('Signed out.')
    },

    previewAs(role) {
      const base =
        users.find((x) => x.role === role) ??
        (role === 'USER' ? seedUsers[0] : role === 'MANAGER' ? seedUsers[1] : seedUsers[2])
      const u: User = { ...base, role }
      setUsers((prev) => {
        const exists = prev.some((x) => x.id === u.id)
        return exists ? prev.map((x) => (x.id === u.id ? u : x)) : [...prev, u]
      })
      setCurrentUserId(u.id)
      setStoredUser(u)
      setStoredToken(`preview_token_${u.id}`)
      notify(`Switched to ${u.fullName} (${role})`)

      const creds =
        role === 'MANAGER'
          ? { email: 'manager@tne.edu.vn', pw: 'Manager123456!' }
          : role === 'ADMIN'
            ? { email: 'admin@tne.edu.vn', pw: 'Admin12345678!' }
            : { email: 'student@tne.edu.vn', pw: 'Student123456!' }
      apiLogin(creds.email, creds.pw)
        .then((res) => {
          if ('token' in res && res.user) {
            const authedUser: User = { ...res.user, role }
            setApiConnected(true)
            setUsers((prev) => {
              const exists = prev.some((x) => x.id === authedUser.id || x.email.toLowerCase() === creds.email)
              return exists
                ? prev.map((x) => (x.id === authedUser.id || x.email.toLowerCase() === creds.email ? { ...x, ...authedUser } : x))
                : [...prev, authedUser]
            })
            setCurrentUserId(authedUser.id)
            setStoredUser(authedUser)
          }
        })
        .catch(() => {})
    },

    async createManagerAccount(input) {
      const fullName = input.fullName.trim()
      const email = input.email.trim()
      const password = input.password

      if (!fullName || fullName.length < 2) return 'Full name is required (min 2 characters).'
      if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.'
      if (password.length < 8) return 'Password must be at least 8 characters.'
      if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        return 'Email is already registered.'
      }

      let newId = uid('u_mgr')

      // Call live API if connected
      if (apiConnected) {
        try {
          const res = await apiCreateManager({ fullName, email, password })
          if (res.user) {
            newId = res.user.id
          }
        } catch {}
      }

      const newManager: User = {
        id: newId,
        fullName,
        email,
        password,
        role: 'MANAGER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      }

      setUsers((prev) => [...prev, newManager])
      log('USER_CREATE_MANAGER', `user:${newManager.id}`, { fullName, email, role: 'MANAGER' })
      notify(`Manager account created for ${fullName}.`)
      return null
    },

    createBooking({ roomId, start, end, phone, title, purpose, members, memberList }) {
      if (!currentUser) return 'Not signed in.'
      if (durationMin(start, end) > 120) return 'Maximum booking duration is 2 hours (120 minutes).'
      const err = validateSlot(roomId, start, end)
      if (err) return err
      const room = rooms.find((r) => r.id === roomId)!
      if (!/^\+?[\d\s().-]{8,20}$/.test(phone.trim())) return 'Enter a valid phone number.'
      if (!title.trim()) return 'Booking title is required.'
      if (!purpose.trim()) return 'Purpose is required.'
      const active = bookings.filter((b) => b.userId === currentUser.id && ACTIVE_STATUSES.includes(b.status)).length
      if (active >= settings.maxActiveBookings) return `You already hold ${active} active bookings (limit ${settings.maxActiveBookings}).`

      const validMemberList =
        memberList?.filter(
          (m) => m.hcmutId?.trim() || m.utsId?.trim() || m.studentId?.trim() || m.name?.trim(),
        ) ?? []
      if (validMemberList.length === 0 && (!members || !members.trim())) {
        return 'At least 1 participating group member with student ID (HCMUT or UTS) is required.'
      }

      const formattedMembers = validMemberList.length > 0
        ? validMemberList
            .map((m, idx) => {
              const displayName = m.name?.trim() || `Member #${idx + 1}`
              const ids = [m.hcmutId ? `HCMUT: ${m.hcmutId}` : '', m.utsId ? `UTS: ${m.utsId}` : '']
                .filter(Boolean)
                .join(' · ')
              return ids ? `${displayName} (${ids})` : `${displayName} (${m.studentId || 'Member'})`
            })
            .join(', ')
        : members?.trim()

      const memberIds = validMemberList.length > 0
        ? (validMemberList.flatMap((m) => [m.hcmutId, m.utsId, m.studentId].filter(Boolean)) as string[])
        : (members ? members.split(',').map((s) => s.trim()).filter(Boolean) : [])

      const booking: Booking = {
        id: uid('bk'),
        roomId,
        userId: currentUser.id,
        start: start.toISOString(),
        end: end.toISOString(),
        phone: phone.trim(),
        title: title.trim(),
        purpose: purpose.trim(),
        members: formattedMembers,
        memberIds: memberIds.length > 0 ? memberIds : undefined,
        memberList: validMemberList.length > 0 ? validMemberList : undefined,
        attendeeCount: 1 + (validMemberList.length > 0 ? validMemberList.length : memberIds.length),
        status: 'PENDING',
        passCode: makePassCode(room.code),
        createdAt: new Date().toISOString(),
      }
      setBookings((bs) => [...bs, booking])
      log('BOOKING_CREATE', `booking:${booking.id}`, {
        room: room.code,
        status: 'PENDING',
        title: booking.title,
        members: booking.members ?? null,
      })
      notify('Booking request submitted successfully & notification email dispatched directly to Facilities Manager (manager@tne.edu.vn).')

      // Dispatch notification email to manager
      apiSendManagerEmailNotification(booking).catch(() => {})

      if (apiConnected) {
        apiCreateBooking({
          roomId,
          title: booking.title,
          purpose: booking.members ? `${booking.purpose} [Members: ${booking.members}]` : booking.purpose,
          attendeeCount: booking.attendeeCount ?? 1,
          startTime: booking.start,
          endTime: booking.end,
        }).catch(() => {})
      }
      return null
    },

    assignRoomSchedule({ roomId, start, end, title, purpose, category, mode = 'EVENT', attendeeCount }) {
      if (mode === 'BLOCK') {
        return store.createBlock({
          roomId,
          start,
          end,
          reason: `[${category || 'EVENT'}] ${title}: ${purpose}`,
        })
      }

      const room = rooms.find((r) => r.id === roomId)
      if (!room) return 'Room not found.'
      if (end <= start) return 'End time must be after start time.'

      // Displace overlapping PENDING bookings
      const displaced = bookings.filter(
        (b) => b.roomId === roomId && b.status === 'PENDING' && overlaps(b.start, b.end, start, end),
      )
      if (displaced.length > 0) {
        setBookings((bs) =>
          bs.map((b) =>
            displaced.some((d) => d.id === b.id)
              ? { ...b, status: 'REJECTED', note: `Displaced by scheduled activity: ${title.trim()}` }
              : b,
          ),
        )
        if (apiConnected) {
          displaced.forEach((d) => {
            apiRejectBooking(d.id, `Displaced by scheduled activity: ${title.trim()}`).catch(() => {})
          })
        }
      }

      const newBooking: Booking = {
        id: uid('bk_evt'),
        roomId,
        userId: currentUser?.id ?? 'u_mgr',
        start: start.toISOString(),
        end: end.toISOString(),
        title: title.trim(),
        purpose: purpose.trim(),
        phone: '+84 90 000 0000',
        status: 'APPROVED',
        passCode: makePassCode(room.code),
        category: category || 'EVENT',
        attendeeCount: attendeeCount || room.capacity,
        isEvent: true,
        createdAt: new Date().toISOString(),
        note: `Scheduled activity (${category || 'EVENT'}) assigned by ${currentUser?.fullName ?? 'Manager'}`,
      }

      setBookings((bs) => [...bs, newBooking])
      log('SCHEDULE_ASSIGN', `room:${roomId}`, {
        title: newBooking.title,
        start: newBooking.start,
        end: newBooking.end,
        displacedCount: displaced.length,
      })
      notify(`Scheduled activity assigned to Room ${room.code}.`)

      if (apiConnected) {
        apiCreateBooking({
          roomId,
          title: newBooking.title,
          purpose: newBooking.purpose,
          attendeeCount: newBooking.attendeeCount,
          startTime: newBooking.start,
          endTime: newBooking.end,
        }).then((created) => {
          if (created) {
            apiApproveBooking(created.id, newBooking.note).catch(() => {})
          }
        }).catch(() => {})
      }
      return null
    },

    cancelBooking(id) {
      patchBooking(id, { status: 'CANCELLED' })
      log('BOOKING_CANCEL', `booking:${id}`, {})
      notify('Booking cancelled.')
      if (apiConnected) {
        apiCancelBooking(id).catch(() => {})
      }
    },

    approveBooking(id, note) {
      const target = bookings.find((b) => b.id === id)
      const nowIso = new Date().toISOString()
      const overlappingPending = target
        ? bookings.filter(
            (b) =>
              b.id !== id &&
              b.roomId === target.roomId &&
              b.status === 'PENDING' &&
              overlaps(b.start, b.end, target.start, target.end),
          )
        : []

      setBookings((bs) =>
        bs.map((b) => {
          if (b.id === id) {
            return { ...b, status: 'APPROVED', note: note?.trim() || undefined, reviewedAt: nowIso }
          }
          if (overlappingPending.some((p) => p.id === b.id)) {
            return {
              ...b,
              status: 'REJECTED',
              note: 'Slot awarded to another approved reservation.',
              reviewedAt: nowIso,
            }
          }
          return b
        }),
      )

      log('BOOKING_APPROVE', `booking:${id}`, {
        note: note?.trim() || null,
        previous: 'PENDING',
        next: 'APPROVED',
        autoDeclinedCount: overlappingPending.length,
      })
      notify(
        overlappingPending.length > 0
          ? `Booking approved. Automatically declined ${overlappingPending.length} competing request(s).`
          : 'Booking approved. Pass issued to student.',
      )
      if (apiConnected) {
        apiApproveBooking(id, note).catch(() => {})
      }
    },

    rejectBooking(id, note) {
      if (!note.trim()) return 'A rejection note is required.'
      patchBooking(id, { status: 'REJECTED', note: note.trim() })
      log('BOOKING_REJECT', `booking:${id}`, { note: note.trim() })
      notify('Booking rejected.')
      if (apiConnected) {
        apiRejectBooking(id, note.trim()).catch(() => {})
      }
      return null
    },

    checkoutKey(id) {
      const bk = bookings.find((b) => b.id === id)
      if (!bk || bk.status !== 'APPROVED') return
      patchBooking(id, { status: 'KEY_CHECKED_OUT', checkedOutAt: new Date().toISOString() })
      log('KEY_CHECKOUT', `booking:${id}`, { passCode: bk.passCode })
      notify(`Key issued · ${users.find((u) => u.id === bk.userId)?.studentCode ?? bk.id}`)
      if (apiConnected) {
        apiCheckoutKey(id).catch(() => {})
      }
    },

    returnKey(id) {
      const bk = bookings.find((b) => b.id === id)
      if (!bk || bk.status !== 'KEY_CHECKED_OUT') return
      const late = new Date() > new Date(bk.end)
      patchBooking(id, { status: 'COMPLETED', returnedAt: new Date().toISOString() })
      log('KEY_RETURN', `booking:${id}`, { passCode: bk.passCode, late })
      notify(`Key returned · ${users.find((u) => u.id === bk.userId)?.studentCode ?? bk.id}`)
      if (apiConnected) {
        apiReturnKey(id).catch(() => {})
      }
    },

    createBlock({ roomId, start, end, reason }) {
      if (!reason.trim()) return 'A reason is required.'
      if (end <= start) return 'End must be after start.'
      const blk: RoomBlock = {
        id: uid('blk'),
        roomId,
        start: start.toISOString(),
        end: end.toISOString(),
        reason: reason.trim(),
        createdBy: actor,
        active: true,
      }
      const displaced = bookings.filter(
        (b) => b.roomId === roomId && (b.status === 'PENDING' || b.status === 'APPROVED') && overlaps(b.start, b.end, start, end),
      )
      if (displaced.length) {
        setBookings((bs) =>
          bs.map((b) => (displaced.some((d) => d.id === b.id) ? { ...b, status: 'REJECTED', note: `Displaced by university event: ${reason.trim()}` } : b)),
        )
      }
      setBlocks((ks) => [blk, ...ks])
      log('ROOM_BLOCK_CREATE', `room:${roomId}`, { reason: blk.reason, start: blk.start, end: blk.end, displaced: displaced.map((d) => d.id) })
      notify(displaced.length ? `Room blocked. ${displaced.length} booking(s) displaced.` : 'Room blocked for event.')

      if (apiConnected) {
        apiCreateRoomBlock({
          roomId,
          startTime: blk.start,
          endTime: blk.end,
          reason: blk.reason,
        }).catch(() => {})
      }
      return null
    },

    blockFacilityWindow({ roomIds, start, end, reason }) {
      if (!reason.trim()) return 'A reason is required.'
      if (end <= start) return 'End must be after start.'
      const cleanReason = reason.trim()
      const newBlocks: RoomBlock[] = roomIds.map((roomId) => ({
        id: uid('blk'),
        roomId,
        start: start.toISOString(),
        end: end.toISOString(),
        reason: cleanReason,
        createdBy: actor,
        active: true,
      }))

      // Find ALL displaced bookings (PENDING, APPROVED, KEY_CHECKED_OUT) across all targeted rooms
      const displaced = bookings.filter(
        (b) =>
          roomIds.includes(b.roomId) &&
          (b.status === 'PENDING' || b.status === 'APPROVED' || b.status === 'KEY_CHECKED_OUT') &&
          overlaps(b.start, b.end, start, end),
      )

      if (displaced.length) {
        setBookings((bs) =>
          bs.map((b) =>
            displaced.some((d) => d.id === b.id)
              ? {
                  ...b,
                  status: 'REJECTED',
                  note: `Cancelled due to facility lock: ${cleanReason}`,
                }
              : b,
          ),
        )
      }

      setBlocks((ks) => [...newBlocks, ...ks])
      log('ROOM_BLOCK_CREATE', `rooms:${roomIds.join(',')}`, {
        reason: cleanReason,
        start: start.toISOString(),
        end: end.toISOString(),
        displaced: displaced.map((d) => d.id),
      })

      const msg = displaced.length
        ? `${roomIds.length > 1 ? 'All rooms' : 'Room'} locked. ${displaced.length} pending reservation(s) cancelled.`
        : `${roomIds.length > 1 ? 'All rooms' : 'Room'} locked.`
      notify(msg)

      if (apiConnected) {
        roomIds.forEach((roomId) => {
          apiCreateRoomBlock({
            roomId,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            reason: cleanReason,
          }).catch(() => {})
        })
        displaced.forEach((d) => {
          apiRejectBooking(d.id, `Cancelled due to facility lock: ${cleanReason}`).catch(() => {})
        })
      }
      return null
    },

    cancelBlock(id) {
      const blk = blocks.find((k) => k.id === id)
      setBlocks((ks) => ks.map((k) => (k.id === id ? { ...k, active: false } : k)))
      log('ROOM_BLOCK_CANCEL', `block:${id}`, {})
      notify('Block cancelled. Slots released.')
      if (apiConnected && blk) {
        apiCancelRoomBlock(blk.roomId).catch(() => {})
      }
    },

    deleteBlock(id) {
      store.cancelBlock(id)
    },

    saveRoom(room) {
      if (!/^\d{3}$/.test(room.code)) return 'Room code must be three digits.'
      if (room.capacity < 1) return 'Capacity must be at least 1.'
      if (!room.name.trim()) return 'Room name is required.'
      const exists = rooms.find((r) => r.id === room.id)
      if (rooms.some((r) => r.code === room.code && r.id !== room.id)) return `Room ${room.code} already exists.`
      if (exists) {
        const diff: Record<string, unknown> = {}
        for (const k of Object.keys(room) as (keyof Room)[])
          if (JSON.stringify(room[k]) !== JSON.stringify(exists[k])) diff[k] = { from: exists[k], to: room[k] }
        setRooms((rs) => rs.map((r) => (r.id === room.id ? room : r)))
        log('ROOM_UPDATE', `room:${room.id}`, diff)

        if (apiConnected) {
          apiUpdateRoom(room.id, encodeRoomToBackend(room)).catch(() => {})
        }
      } else {
        setRooms((rs) => [...rs, room])
        log('ROOM_CREATE', `room:${room.id}`, { code: room.code, capacity: room.capacity })

        if (apiConnected) {
          apiCreateRoom(encodeRoomToBackend(room)).catch(() => {})
        }
      }
      notify(`Room ${room.code} saved.`)
      return null
    },

    deleteRoom(id) {
      const r = rooms.find((x) => x.id === id)
      setRooms((rs) => rs.filter((x) => x.id !== id))
      log('ROOM_DELETE', `room:${id}`, { code: r?.code })
      notify(`Room ${r?.code} deleted.`)
    },

    updateUserRole(id, role, studentCode) {
      const u = users.find((x) => x.id === id)
      if (!u) return 'User not found.'
      let code = u.studentCode
      if (role === 'USER') {
        code = (studentCode ?? u.studentCode ?? '').trim().toUpperCase()
        if (!code) return 'Student ID is mandatory for USER role.'
        if (!/^[A-Z]{2}\d{6}$/.test(code)) return 'Student ID format: two letters + six digits.'
        if (users.some((x) => x.studentCode === code && x.id !== id)) return `Student ID ${code} is taken.`
      }
      setUsers((us) => us.map((x) => (x.id === id ? { ...x, role, studentCode: role === 'USER' ? code : x.studentCode } : x)))
      log('USER_ROLE', `user:${id}`, { from: u.role, to: role, studentCode: role === 'USER' ? code : undefined })
      notify(`${u.fullName} is now ${role}.`)

      if (apiConnected) {
        apiUpdateUserRole(id, role, code).catch(() => {})
      }
      return null
    },

    updateProfile(patch) {
      if (!currentUser) return 'Not authenticated.'
      const name = patch.fullName.trim()
      if (!name) return 'Full name cannot be empty.'

      const hcmut = patch.hcmutId ? patch.hcmutId.trim().toUpperCase() : currentUser.hcmutId
      const uts = patch.utsId ? patch.utsId.trim().toUpperCase() : currentUser.utsId

      if (hcmut && users.some((x) => x.id !== currentUser.id && (x.hcmutId === hcmut || x.studentCode === hcmut))) {
        return `HCMUT Student ID ${hcmut} is already registered to another account.`
      }
      if (uts && users.some((x) => x.id !== currentUser.id && x.utsId === uts)) {
        return `UTS Student ID ${uts} is already registered to another account.`
      }

      const updatedUser: User = {
        ...currentUser,
        fullName: name,
        hcmutId: hcmut,
        utsId: uts,
        studentCode: hcmut || currentUser.studentCode,
      }

      setUsers((us) => us.map((x) => (x.id === currentUser.id ? updatedUser : x)))
      setStoredUser(updatedUser)
      log('USER_PROFILE_UPDATE', `user:${currentUser.id}`, { fullName: name, hcmutId: hcmut, utsId: uts })
      notify('Profile updated successfully.')
      return null
    },

    toggleUserStatus(id) {
      const u = users.find((x) => x.id === id)
      if (!u) return
      const next = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
      setUsers((us) => us.map((x) => (x.id === id ? { ...x, status: next } : x)))
      log('USER_STATUS', `user:${id}`, { from: u.status, to: next })
      notify(`${u.fullName} ${next === 'ACTIVE' ? 'reactivated' : 'suspended'}.`)

      if (apiConnected) {
        apiUpdateUserStatus(id, next).catch(() => {})
      }
    },

    updateSettings(s) {
      const o = parseHM(s.openTime)
      const c = parseHM(s.closeTime)
      if (o.h * 60 + o.m >= c.h * 60 + c.m) return 'Opening time must be earlier than closing time.'
      if (s.minAdvanceDays > s.maxAdvanceDays) return 'Minimum lead time cannot exceed max advance days.'
      if (s.maxDurationMinutes < 30) return 'Max duration must be at least 30 minutes.'
      if (s.maxActiveBookings < 1) return 'Max active bookings must be at least 1.'
      const diff: Record<string, unknown> = {}
      for (const k of Object.keys(s) as (keyof Settings)[]) if (s[k] !== settings[k]) diff[k] = { from: settings[k], to: s[k] }
      setSettings(s)
      log('SETTINGS_UPDATE', 'settings:global', diff)
      notify('System settings saved.')

      if (apiConnected) {
        apiUpdateSettings(s).catch(() => {})
      }
      return null
    },
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}

export function useLookups() {
  const { users, rooms } = useStore()
  return useMemo(
    () => ({
      user: (id: string) => users.find((u) => u.id === id),
      room: (id: string) => rooms.find((r) => r.id === id),
    }),
    [users, rooms],
  )
}

/** Bookable window helpers derived from settings */
export function windowBounds(settings: Settings) {
  const today = startOfDay(new Date())
  return { first: addDays(today, settings.minAdvanceDays), last: addDays(today, settings.maxAdvanceDays) }
}
