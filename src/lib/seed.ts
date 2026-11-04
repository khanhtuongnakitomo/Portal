import type { AuditLog, Booking, Room, RoomBlock, Settings, User } from './types'
import { addDays, at, startOfDay } from './time'

export function makePassCode(roomCode: string) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `TNE-${roomCode}-${s}`
}

export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`

export const seedSettings: Settings = {
  timezone: 'Asia/Ho_Chi_Minh (UTC+07:00)',
  openTime: '08:00',
  closeTime: '17:00',
  maxDurationMinutes: 240,
  minAdvanceDays: 2,
  maxAdvanceDays: 7,
  maxActiveBookings: 5,
}

export const seedRooms: Room[] = [
  { id: 'r601', code: '601', name: 'Seminar Hall 601', floor: 6, capacity: 80, autoApprove: false, status: 'AVAILABLE', features: ['Projector', 'PA System', 'Lectern'] },
  { id: 'r602', code: '602', name: 'Studio Room 602', floor: 6, capacity: 48, autoApprove: true, status: 'AVAILABLE', features: ['Dual Display', 'Whiteboard Wall'] },
  { id: 'r603', code: '603', name: 'Lecture Theatre 603', floor: 6, capacity: 120, autoApprove: false, status: 'AVAILABLE', features: ['Recording', 'Tiered Seating', 'Hybrid Kit'] },
]

const created = (daysAgo: number) => addDays(new Date(), -daysAgo).toISOString()

export const seedUsers: User[] = [
  { id: 'u_stu', fullName: 'Linh Nguyen', email: 'linh.nguyen@student.uts.edu.au', password: 'student', role: 'USER', studentCode: 'SE123456', status: 'ACTIVE', createdAt: created(120) },
  { id: 'u_mgr', fullName: 'Daniel Tran', email: 'd.tran@uts-tne.edu.vn', password: 'manager', role: 'MANAGER', status: 'ACTIVE', createdAt: created(400) },
  { id: 'u_adm', fullName: 'Grace Pham', email: 'g.pham@uts-tne.edu.vn', password: 'admin', role: 'ADMIN', status: 'ACTIVE', createdAt: created(800) },
  { id: 'u_s2', fullName: 'Minh Le', email: 'minh.le@student.uts.edu.au', password: 'student', role: 'USER', studentCode: 'SE184022', status: 'ACTIVE', createdAt: created(90) },
  { id: 'u_s3', fullName: 'Anh Vo', email: 'anh.vo@student.uts.edu.au', password: 'student', role: 'USER', studentCode: 'SE170311', status: 'ACTIVE', createdAt: created(60) },
  { id: 'u_s4', fullName: 'Khoa Dang', email: 'khoa.dang@student.uts.edu.au', password: 'student', role: 'USER', studentCode: 'SE161907', status: 'ACTIVE', createdAt: created(44) },
  { id: 'u_s5', fullName: 'Thu Hoang', email: 'thu.hoang@student.uts.edu.au', password: 'student', role: 'USER', studentCode: 'SE152288', status: 'SUSPENDED', createdAt: created(200) },
  { id: 'u_s6', fullName: 'Bao Phan', email: 'bao.phan@student.uts.edu.au', password: 'student', role: 'USER', studentCode: 'SE190145', status: 'ACTIVE', createdAt: created(12) },
]

const PHONES: Record<string, string> = {
  u_stu: '+84 90 312 4456',
  u_s2: '+84 91 884 0221',
  u_s3: '+84 93 170 3118',
  u_s4: '+84 98 161 9070',
  u_s6: '+84 97 190 1452',
}

function b(
  id: string,
  roomId: string,
  userId: string,
  start: Date,
  end: Date,
  status: Booking['status'],
  purpose: string,
  _legacy: number,
  extra: Partial<Booking> = {},
): Booking {
  const code = roomId.slice(1)
  return {
    id,
    roomId,
    userId,
    start: start.toISOString(),
    end: end.toISOString(),
    status,
    purpose,
    title: purpose,
    phone: PHONES[userId] ?? '+84 90 000 0000',
    passCode: makePassCode(code),
    createdAt: addDays(start, -4).toISOString(),
    ...extra,
  }
}

export function seedBookings(): Booking[] {
  const now = new Date()
  const today = startOfDay(now)
  const d = (n: number) => addDays(today, n)
  return [
    // Current student
    b('bk_1001', 'r601', 'u_stu', at(d(3), 10), at(d(3), 12), 'APPROVED', 'Capstone sprint review — Team Kestrel', 6),
    b('bk_1002', 'r602', 'u_stu', at(d(5), 14), at(d(5), 15, 30), 'PENDING', 'Data Structures peer tutoring', 12),
    b('bk_1003', 'r603', 'u_stu', at(today, 10), at(today, 12), 'KEY_CHECKED_OUT', 'Robotics society weekly build night', 24, {
      checkedOutAt: at(today, 9, 58).toISOString(),
    }),
    b('bk_1004', 'r601', 'u_stu', at(d(-3), 13), at(d(-3), 15), 'COMPLETED', 'Thesis defence rehearsal', 4, {
      checkedOutAt: at(d(-3), 12, 56).toISOString(),
      returnedAt: at(d(-3), 15, 7).toISOString(),
    }),
    b('bk_1005', 'r603', 'u_stu', at(d(4), 9), at(d(4), 11), 'REJECTED', 'Film club screening', 60, {
      note: 'Conflicts with Faculty Open Day block. Please choose 602.',
    }),
    b('bk_1006', 'r602', 'u_stu', at(d(-6), 8), at(d(-6), 9), 'CANCELLED', 'Group study — Networks', 5),
    // Other students — pending queue
    b('bk_2001', 'r601', 'u_s2', at(d(2), 15), at(d(2), 17), 'PENDING', 'IEEE student branch AGM', 54),
    b('bk_2002', 'r603', 'u_s3', at(d(6), 14), at(d(6), 16), 'PENDING', 'Hackathon kickoff & team formation', 96),
    b('bk_2003', 'r601', 'u_s4', at(d(4), 8), at(d(4), 10), 'PENDING', 'UX research participant sessions', 10),
    b('bk_2004', 'r603', 'u_s6', at(d(3), 13), at(d(3), 14, 30), 'PENDING', 'Debate society mock tournament', 40),
    // Other students — approved / today
    b('bk_2101', 'r601', 'u_s2', at(today, 13, 30), at(today, 15, 30), 'APPROVED', 'Machine learning reading group', 14),
    b('bk_2104', 'r603', 'u_s6', at(today, 15), at(today, 17), 'APPROVED', 'Startup pitch practice', 18),
    b('bk_2105', 'r602', 'u_s2', at(d(3), 9), at(d(3), 11), 'APPROVED', 'Cloud computing lab prep', 20),
    b('bk_2106', 'r601', 'u_s3', at(d(1), 14), at(d(1), 16), 'APPROVED', 'Women in Tech mentoring circle', 22),
    b('bk_2107', 'r602', 'u_s6', at(d(6), 10), at(d(6), 12), 'APPROVED', 'Design critique session', 15),
  ]
}

export function seedBlocks(): RoomBlock[] {
  const today = startOfDay(new Date())
  return [
    { id: 'blk_01', roomId: 'r603', start: at(addDays(today, 4), 8).toISOString(), end: at(addDays(today, 4), 13).toISOString(), reason: 'Faculty Open Day — keynote', createdBy: 'u_mgr', active: true },
    { id: 'blk_02', roomId: 'r601', start: at(addDays(today, 5), 13).toISOString(), end: at(addDays(today, 5), 17).toISOString(), reason: 'Industry Advisory Board dinner', createdBy: 'u_mgr', active: true },
    { id: 'blk_03', roomId: 'r602', start: at(addDays(today, 2), 8).toISOString(), end: at(addDays(today, 2), 10).toISOString(), reason: 'AV maintenance window', createdBy: 'u_adm', active: true },
  ]
}

export function seedAudit(): AuditLog[] {
  const now = Date.now()
  const t = (minAgo: number) => new Date(now - minAgo * 60000).toISOString()
  return [
    { id: 'log_0009', ts: t(12), actorId: 'u_mgr', action: 'KEY_CHECKOUT', entity: 'booking:bk_1003', metadata: { room: '603', passCode: 'TNE-603-K8QZ2', by: 'u_mgr' } },
    { id: 'log_0008', ts: t(48), actorId: 'u_mgr', action: 'BOOKING_APPROVE', entity: 'booking:bk_2101', metadata: { note: null, previous: 'PENDING', next: 'APPROVED' } },
    { id: 'log_0007', ts: t(95), actorId: 'u_mgr', action: 'BOOKING_REJECT', entity: 'booking:bk_1005', metadata: { note: 'Conflicts with Faculty Open Day block. Please choose 602.' } },
    { id: 'log_0006', ts: t(180), actorId: 'u_mgr', action: 'ROOM_BLOCK_CREATE', entity: 'room:r603', metadata: { reason: 'Faculty Open Day — keynote', hours: 5 } },
    { id: 'log_0005', ts: t(260), actorId: 'u_adm', action: 'SETTINGS_UPDATE', entity: 'settings:global', metadata: { maxActiveBookings: { from: 3, to: 5 } } },
    { id: 'log_0004', ts: t(410), actorId: 'u_adm', action: 'USER_STATUS', entity: 'user:u_s5', metadata: { from: 'ACTIVE', to: 'SUSPENDED', reason: 'Repeated no-show' } },
    { id: 'log_0003', ts: t(800), actorId: 'u_adm', action: 'ROOM_UPDATE', entity: 'room:r602', metadata: { autoApprove: { from: false, to: true } } },
    { id: 'log_0002', ts: t(1500), actorId: 'u_s6', action: 'USER_REGISTER', entity: 'user:u_s6', metadata: { studentCode: 'SE190145', role: 'USER' } },
    { id: 'log_0001', ts: t(4300), actorId: 'system', action: 'SYSTEM_BOOT', entity: 'system', metadata: { version: '2.4.1', region: 'ap-southeast-1' } },
  ]
}
