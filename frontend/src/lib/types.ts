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
  if (!b) return []
  if (b.memberList && b.memberList.length > 0) {
    return b.memberList.map((m, idx) => {
      const hcmut = m.hcmutId || (m.studentId ? m.studentId.split(/[/·,-]/)[0]?.trim() : '') || '—'
      const uts = m.utsId || (m.studentId ? m.studentId.split(/[/·,-]/)[1]?.trim() : '') || '—'
      return {
        name: m.name || (hcmut !== '—' || uts !== '—' ? `Member #${idx + 1}` : undefined),
        hcmutId: hcmut,
        utsId: uts,
        studentId: m.studentId || (hcmut && uts && hcmut !== '—' && uts !== '—' ? `HCMUT: ${hcmut} · UTS: ${uts}` : hcmut !== '—' ? hcmut : uts),
      }
    })
  }
  if (!b.members) return []
  return b.members
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.*?)\s*\((.*?)\)$/)
      if (match) {
        const idPart = match[2].trim()
        const parts = idPart.split(/[/·,-]/).map((s) => s.trim()).filter(Boolean)
        const hcmut = parts[0] || idPart
        const uts = parts[1] || ''
        return {
          name: match[1].trim(),
          hcmutId: hcmut,
          utsId: uts,
          studentId: idPart,
        }
      }
      return { name: `Member`, hcmutId: item, utsId: '', studentId: item }
    })
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
  category?: string
  attendeeCount?: number
  isEvent?: boolean
  members?: string
  memberIds?: string[]
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
