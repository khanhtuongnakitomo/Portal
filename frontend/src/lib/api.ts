import type { AuditLog, Booking, Role, Room, RoomBlock, RoomStatus, Settings, User } from './types'

export const TOKEN_KEY = 'tne_access_token'
export const USER_KEY = 'tne_current_user'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1'
const API_BASE = BASE_URL.replace(/\/+$/, '')

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {}
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {}
}

export function clearAuth(): void {
  setStoredToken(null)
  setStoredUser(null)
}

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  status: number
  ok: boolean
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const token = getStoredToken()

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const res = await fetch(url, { ...options, headers })
    let json: any = null
    const text = await res.text()
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = text
      }
    }

    if (!res.ok) {
      let message = 'Request failed'
      if (json && typeof json === 'object') {
        if (Array.isArray(json.message)) {
          message = json.message.join(', ')
        } else if (typeof json.message === 'string') {
          message = json.message
        } else if (json.error) {
          message = typeof json.error === 'string' ? json.error : JSON.stringify(json.error)
        }
      }
      return { data: null, error: message, status: res.status, ok: false }
    }

    return { data: json as T, error: null, status: res.status, ok: true }
  } catch (err: any) {
    return {
      data: null,
      error: err?.message?.includes('Failed to fetch')
        ? 'Cannot connect to backend server. Operating in offline/local mode.'
        : (err?.message ?? 'Network error'),
      status: 0,
      ok: false,
    }
  }
}

/* ─────────────── DATA MAPPERS ─────────────── */

export function mapBackendRoomToFrontend(raw: any): Room {
  if (!raw) return { id: 'unknown', code: '601', name: 'Seminar Hall 601', floor: 6, capacity: 40, autoApprove: false, status: 'AVAILABLE', features: [] }

  let code = '601'
  const rawCode = String(raw.code || '')
  if (rawCode === '601' || rawCode === '602' || rawCode === '605' || rawCode === '603') {
    code = rawCode === '603' ? '605' : rawCode
  } else {
    const nameStr = String(raw.name || '')
    if (nameStr.includes('602')) code = '602'
    else if (nameStr.includes('605') || nameStr.includes('603')) code = '605'
    else if (nameStr.includes('601')) code = '601'
    else {
      const match = nameStr.match(/\b(60[1253])\b/)
      if (match) code = match[1] === '603' ? '605' : match[1]
    }
  }

  let name = String(raw.name || `Room ${code}`)
  // Strip any leading "601 - " / "602 - " / "605 - " / "603 - " prefix if present
  name = name.replace(/^(?:601|602|603|605)\s*[-–—]\s*/, '').trim()
  if (code === '601' && (!name || name === 'Room 601' || name === 'Room 1')) name = 'Seminar Hall 601'
  else if (code === '602' && (!name || name === 'Room 602' || name === 'Room 2')) name = 'Studio Room 602'
  else if (code === '605' && (!name || name === 'Room 605' || name === 'Room 3' || name === 'Lecture Theatre 603')) name = 'Lecture Theatre 605'

  let floor = 6
  let features: string[] = []
  if (code === '601') features = ['Projector', 'PA System', 'Lectern']
  else if (code === '602') features = ['Dual Display', 'Whiteboard Wall']
  else if (code === '605') features = ['Recording', 'Tiered Seating', 'Hybrid Kit']

  return {
    id: String(raw.id || `r_${code}`),
    code,
    name,
    floor,
    capacity: Number(raw.capacity) || (code === '605' ? 80 : code === '602' ? 24 : 40),
    autoApprove: false,
    status: (raw.status === 'MAINTENANCE' || raw.status === 'INACTIVE' ? raw.status : 'AVAILABLE') as RoomStatus,
    features,
  }
}

function filterAndDeduplicateRooms(rooms: Room[]): Room[] {
  const allowed = ['601', '602', '605']
  const map = new Map<string, Room>()
  for (const r of rooms) {
    if (allowed.includes(r.code) && !map.has(r.code)) {
      map.set(r.code, { ...r, autoApprove: false })
    }
  }
  // Ensure all 3 are always present
  for (const code of allowed) {
    if (!map.has(code)) {
      if (code === '601') map.set('601', { id: 'r_601', code: '601', name: 'Seminar Hall 601', floor: 6, capacity: 40, autoApprove: false, status: 'AVAILABLE', features: ['Projector', 'PA System', 'Lectern'] })
      if (code === '602') map.set('602', { id: 'r_602', code: '602', name: 'Studio Room 602', floor: 6, capacity: 24, autoApprove: false, status: 'AVAILABLE', features: ['Dual Display', 'Whiteboard Wall'] })
      if (code === '605') map.set('605', { id: 'r_605', code: '605', name: 'Lecture Theatre 605', floor: 6, capacity: 80, autoApprove: false, status: 'AVAILABLE', features: ['Recording', 'Tiered Seating', 'Hybrid Kit'] })
    }
  }
  return ['601', '602', '605'].map((c) => map.get(c)!)
}

