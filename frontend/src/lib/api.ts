import type { AccountStatus, AuditLog, Booking, Role, Room, RoomBlock, RoomStatus, Settings, User } from './types'

const API_BASE = ((import.meta.env?.VITE_API_URL as string | undefined) ?? '/api/v1').replace(/\/+$/, '')

type ApiFailure = { ok: false; status: number; message: string }
export type ApiResponse<T> = { ok: true; data: T } | ApiFailure

interface ApiUser {
  id: string
  fullName: string
  email: string
  role: Role
  status?: AccountStatus
  createdAt?: string
  studentCode?: string | null
  studentProfile?: { studentCode: string } | null
}

interface ApiRoom extends Pick<Room, 'id' | 'name' | 'capacity' | 'autoApprove' | 'status'> {
  location: string | null
  description: string | null
}

interface ApiBooking {
  id: string
  roomId: string
  startTime: string
  endTime: string
  title: string
  status: Booking['status']
  kind: Booking['kind']
  isMine?: boolean
  userId?: string
  user?: ApiUser
  purpose?: string
  passCode?: string | null
  reviewNote?: string | null
  createdAt?: string
  keyCheckedOutAt?: string | null
  keyReturnedAt?: string | null
  attendeeCount?: number
}

interface ApiBlock {
  id: string
  roomId: string
  startTime: string
  endTime: string
  reason: string
  status?: 'ACTIVE' | 'CANCELLED'
  createdBy?: { id: string; fullName: string } | null
}

type ApiSettings = Omit<Settings, 'maxActiveBookings'> & { maxActiveBookingsPerUser: number }
export type ApiAuth = { accessToken: string; expiresIn: number; user: ApiUser }
type Page<T> = { total: number; page: number; limit: number } & ({ items: T[] } | { data: T[] })

type UserQuery = { page: number; search?: string; role?: Role; status?: AccountStatus }
type AuditQuery = { page: number; action?: string; targetType?: string }
type Interval = { roomId: string; startTime: string; endTime: string }

function mapResponse<T, U>(result: ApiResponse<T>, map: (data: T) => U): ApiResponse<U> {
  return result.ok ? { ok: true, data: map(result.data) } : result
}

export function mapUser(raw: ApiUser): User {
  const studentCode = raw.studentCode ?? raw.studentProfile?.studentCode ?? undefined
  const [hcmutId, utsId] = studentCode?.split('/').map((part) => part.trim()) ?? []
  return {
    id: raw.id,
    fullName: raw.fullName,
    email: raw.email,
    role: raw.role,
    studentCode, hcmutId, utsId,
    status: raw.status ?? 'ACTIVE',
    createdAt: raw.createdAt ?? '',
  }
}

function mapRoom(raw: ApiRoom): Room {
  const metadata = raw.description?.match(/^([^|]+)\|(\d+)\|(.*)$/)
  const code = metadata?.[1] ?? raw.name.match(/\b\d{3}\b/)?.[0] ?? raw.name
  const prefix = `${code} - `
  return {
    id: raw.id,
    code,
    name: raw.name.startsWith(prefix) ? raw.name.slice(prefix.length) : raw.name,
    floor: Number(metadata?.[2] ?? raw.location?.match(/\bLevel\s+(\d+)/i)?.[1] ?? 0),
    capacity: raw.capacity,
    autoApprove: raw.autoApprove,
    status: raw.status,
    features: metadata?.[3].split(',').map((feature) => feature.trim()).filter(Boolean) ?? [],
  }
}

function encodeRoom(room: Room) {
  return {
    name: room.name.includes(room.code) ? room.name : `${room.code} - ${room.name}`,
    location: `Level ${room.floor}, TNE Building`,
    capacity: room.capacity,
    autoApprove: room.autoApprove,
    description: `${room.code}|${room.floor}|${room.features.join(',')}`,
  }
}

function mapBooking(raw: ApiBooking, ownerId: string, personal = false): Booking {
  const userId = raw.userId ?? raw.user?.id ?? ''
  const roster = raw.purpose?.match(/ \[Members: ([\s\S]+)\]$/)
  const validPass = raw.status === 'APPROVED' || raw.status === 'KEY_CHECKED_OUT'
  return {
    id: raw.id,
    roomId: raw.roomId,
    userId,
    start: raw.startTime,
    end: raw.endTime,
    title: raw.title,
    kind: raw.kind,
    isMine: raw.isMine ?? (personal || (ownerId !== '' && userId === ownerId)),
    purpose: roster ? raw.purpose!.slice(0, roster.index) : raw.purpose ?? '',
    members: roster?.[1],
    status: raw.status,
    passCode: validPass ? raw.passCode ?? null : null,
    note: raw.reviewNote ?? undefined,
    createdAt: raw.createdAt ?? '',
    checkedOutAt: raw.keyCheckedOutAt ?? undefined,
    returnedAt: raw.keyReturnedAt ?? undefined,
    ...(raw.kind === 'OFFICIAL' ? { category: raw.title.match(/^\[([^\]]+)\]/)?.[1] } : {}),
    attendeeCount: raw.attendeeCount,
  }
}

