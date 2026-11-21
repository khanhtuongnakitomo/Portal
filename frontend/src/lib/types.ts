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
  role: Role
  studentCode?: string
  hcmutId?: string
  utsId?: string
  status: AccountStatus
  createdAt: string
}

export interface BookingMember {
  name?: string
  hcmutId: string
  utsId: string
  studentId?: string
}

export function parseBookingMembers(b?: { members?: string; memberList?: BookingMember[] }): BookingMember[] {
  if (b?.memberList) return b.memberList
  if (!b?.members) return []
  // Existing records store a comma-separated roster at the end of the purpose.
  return Array.from(b.members.matchAll(/(?:^|, )([^()]*?) \(([^()]*)\)/g), ([, name, ids]) => ({
    name: name.trim(),
    hcmutId: /HCMUT:\s*([^·]+)/i.exec(ids)?.[1].trim() ?? '',
    utsId: /UTS:\s*([^·]+)/i.exec(ids)?.[1].trim() ?? '',
    studentId: ids,
  }))
}

export interface Booking {
  id: string
  roomId: string
  userId: string
  start: string
  end: string
  title: string
  kind: 'STUDENT' | 'OFFICIAL'
  isMine: boolean
  purpose: string
  status: BookingStatus
  passCode: string | null
  note?: string
  createdAt: string
  checkedOutAt?: string
  returnedAt?: string
  category?: string
  attendeeCount?: number
  members?: string
  memberList?: BookingMember[]
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