export function encodeRoomToBackend(room: Room) {
  return {
    name: room.name.includes(room.code) ? room.name : `${room.code} - ${room.name}`,
    location: `Level ${room.floor}, TNE Building`,
    capacity: room.capacity,
    autoApprove: room.autoApprove,
    description: `${room.code}|${room.floor}|${room.features.join(',')}`,
  }
}

export function mapBackendUserToFrontend(raw: any): User {
  const email = String(raw.email || '')
  const lowerEmail = email.toLowerCase()
  const role: Role =
    raw.role === 'ADMIN' || raw.role === 'MANAGER' || raw.role === 'USER'
      ? raw.role
      : lowerEmail.startsWith('admin@') || lowerEmail.includes('g.pham@')
        ? 'ADMIN'
        : lowerEmail.startsWith('manager@') || lowerEmail.includes('d.tran@')
          ? 'MANAGER'
          : 'USER'
  const rawCode = raw.studentCode ?? raw.studentProfile?.studentCode ?? undefined
  let hcmutId: string | undefined = raw.hcmutId
  let utsId: string | undefined = raw.utsId
  if (!hcmutId && rawCode) {
    if (String(rawCode).includes('/')) {
      const parts = String(rawCode).split('/').map((s) => s.trim())
      hcmutId = parts[0]
      utsId = parts[1] || utsId
    } else {
      hcmutId = String(rawCode)
    }
  }
  return {
    id: String(raw.id),
    fullName: String(raw.fullName || raw.name || ''),
    email,
    password: '',
    role,
    studentCode: rawCode,
    hcmutId,
    utsId,
    status: raw.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
  }
}

export function mapBackendBookingToFrontend(raw: any): Booking {
  const start = raw.startTime ? new Date(raw.startTime).toISOString() : raw.start ? new Date(raw.start).toISOString() : new Date().toISOString()
  const end = raw.endTime ? new Date(raw.endTime).toISOString() : raw.end ? new Date(raw.end).toISOString() : new Date().toISOString()
  return {
    id: String(raw.id),
    roomId: String(raw.roomId || raw.room?.id || ''),
    userId: String(raw.userId || raw.user?.id || ''),
    start,
    end,
    title: String(raw.title || raw.purpose || 'Room Reservation'),
    phone: String(raw.phone || '+84 90 000 0000'),
    purpose: String(raw.purpose || raw.title || ''),
    status: raw.status as Booking['status'],
    passCode: String(raw.passCode || ''),
    note: raw.reviewNote ?? raw.note ?? undefined,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
    checkedOutAt: raw.keyCheckedOutAt ? new Date(raw.keyCheckedOutAt).toISOString() : raw.checkedOutAt,
    returnedAt: raw.keyReturnedAt ? new Date(raw.keyReturnedAt).toISOString() : raw.returnedAt,
    category: raw.category,
    attendeeCount: raw.attendeeCount ? Number(raw.attendeeCount) : undefined,
    isEvent: Boolean(raw.isEvent),
    members: raw.members,
    memberIds: Array.isArray(raw.memberIds) ? raw.memberIds : undefined,
  }
}

export function mapBackendBlockToFrontend(raw: any): RoomBlock {
  const start = raw.startTime ? new Date(raw.startTime).toISOString() : raw.start ? new Date(raw.start).toISOString() : new Date().toISOString()
  const end = raw.endTime ? new Date(raw.endTime).toISOString() : raw.end ? new Date(raw.end).toISOString() : new Date().toISOString()
  return {
    id: String(raw.id),
    roomId: String(raw.roomId || raw.room?.id || raw.id),
    start,
    end,
    reason: String(raw.reason || raw.blockReason || 'Scheduled block'),
    createdBy: raw.createdBy?.fullName ?? raw.createdBy?.id ?? String(raw.createdBy || 'manager'),
    active: raw.status ? raw.status === 'ACTIVE' : (raw.active ?? true),
  }
}