function mapBlock(raw: ApiBlock): RoomBlock {
  return {
    id: raw.roomId,
    roomId: raw.roomId,
    start: raw.startTime,
    end: raw.endTime,
    reason: raw.reason,
    createdBy: raw.createdBy?.fullName ?? '',
    active: raw.status !== 'CANCELLED',
  }
}

function mapSettings(raw: ApiSettings): Settings {
  return {
    timezone: raw.timezone,
    openTime: raw.openTime.trim(),
    closeTime: raw.closeTime.trim(),
    maxDurationMinutes: raw.maxDurationMinutes,
    maxAdvanceDays: raw.maxAdvanceDays,
    maxActiveBookings: raw.maxActiveBookingsPerUser,
  }
}

function pageItems<T>(page: Page<T>) {
  return 'items' in page ? page.items : page.data
}

function pageQuery({ page, ...filters }: { page: number } & Record<string, string | number | undefined>, limit: number) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  for (const [name, value] of Object.entries(filters)) if (value !== undefined && value !== '') params.set(name, String(value))
  return params.toString()
}

export function createRequester(token: string | null = null, onUnauthorized?: () => void) {
  return async function request<T>(path: string, method = 'GET', body?: object): Promise<(ApiResponse<T> & { status: number })> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (body) headers['Content-Type'] = 'application/json'
    try {
      const response = await fetch(`${API_BASE}${path}`, { method, headers, body: body && JSON.stringify(body) })
      if (response.status === 401 && token) {
        onUnauthorized?.()
        return { ok: false, status: 401, message: 'Session expired. Please sign in again.' }
      }
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
        return { ok: false, status: response.status, message: typeof message === 'string' ? message : `Request failed (${response.status}).` }
      }
      if (data === null) return { ok: false, status: response.status, message: 'The server returned an invalid response.' }
      return { ok: true, status: response.status, data: data as T }
    } catch {
      return { ok: false, status: 0, message: 'Cannot connect to the booking server.' }
    }
  }
}

