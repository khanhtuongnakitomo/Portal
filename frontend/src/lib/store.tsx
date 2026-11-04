import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AuditLog, Booking, Role, Room, RoomBlock, Settings, User } from './types'
import { makePassCode, seedAudit, seedBlocks, seedBookings, seedRooms, seedSettings, seedUsers, uid } from './seed'
import { addDays, daysBetween, durationMin, overlaps, parseHM, startOfDay } from './time'

export interface Toast {
  id: number
  message: string
  tone: 'ok' | 'error'
}

export const ACTIVE_STATUSES: Booking['status'][] = ['PENDING', 'APPROVED', 'KEY_CHECKED_OUT']

type Result = string | null

interface Store {
  currentUser: User | null
  users: User[]
  rooms: Room[]
  bookings: Booking[]
  blocks: RoomBlock[]
  settings: Settings
  audit: AuditLog[]
  toasts: Toast[]
  notify: (message: string, tone?: Toast['tone']) => void
  login: (email: string, password: string) => Result
  register: (input: { fullName: string; email: string; password: string; studentCode: string }) => Result
  logout: () => void
  previewAs: (role: Role) => void
  createBooking: (input: { roomId: string; start: Date; end: Date; phone: string; title: string; purpose: string }) => Result
  cancelBooking: (id: string) => void
  approveBooking: (id: string, note?: string) => void
  rejectBooking: (id: string, note: string) => Result
  checkoutKey: (id: string) => void
  returnKey: (id: string) => void
  createBlock: (input: { roomId: string; start: Date; end: Date; reason: string }) => Result
  cancelBlock: (id: string) => void
  saveRoom: (room: Room) => Result
  deleteRoom: (id: string) => void
  updateUserRole: (id: string, role: Role, studentCode?: string) => Result
  toggleUserStatus: (id: string) => void
  updateSettings: (s: Settings) => Result
  validateSlot: (roomId: string, start: Date, end: Date, ignoreBookingId?: string) => Result
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(seedUsers)
  const [rooms, setRooms] = useState<Room[]>(seedRooms)
  const [bookings, setBookings] = useState<Booking[]>(seedBookings)
  const [blocks, setBlocks] = useState<RoomBlock[]>(seedBlocks)
  const [settings, setSettings] = useState<Settings>(seedSettings)
  const [audit, setAudit] = useState<AuditLog[]>(seedAudit)
  const [currentUserId, setCurrentUserId] = useState<string | null>('u_stu')
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastSeq = useRef(0)
  const logSeq = useRef(10)

  const currentUser = users.find((u) => u.id === currentUserId) ?? null
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