export function mapBackendSettingsToFrontend(raw: any): Settings {
  return {
    timezone: String(raw.timezone || 'Asia/Ho_Chi_Minh (UTC+07:00)'),
    openTime: String(raw.openTime || '08:00').trim().slice(0, 5),
    closeTime: String(raw.closeTime || '17:00').trim().slice(0, 5),
    maxDurationMinutes: 120,
    minAdvanceDays: Number(raw.minAdvanceDays ?? 2),
    maxAdvanceDays: Number(raw.maxAdvanceDays || 7),
    maxActiveBookings: Number(raw.maxActiveBookingsPerUser ?? raw.maxActiveBookings ?? 5),
  }
}

export function mapBackendAuditToFrontend(raw: any): AuditLog {
  return {
    id: String(raw.id),
    ts: raw.createdAt ? new Date(raw.createdAt).toISOString() : raw.ts ? new Date(raw.ts).toISOString() : new Date().toISOString(),
    actorId: String(raw.actorId ?? raw.actor?.id ?? 'system'),
    action: String(raw.action || 'MUTATION'),
    entity: raw.targetType ? `${raw.targetType}:${raw.targetId ?? ''}` : String(raw.entity || ''),
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
  }
}

/* ─────────────── REST API FUNCTIONS ─────────────── */

/* 1. Auth */
export async function apiLogin(email: string, password: string): Promise<{ user: User; token: string } | { error: string }> {
  const res = await apiFetch<{ accessToken?: string; token?: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  })
  if (!res.ok || !res.data) {
    return { error: res.error || 'Login failed' }
  }
  const token = res.data.accessToken || res.data.token || ''
  const user = mapBackendUserToFrontend(res.data.user)
  setStoredToken(token)
  setStoredUser(user)
  return { user, token }
}

export async function apiRegister(input: {
  fullName: string
  email: string
  password: string
  studentCode?: string
  hcmutId?: string
  utsId?: string
}): Promise<{ user: User; token: string } | { error: string }> {
  const hcmut = (input.hcmutId || input.studentCode || '').trim().toUpperCase()
  const uts = (input.utsId || '').trim().toUpperCase()
  const combinedCode = uts ? `${hcmut} / ${uts}` : hcmut
  const res = await apiFetch<{ accessToken?: string; token?: string; user: any }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      password: input.password,
      studentCode: combinedCode,
      hcmutId: hcmut,
      utsId: uts,
    }),
  })
  if (!res.ok || !res.data) {
    return { error: res.error || 'Registration failed' }
  }
  const token = res.data.accessToken || res.data.token || ''
  const user: User = {
    ...mapBackendUserToFrontend(res.data.user),
    hcmutId: hcmut || undefined,
    utsId: uts || undefined,
  }
  setStoredToken(token)
  setStoredUser(user)
  return { user, token }
}

export async function apiMe(): Promise<User | null> {
  const res = await apiFetch<any>('/users/me')
  if (!res.ok || !res.data) return null
  const user = mapBackendUserToFrontend(res.data)
  setStoredUser(user)
  return user
}

/* 2. Public / Shared */
export async function apiGetRooms(): Promise<Room[]> {
  const res = await apiFetch<any[]>('/rooms')
  if (!res.ok || !Array.isArray(res.data)) return filterAndDeduplicateRooms([])
  return filterAndDeduplicateRooms(res.data.map(mapBackendRoomToFrontend))
}

export async function apiGetSettings(): Promise<Settings | null> {
  const res = await apiFetch<any>('/settings')
  if (!res.ok || !res.data) return null
  return mapBackendSettingsToFrontend(res.data)
}

export async function apiGetCalendar(fromIso?: string, toIso?: string): Promise<{ bookings: Booking[]; blocks: RoomBlock[]; users: User[] }> {
  const now = new Date()
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const defaultTo = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString()
  const params = new URLSearchParams()
  params.set('from', fromIso || defaultFrom)
  params.set('to', toIso || defaultTo)
  const qs = `?${params.toString()}`
  const res = await apiFetch<{ bookings?: any[]; blocks?: any[] } | any[]>(`/bookings/calendar${qs}`)
  if (!res.ok || !res.data) return { bookings: [], blocks: [], users: [] }

  const rawBookings = Array.isArray(res.data)
    ? res.data
    : Array.isArray(res.data.bookings)
      ? res.data.bookings
      : []
  const rawBlocks = !Array.isArray(res.data) && Array.isArray(res.data.blocks) ? res.data.blocks : []

  const userMap = new Map<string, User>()
  for (const rb of rawBookings) {
    if (rb.user && rb.user.id) {
      userMap.set(String(rb.user.id), mapBackendUserToFrontend(rb.user))
    }
  }

  return {
    bookings: rawBookings.map(mapBackendBookingToFrontend),
    blocks: rawBlocks.map(mapBackendBlockToFrontend),
    users: Array.from(userMap.values()),
  }
}

