export type Role = 'USER' | 'MANAGER' | 'ADMIN'
export type AccountStatus = 'ACTIVE' | 'SUSPENDED'
export type RoomStatus = 'AVAILABLE' | 'MAINTENANCE' | 'INACTIVE'
export type BookingStatus = 'PENDING' | 'APPROVED' | 'KEY_CHECKED_OUT' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'

export interface Room {
  id: string
  code: string
  name: string
  floor: number
  capacity: number
  autoApprove: boolean
  status: RoomStatus
  features: string[]
}

export interface User {
  id: string
  fullName: string
  email: string
  password: string
  role: Role
  studentCode?: string
  status: AccountStatus
  createdAt: string
}

export interface Booking {
  id: string
  roomId: string
  userId: string
  start: string
  end: string
  title: string
  phone: string
  purpose: string
  status: BookingStatus
  passCode: string
  note?: string
  createdAt: string
  checkedOutAt?: string
  returnedAt?: string
}

export interface RoomBlock {
  id: string
  roomId: string
  start: string
  end: string
  reason: string
  createdBy: string
  active: boolean
}

export interface Settings {
  timezone: string
  openTime: string
  closeTime: string
  maxDurationMinutes: number
  minAdvanceDays: number
  maxAdvanceDays: number
  maxActiveBookings: number
}

export interface AuditLog {
  id: string
  ts: string
  actorId: string
  action: string
  entity: string
  metadata: Record<string, unknown>
}