  const patchBooking = (id: string, patch: Partial<Booking>) =>
    setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))

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
      if (durationMin(start, end) > settings.maxDurationMinutes)
        return `Exceeds maximum duration of ${settings.maxDurationMinutes} minutes.`
      const clash = bookings.find(
        (b) => b.roomId === roomId && b.id !== ignoreBookingId && ACTIVE_STATUSES.includes(b.status) && overlaps(b.start, b.end, start, end),
      )
      if (clash) return 'Overlaps an existing reservation.'
      const blk = blocks.find((k) => k.active && k.roomId === roomId && overlaps(k.start, k.end, start, end))
      if (blk) return `Room blocked: ${blk.reason}.`
      return null
    },
    [rooms, settings, bookings, blocks],
  )

  const store: Store = {
    currentUser,
    users,
    rooms,
    bookings,
    blocks,
    settings,
    audit,
    toasts,
    notify,
    validateSlot,

    login(email, password) {
      const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
      if (!u || u.password !== password) return 'Invalid email or password.'
      if (u.status === 'SUSPENDED') return 'This account is suspended. Contact the facilities office.'
      setCurrentUserId(u.id)
      log('AUTH_LOGIN', `user:${u.id}`, { role: u.role }, u.id)
      return null
    },

    register({ fullName, email, password, studentCode }) {
      const code = studentCode.trim().toUpperCase()
      if (!fullName.trim() || !email.trim() || !password || !code) return 'All fields are required.'
      if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.'
      if (password.length < 6) return 'Password must be at least 6 characters.'
      if (!/^[A-Z]{2}\d{6}$/.test(code)) return 'Student ID format: two letters + six digits (e.g. SE123456).'
      if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) return 'Email is already registered.'
      if (users.some((u) => u.studentCode === code)) return `Student ID ${code} is already registered.`
      const u: User = {
        id: uid('u'),
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role: 'USER',
        studentCode: code,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      }
      setUsers((us) => [...us, u])
      setCurrentUserId(u.id)
      log('USER_REGISTER', `user:${u.id}`, { studentCode: code, role: 'USER' }, u.id)
      return null
    },

    logout() {
      if (currentUser) log('AUTH_LOGOUT', `user:${currentUser.id}`, {})
      setCurrentUserId(null)
    },

    previewAs(role) {
      const id = role === 'USER' ? 'u_stu' : role === 'MANAGER' ? 'u_mgr' : 'u_adm'
      setCurrentUserId(id)
    },

    createBooking({ roomId, start, end, phone, title, purpose }) {
      if (!currentUser) return 'Not signed in.'
      const err = validateSlot(roomId, start, end)
      if (err) return err
      const room = rooms.find((r) => r.id === roomId)!
      if (!/^\+?[\d\s().-]{8,20}$/.test(phone.trim())) return 'Enter a valid phone number.'
      if (!title.trim()) return 'Booking title is required.'
      if (!purpose.trim()) return 'Purpose is required.'
      const active = bookings.filter((b) => b.userId === currentUser.id && ACTIVE_STATUSES.includes(b.status)).length
      if (active >= settings.maxActiveBookings) return `You already hold ${active} active bookings (limit ${settings.maxActiveBookings}).`
      const booking: Booking = {
        id: uid('bk'),
        roomId,
        userId: currentUser.id,
        start: start.toISOString(),
        end: end.toISOString(),
        phone: phone.trim(),
        title: title.trim(),
        purpose: purpose.trim(),
        status: room.autoApprove ? 'APPROVED' : 'PENDING',
        passCode: makePassCode(room.code),
        createdAt: new Date().toISOString(),
        note: room.autoApprove ? 'Auto-approved by room policy.' : undefined,
      }
      setBookings((bs) => [...bs, booking])
      log('BOOKING_CREATE', `booking:${booking.id}`, { room: room.code, status: booking.status, title: booking.title })
      notify(room.autoApprove ? `Room ${room.code} auto-approved. Collect the key with your Student ID.` : `Request for Room ${room.code} sent to the approval queue.`)
      return null
    },

    cancelBooking(id) {
      patchBooking(id, { status: 'CANCELLED' })
      log('BOOKING_CANCEL', `booking:${id}`, {})
      notify('Booking cancelled.')
    },

    approveBooking(id, note) {
      patchBooking(id, { status: 'APPROVED', note: note?.trim() || undefined })
      log('BOOKING_APPROVE', `booking:${id}`, { note: note?.trim() || null, previous: 'PENDING', next: 'APPROVED' })
      notify('Booking approved. Pass issued to student.')
    },

    rejectBooking(id, note) {
      if (!note.trim()) return 'A rejection note is required.'
      patchBooking(id, { status: 'REJECTED', note: note.trim() })
      log('BOOKING_REJECT', `booking:${id}`, { note: note.trim() })
      notify('Booking rejected.')
      return null
    },

    checkoutKey(id) {
      const bk = bookings.find((b) => b.id === id)
      if (!bk || bk.status !== 'APPROVED') return
      patchBooking(id, { status: 'KEY_CHECKED_OUT', checkedOutAt: new Date().toISOString() })
      log('KEY_CHECKOUT', `booking:${id}`, { passCode: bk.passCode })
      notify(`Key issued · ${users.find((u) => u.id === bk.userId)?.studentCode ?? bk.id}`)
    },

    returnKey(id) {
      const bk = bookings.find((b) => b.id === id)
      if (!bk || bk.status !== 'KEY_CHECKED_OUT') return
      const late = new Date() > new Date(bk.end)
      patchBooking(id, { status: 'COMPLETED', returnedAt: new Date().toISOString() })
      log('KEY_RETURN', `booking:${id}`, { passCode: bk.passCode, late })
      notify(`Key returned · ${users.find((u) => u.id === bk.userId)?.studentCode ?? bk.id}`)
    },

    createBlock({ roomId, start, end, reason }) {
      if (!reason.trim()) return 'A reason is required.'
      if (end <= start) return 'End must be after start.'
      const blk: RoomBlock = { id: uid('blk'), roomId, start: start.toISOString(), end: end.toISOString(), reason: reason.trim(), createdBy: actor, active: true }
      // Event priority: overlapping pending/approved bookings are displaced.
      const displaced = bookings.filter(
        (b) => b.roomId === roomId && (b.status === 'PENDING' || b.status === 'APPROVED') && overlaps(b.start, b.end, start, end),
      )
      if (displaced.length)
        setBookings((bs) =>
          bs.map((b) => (displaced.some((d) => d.id === b.id) ? { ...b, status: 'REJECTED', note: `Displaced by university event: ${reason.trim()}` } : b)),
        )
      setBlocks((ks) => [blk, ...ks])
      log('ROOM_BLOCK_CREATE', `room:${roomId}`, { reason: blk.reason, start: blk.start, end: blk.end, displaced: displaced.map((d) => d.id) })
      notify(displaced.length ? `Room blocked. ${displaced.length} booking(s) displaced.` : 'Room blocked for event.')
      return null
    },

    cancelBlock(id) {
      setBlocks((ks) => ks.map((k) => (k.id === id ? { ...k, active: false } : k)))
      log('ROOM_BLOCK_CANCEL', `block:${id}`, {})
      notify('Block cancelled. Slots released.')
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
      } else {
        setRooms((rs) => [...rs, room])
        log('ROOM_CREATE', `room:${room.id}`, { code: room.code, capacity: room.capacity })
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
      return null
    },

    toggleUserStatus(id) {
      const u = users.find((x) => x.id === id)
      if (!u) return
      const next = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
      setUsers((us) => us.map((x) => (x.id === id ? { ...x, status: next } : x)))
      log('USER_STATUS', `user:${id}`, { from: u.status, to: next })
      notify(`${u.fullName} ${next === 'ACTIVE' ? 'reactivated' : 'suspended'}.`)
    },

    updateSettings(s) {
      const o = parseHM(s.openTime)
      const c = parseHM(s.closeTime)
      if (o.h * 60 + o.m >= c.h * 60 + c.m) return 'Opening time must be before closing time.'
      if (s.minAdvanceDays > s.maxAdvanceDays) return 'Minimum lead time cannot exceed max advance days.'
      if (s.maxDurationMinutes < 30) return 'Max duration must be at least 30 minutes.'
      if (s.maxActiveBookings < 1) return 'Max active bookings must be at least 1.'
      const diff: Record<string, unknown> = {}
      for (const k of Object.keys(s) as (keyof Settings)[]) if (s[k] !== settings[k]) diff[k] = { from: settings[k], to: s[k] }
      setSettings(s)
      log('SETTINGS_UPDATE', 'settings:global', diff)
      notify('System settings saved.')
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