/* 3. Student Bookings */
export async function apiCreateBooking(dto: {
  roomId: string
  title: string
  purpose: string
  attendeeCount?: number
  startTime: string
  endTime: string
}): Promise<Booking | null> {
  const res = await apiFetch<any>('/bookings', {
    method: 'POST',
    body: JSON.stringify({
      roomId: dto.roomId,
      title: dto.title,
      purpose: dto.purpose,
      attendeeCount: dto.attendeeCount ?? 1,
      startTime: dto.startTime,
      endTime: dto.endTime,
    }),
  })
  if (!res.ok || !res.data) return null
  return mapBackendBookingToFrontend(res.data)
}

export async function apiGetMyBookings(page = 1, limit = 50): Promise<Booking[]> {
  const res = await apiFetch<{ items: any[] } | any[]>(`/bookings/me?page=${page}&limit=${limit}`)
  if (!res.ok || !res.data) return []
  const items = Array.isArray(res.data) ? res.data : (res.data.items ?? [])
  return items.map(mapBackendBookingToFrontend)
}

export async function apiCancelBooking(id: string, note?: string): Promise<boolean> {
  const res = await apiFetch<any>(`/bookings/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ note: note || 'Cancelled by user' }),
  })
  return res.ok
}

/* 4. Manager Operations */
export async function apiGetManagerBookings(status?: string, page = 1, limit = 50): Promise<Booking[]> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status) qs.set('status', status)
  const res = await apiFetch<{ items: any[] } | any[]>(`/manager/bookings?${qs.toString()}`)
  if (!res.ok || !res.data) return []
  const items = Array.isArray(res.data) ? res.data : (res.data.items ?? [])
  return items.map(mapBackendBookingToFrontend)
}

export async function apiGetManagerToday(): Promise<Booking[]> {
  const res = await apiFetch<{ items?: any[] } | any[]>('/manager/bookings/today')
  if (!res.ok || !res.data) return []
  const items = Array.isArray(res.data) ? res.data : (res.data.items ?? [])
  return items.map(mapBackendBookingToFrontend)
}

export async function apiGetOverdueKeys(): Promise<Booking[]> {
  const res = await apiFetch<{ items?: any[] } | any[]>('/manager/bookings/overdue-keys')
  if (!res.ok || !res.data) return []
  const items = Array.isArray(res.data) ? res.data : (res.data.items ?? [])
  return items.map(mapBackendBookingToFrontend)
}

export async function apiApproveBooking(id: string, note?: string): Promise<boolean> {
  const res = await apiFetch<any>(`/manager/bookings/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ note: note?.trim() || undefined }),
  })
  return res.ok
}