export function createApi(token: string | null, onUnauthorized: () => void, ownerId = '') {
  const request = createRequester(token, onUnauthorized)

  async function signIn(path: string, method: 'POST', body: object): Promise<ApiResponse<ApiAuth>> {
    const result = await request<ApiAuth>(path, method, body)
    if (!result.ok) return result
    const { accessToken, expiresIn, user } = result.data
    if (typeof accessToken !== 'string' || !accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0 ||
        !user?.id || !user.email || !user.fullName || !['USER', 'MANAGER', 'ADMIN'].includes(user.role)) {
      return { ok: false, status: result.status, message: 'The server returned an invalid session.' }
    }
    return result
  }
  const usersFor = (bookings: ApiBooking[]) => bookings.flatMap((booking) => booking.user ? [mapUser(booking.user)] : [])
  const bookingList = (items: ApiBooking[]) => ({ bookings: items.map((booking) => mapBooking(booking, ownerId)), users: usersFor(items) })
  const bookingAction = async (path: string, body: { note?: string; passCode?: string } = {}) =>
    mapResponse(await request<ApiBooking>(path, 'PATCH', body), (booking) => mapBooking(booking, ownerId))

  return {
    apiLogin(email: string, password: string) {
      return signIn('/auth/login', 'POST', { email: email.trim(), password })
    },
    apiRegister(input: { fullName: string; email: string; password: string; studentCode: string }) {
      return signIn('/auth/register', 'POST', {
        ...input, fullName: input.fullName.trim(), email: input.email.trim(), studentCode: input.studentCode.trim().toUpperCase(),
      })
    },
    async apiMe() {
      return mapResponse(await request<ApiUser>('/users/me'), mapUser)
    },
    async apiUpdateProfile(fullName: string) {
      return mapResponse(await request<ApiUser>('/users/me', 'PATCH', { fullName: fullName.trim() }), mapUser)
    },
    async apiGetRooms(staff: boolean) {
      return mapResponse(await request<ApiRoom[]>(staff ? '/admin/rooms' : '/rooms'), (rooms) => rooms.map(mapRoom))
    },
    async apiGetSettings() {
      return mapResponse(await request<ApiSettings>('/settings'), mapSettings)
    },
    async apiGetCalendar(from: string, to: string) {
      const query = new URLSearchParams({ from, to })
      return mapResponse(await request<{ bookings: ApiBooking[]; blocks: ApiBlock[] }>(`/bookings/calendar?${query}`), ({ bookings, blocks }) => ({
        ...bookingList(bookings), blocks: blocks.map(mapBlock),
      }))
    },
    async apiGetMyBookings(page: number) {
      return mapResponse(await request<Page<ApiBooking>>(`/bookings/me?${pageQuery({ page }, 100)}`), (data) => ({
        items: pageItems(data).map((booking) => mapBooking(booking, ownerId, true)),
        total: data.total,
        limit: data.limit,
      }))
    },
    async apiCreateBooking(input: Interval & { title: string; purpose: string; attendeeCount: number; isEvent: boolean }) {
      return mapResponse(await request<ApiBooking>('/bookings', 'POST', input), (booking) => mapBooking(booking, ownerId))
    },
    apiCancelBooking: (id: string) => bookingAction(`/bookings/${id}/cancel`),
    apiApproveBooking: (id: string, note?: string) => bookingAction(`/manager/bookings/${id}/approve`, { note: note?.trim() || undefined }),
    apiRejectBooking: (id: string, note: string) => bookingAction(`/manager/bookings/${id}/reject`, { note: note.trim() || undefined }),
    apiCheckoutKey: (id: string, passCode: string) => bookingAction(`/manager/bookings/${id}/key-checkout`, { passCode }),
    apiReturnKey: (id: string) => bookingAction(`/manager/bookings/${id}/key-return`),
    async apiGetPendingBookings(page: number) {
      return mapResponse(await request<Page<ApiBooking>>(`/manager/bookings?${pageQuery({ page, status: 'PENDING' }, 50)}`), (data) => ({
        ...bookingList(pageItems(data)),
        total: data.total,
        limit: data.limit,
      }))
    },
    async apiGetManagerToday() {
      return mapResponse(await request<{ items: ApiBooking[] }>('/manager/bookings/today'), ({ items }) => bookingList(items))
    },
    async apiGetOverdueKeys() {
      return mapResponse(await request<{ items: ApiBooking[] }>('/manager/bookings/overdue-keys'), ({ items }) => bookingList(items))
    },
    async apiCreateRoomBlock(input: Interval & { reason: string; displaceBookings: boolean }) {
      return mapResponse(await request<ApiBlock>('/manager/room-blocks', 'POST', input), mapBlock)
    },
    apiCancelRoomBlock: (roomId: string, expected?: Omit<Interval, 'roomId'>) =>
      request<unknown>(`/manager/room-blocks/${roomId}/cancel`, 'PATCH', expected),
    async apiSaveRoom(room: Room) {
      const path = room.id ? `/admin/rooms/${room.id}` : '/admin/rooms'
      return mapResponse(await request<ApiRoom>(path, room.id ? 'PATCH' : 'POST', encodeRoom(room)), mapRoom)
    },
    async apiUpdateRoomStatus(id: string, status: RoomStatus) {
      return mapResponse(await request<ApiRoom>(`/admin/rooms/${id}/status`, 'PATCH', { status }), mapRoom)
    },
    async apiGetUsers(query: UserQuery) {
      return mapResponse(await request<Page<ApiUser>>(`/admin/users?${pageQuery(query, 20)}`), (data) => ({
        items: pageItems(data).map(mapUser), total: data.total,
      }))
    },
    apiCreateManager: (input: { fullName: string; email: string; password: string }) => request<unknown>('/admin/users/manager', 'POST', input),
    apiUpdateUserRole: (id: string, role: Role, studentCode?: string) => request<unknown>(`/admin/users/${id}/role`, 'PATCH', { role, studentCode }),
    apiUpdateUserStatus: (id: string, status: AccountStatus) => request<unknown>(`/admin/users/${id}/status`, 'PATCH', { status }),
    async apiUpdateSettings(settings: Settings) {
      return mapResponse(await request<ApiSettings>('/admin/settings', 'PATCH', {
        timezone: settings.timezone,
        openTime: settings.openTime,
        closeTime: settings.closeTime,
        maxDurationMinutes: settings.maxDurationMinutes,
        maxAdvanceDays: settings.maxAdvanceDays,
        maxActiveBookingsPerUser: settings.maxActiveBookings,
      }), mapSettings)
    },
    async apiGetAuditLogs(query: AuditQuery) {
      type Row = { id: string; createdAt: string; actorId: string | null; action: string; targetType: string; targetId: string | null; metadata: AuditLog['metadata'] | null }
      return mapResponse(await request<Page<Row>>(`/admin/audit-logs?${pageQuery(query, 20)}`), (data) => ({
        items: pageItems(data).map((row): AuditLog => ({
          id: row.id,
          ts: row.createdAt,
          actorId: row.actorId ?? '',
          action: row.action,
          entity: `${row.targetType}:${row.targetId ?? ''}`,
          metadata: row.metadata ?? {},
        })),
        total: data.total,
      }))
    },
  }
}