export async function apiRejectBooking(id: string, note: string): Promise<boolean> {
  const res = await apiFetch<any>(`/manager/bookings/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  })
  return res.ok
}

export async function apiCheckoutKey(id: string, note?: string): Promise<boolean> {
  const res = await apiFetch<any>(`/manager/bookings/${id}/key-checkout`, {
    method: 'PATCH',
    body: JSON.stringify({ note: note?.trim() || undefined }),
  })
  return res.ok
}

export async function apiReturnKey(id: string, note?: string): Promise<boolean> {
  const res = await apiFetch<any>(`/manager/bookings/${id}/key-return`, {
    method: 'PATCH',
    body: JSON.stringify({ note: note?.trim() || undefined }),
  })
  return res.ok
}

export async function apiGetRoomBlocks(): Promise<RoomBlock[]> {
  const res = await apiFetch<{ items: any[] } | any[]>('/manager/room-blocks?limit=100')
  if (!res.ok || !res.data) return []
  const items = Array.isArray(res.data) ? res.data : (res.data.items ?? [])
  return items.map(mapBackendBlockToFrontend)
}

export async function apiCreateRoomBlock(dto: {
  roomId: string
  startTime: string
  endTime: string
  reason: string
}): Promise<RoomBlock | null> {
  const res = await apiFetch<any>('/manager/room-blocks', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
  if (!res.ok || !res.data) return null
  return mapBackendBlockToFrontend(res.data)
}

export async function apiCancelRoomBlock(roomId: string): Promise<boolean> {
  const res = await apiFetch<any>(`/manager/room-blocks/${roomId}/cancel`, {
    method: 'PATCH',
  })
  return res.ok
}

/* 5. Admin Operations */
export async function apiGetUsers(query?: { role?: Role; status?: string; search?: string }): Promise<User[]> {
  const params = new URLSearchParams()
  if (query?.role) params.set('role', query.role)
  if (query?.status) params.set('status', query.status)
  if (query?.search) params.set('search', query.search)
  params.set('limit', '100')
  const res = await apiFetch<{ items: any[] } | any[]>(`/admin/users?${params.toString()}`)
  if (!res.ok || !res.data) return []
  const items = Array.isArray(res.data) ? res.data : (res.data.items ?? [])
  return items.map(mapBackendUserToFrontend)
}

export async function apiCreateManager(dto: {
  fullName: string
  email: string
  password: string
}): Promise<{ user: User | null; error: string | null }> {
  const res = await apiFetch<any>('/admin/users/manager', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
  if (!res.ok || !res.data) {
    return { user: null, error: res.error || 'Failed to create manager' }
  }
  return { user: mapBackendUserToFrontend(res.data), error: null }
}

export async function apiUpdateUserRole(id: string, role: Role, studentCode?: string): Promise<boolean> {
  const res = await apiFetch<any>(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role, studentCode }),
  })
  return res.ok
}

export async function apiUpdateUserStatus(id: string, status: string): Promise<boolean> {
  const res = await apiFetch<any>(`/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return res.ok
}

export async function apiGetAdminRooms(): Promise<Room[]> {
  const res = await apiFetch<any[]>('/admin/rooms')
  if (!res.ok || !Array.isArray(res.data)) return filterAndDeduplicateRooms([])
  return filterAndDeduplicateRooms(res.data.map(mapBackendRoomToFrontend))
}

export async function apiCreateRoom(dto: {
  name: string
  location?: string
  capacity: number
  description?: string
  autoApprove?: boolean
}): Promise<Room | null> {
  const res = await apiFetch<any>('/admin/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: dto.name,
      location: dto.location || 'Level 6, TNE Building',
      capacity: dto.capacity,
      description: dto.description,
      autoApprove: dto.autoApprove ?? false,
    }),
  })
  if (!res.ok || !res.data) return null
  return mapBackendRoomToFrontend(res.data)
}

export async function apiUpdateRoom(
  id: string,
  dto: {
    name?: string
    location?: string
    capacity?: number
    description?: string
    autoApprove?: boolean
  },
): Promise<Room | null> {
  const res = await apiFetch<any>(`/admin/rooms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  })
  if (!res.ok || !res.data) return null
  return mapBackendRoomToFrontend(res.data)
}

export async function apiUpdateRoomStatus(id: string, status: RoomStatus): Promise<boolean> {
  const res = await apiFetch<any>(`/admin/rooms/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return res.ok
}

export async function apiUpdateSettings(dto: Partial<Settings>): Promise<Settings | null> {
  const body: Record<string, unknown> = {}
  if (dto.timezone) body.timezone = dto.timezone.split(' ')[0]
  if (dto.openTime) body.openTime = dto.openTime
  if (dto.closeTime) body.closeTime = dto.closeTime
  if (dto.maxDurationMinutes !== undefined) body.maxDurationMinutes = dto.maxDurationMinutes
  if (dto.maxAdvanceDays !== undefined) body.maxAdvanceDays = dto.maxAdvanceDays
  if (dto.maxActiveBookings !== undefined) body.maxActiveBookingsPerUser = dto.maxActiveBookings

  const res = await apiFetch<any>('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.data) return null
  return mapBackendSettingsToFrontend(res.data)
}

export async function apiGetAuditLogs(query?: { action?: string; targetType?: string }): Promise<AuditLog[]> {
  const params = new URLSearchParams({ limit: '100' })
  if (query?.action && query.action !== 'ALL') params.set('action', query.action)
  if (query?.targetType) params.set('targetType', query.targetType)
  const res = await apiFetch<{ items: any[] } | any[]>(`/admin/audit-logs?${params.toString()}`)
  if (!res.ok || !res.data) return []
  const items = Array.isArray(res.data) ? res.data : (res.data.items ?? [])
  return items.map(mapBackendAuditToFrontend)
}


export async function apiSendManagerEmailNotification(booking: Booking): Promise<boolean> {
  const res = await apiFetch<any>('/manager/notifications/email', {
    method: 'POST',
    body: JSON.stringify({
      bookingId: booking.id,
      recipient: 'manager@tne.edu.vn',
      subject: `[TNE-PORTAL] New Booking Request: Room ${booking.roomId}`,
      booking,
    }),
  })
  return res.ok
}
