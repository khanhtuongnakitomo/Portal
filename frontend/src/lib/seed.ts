import type { AuditLog, Booking, Room, RoomBlock, Settings, User } from './types'
import { addDays, at, startOfWeek } from './time'

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
  maxDurationMinutes: 120,
  minAdvanceDays: 2,
  maxAdvanceDays: 7,
  maxActiveBookings: 5,
}

export const seedRooms: Room[] = [
  { id: 'r_601', code: '601', name: 'Seminar Hall 601', floor: 6, capacity: 40, autoApprove: false, status: 'AVAILABLE', features: ['Projector', 'PA System', 'Lectern'] },
  { id: 'r_602', code: '602', name: 'Studio Room 602', floor: 6, capacity: 24, autoApprove: false, status: 'AVAILABLE', features: ['Dual Display', 'Whiteboard Wall'] },
  { id: 'r_605', code: '605', name: 'Lecture Theatre 605', floor: 6, capacity: 80, autoApprove: false, status: 'AVAILABLE', features: ['Recording', 'Tiered Seating', 'Hybrid Kit'] },
]

const created = (daysAgo: number) => addDays(new Date(), -daysAgo).toISOString()

export const seedUsers: User[] = [
  { id: 'u_stu', fullName: 'Linh Nguyen', email: 'student@tne.edu.vn', password: 'Student123456!', role: 'USER', studentCode: '2110123', hcmutId: '2110123', utsId: '14234567', status: 'ACTIVE', createdAt: created(120) },
  { id: 'u_mgr', fullName: 'Duc Tran', email: 'manager@tne.edu.vn', password: 'Manager123456!', role: 'MANAGER', status: 'ACTIVE', createdAt: created(400) },
  { id: 'u_adm', fullName: 'Giang Pham', email: 'admin@tne.edu.vn', password: 'Admin12345678!', role: 'ADMIN', status: 'ACTIVE', createdAt: created(800) },
  { id: 'u_s2', fullName: 'Minh Le', email: 'student2@tne.edu.vn', password: 'student', role: 'USER', studentCode: '2110456', hcmutId: '2110456', utsId: '14238890', status: 'ACTIVE', createdAt: created(90) },
  { id: 'u_stu2', fullName: 'Minh Le', email: 'minh.le@student.uts.edu.au', password: 'student', role: 'USER', studentCode: '2110456', hcmutId: '2110456', utsId: '14238890', status: 'ACTIVE', createdAt: created(90) },
  { id: 'u_s3', fullName: 'Anh Vo', email: 'student3@tne.edu.vn', password: 'student', role: 'USER', studentCode: '2210311', hcmutId: '2210311', utsId: '14251022', status: 'ACTIVE', createdAt: created(60) },
  { id: 'u_stu3', fullName: 'Anh Vo', email: 'anh.vo@student.uts.edu.au', password: 'student', role: 'USER', studentCode: '2210311', hcmutId: '2210311', utsId: '14251022', status: 'ACTIVE', createdAt: created(60) },
  { id: 'u_s4', fullName: 'Khoa Dang', email: 'student4@tne.edu.vn', password: 'student', role: 'USER', studentCode: '2011907', hcmutId: '2011907', utsId: '14199045', status: 'ACTIVE', createdAt: created(44) },
  { id: 'u_stu4', fullName: 'Khoa Dang', email: 'khoa.dang@student.uts.edu.au', password: 'student', role: 'USER', studentCode: '2011907', hcmutId: '2011907', utsId: '14199045', status: 'ACTIVE', createdAt: created(44) },
  { id: 'u_s5', fullName: 'Thu Hoang', email: 'thu.hoang@student.uts.edu.au', password: 'student', role: 'USER', studentCode: '2112288', hcmutId: '2112288', utsId: '14215566', status: 'SUSPENDED', createdAt: created(200) },
  { id: 'u_s6', fullName: 'Bao Phan', email: 'bao.phan@student.uts.edu.au', password: 'student', role: 'USER', studentCode: '2310145', hcmutId: '2310145', utsId: '14301299', status: 'ACTIVE', createdAt: created(12) },
]

const PHONES: Record<string, string> = {
  u_stu: '+84 90 312 4456',
  u_s2: '+84 91 884 0221',
  u_stu2: '+84 91 884 0221',
  u_s3: '+84 93 170 3118',
  u_stu3: '+84 93 170 3118',
  u_s4: '+84 98 161 9070',
  u_stu4: '+84 98 161 9070',
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
  const code = roomId.slice(2) || roomId.slice(1)
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
  const mon = startOfWeek(new Date())
  const d = (n: number) => addDays(mon, n)
  return [
    // Current student
    b('bk_1001', 'r_601', 'u_stu', at(d(2), 10), at(d(2), 12), 'APPROVED', 'Capstone sprint review — Team Kestrel', 6, {
      members: '2110456, 2210311, 14238890',
      memberIds: ['2110456', '2210311', '14238890'],
    }),
    b('bk_1002', 'r_602', 'u_stu', at(d(3), 14), at(d(3), 15, 30), 'PENDING', 'Data Structures peer tutoring', 12, {
      members: '2310145, 14301299',
      memberIds: ['2310145', '14301299'],
    }),
    b('bk_1003', 'r_605', 'u_stu', at(d(0), 10), at(d(0), 12), 'APPROVED', 'Robotics society weekly build night', 24, {
      checkedOutAt: at(d(0), 9, 58).toISOString(),
      members: '2110456, 2011907, 2310145',
      memberIds: ['2110456', '2011907', '2310145'],
    }),
    b('bk_1004', 'r_601', 'u_stu', at(d(1), 13), at(d(1), 15), 'COMPLETED', 'Thesis defence rehearsal', 4, {
      checkedOutAt: at(d(1), 12, 56).toISOString(),
      returnedAt: at(d(1), 15, 7).toISOString(),
      members: '2110456',
      memberIds: ['2110456'],
    }),
    b('bk_1005', 'r_605', 'u_stu', at(d(3), 9), at(d(3), 11), 'REJECTED', 'Film club screening', 60, {
      note: 'Conflicts with Faculty Open Day block. Please choose 602.',
    }),
    b('bk_1006', 'r_602', 'u_stu', at(d(1), 8), at(d(1), 9), 'CANCELLED', 'Group study — Networks', 5),
    // Other students — pending queue
    b('bk_2001', 'r_601', 'u_s2', at(d(1), 15), at(d(1), 17), 'PENDING', 'IEEE student branch AGM', 54, {
      members: 'Anh Vo (HCMUT: 2210311 · UTS: 14251022), Khoa Dang (HCMUT: 2011907 · UTS: 14251044)',
      memberList: [
        { name: 'Anh Vo', hcmutId: '2210311', utsId: '14251022' },
        { name: 'Khoa Dang', hcmutId: '2011907', utsId: '14251044' },
      ],
    }),
    b('bk_2002', 'r_605', 'u_s3', at(d(4), 14), at(d(4), 16), 'PENDING', 'Hackathon kickoff & team formation', 96, {
      members: 'Linh Nguyen (HCMUT: 2110123 · UTS: 14234567), Minh Le (HCMUT: 2110456 · UTS: 14234589), Bao Phan (HCMUT: 2310145 · UTS: 14234599)',
      memberList: [
        { name: 'Linh Nguyen', hcmutId: '2110123', utsId: '14234567' },
        { name: 'Minh Le', hcmutId: '2110456', utsId: '14234589' },
        { name: 'Bao Phan', hcmutId: '2310145', utsId: '14234599' },
      ],
    }),
    b('bk_2003', 'r_601', 'u_s4', at(d(3), 8), at(d(3), 10), 'PENDING', 'UX research participant sessions', 10),
    b('bk_2004', 'r_605', 'u_s6', at(d(2), 13), at(d(2), 14, 30), 'PENDING', 'Debate society mock tournament', 40),
    // 2 Competing PENDING requests on Room 601 (r_601) for the exact same time slot (Tuesday 09:00–11:00)
    // bk_comp_1 submitted at 08:14 (1st - First Come First Served priority)
    b('bk_comp_1', 'r_601', 'u_s2', at(d(1), 9), at(d(1), 11), 'PENDING', 'AI Research Group Sync (Minh Tran)', 10, {
      members: 'Linh Nguyen (HCMUT: 2110123 · UTS: 14234567), David Smith (HCMUT: 2110999 · UTS: 14234568)',
      memberList: [
        { name: 'Linh Nguyen', hcmutId: '2110123', utsId: '14234567' },
        { name: 'David Smith', hcmutId: '2110999', utsId: '14234568' },
      ],
      createdAt: at(addDays(d(1), -3), 8, 14).toISOString(),
    }),
    // bk_comp_2 submitted at 08:31 (2nd - 17 mins after bk_comp_1)
    b('bk_comp_2', 'r_601', 'u_s3', at(d(1), 9), at(d(1), 11), 'PENDING', 'Advanced Algorithms Study Group (Huy Le)', 11, {
      members: 'Khoa Dang (HCMUT: 2011907 · UTS: 14251044), Bao Phan (HCMUT: 2310145 · UTS: 14234599)',
      memberList: [
        { name: 'Khoa Dang', hcmutId: '2011907', utsId: '14251044' },
        { name: 'Bao Phan', hcmutId: '2310145', utsId: '14234599' },
      ],
      createdAt: at(addDays(d(1), -3), 8, 31).toISOString(),
    }),
    // Other students — approved / today
    b('bk_2110', 'r_602', 'u_stu', at(d(0), 8), at(d(0), 10), 'COMPLETED', 'Early morning Capstone sync', 6, {
      phone: '+84 90 312 4456',
      checkedOutAt: at(d(0), 7, 55).toISOString(),
      returnedAt: at(d(0), 10, 5).toISOString(),
      members: 'Khoa Dang (HCMUT: 2011907 · UTS: 14251044)',
      memberList: [{ name: 'Khoa Dang', hcmutId: '2011907', utsId: '14251044' }],
    }),
    b('bk_2101', 'r_601', 'u_s2', at(d(0), 10), at(d(0), 12), 'KEY_CHECKED_OUT', 'Machine learning reading group', 14, {
      phone: '+84 91 884 0221',
      checkedOutAt: at(d(0), 9, 50).toISOString(),
      members: 'Anh Vo (HCMUT: 2210311 · UTS: 14251022)',
      memberList: [{ name: 'Anh Vo', hcmutId: '2210311', utsId: '14251022' }],
    }),
    b('bk_2104', 'r_605', 'u_s6', at(d(0), 14), at(d(0), 16), 'APPROVED', 'Startup pitch practice', 18, {
      phone: '+84 93 170 3118',
      members: 'Linh Nguyen (HCMUT: 2110123 · UTS: 14234567)',
      memberList: [{ name: 'Linh Nguyen', hcmutId: '2110123', utsId: '14234567' }],
    }),
    b('bk_2105', 'r_602', 'u_s2', at(d(2), 9), at(d(2), 11), 'APPROVED', 'Cloud computing lab prep', 20),
    b('bk_2106', 'r_601', 'u_s3', at(d(1), 14), at(d(1), 16), 'APPROVED', 'Women in Tech mentoring circle', 22),
    b('bk_2107', 'r_602', 'u_s6', at(d(4), 10), at(d(4), 12), 'APPROVED', 'Design critique session', 15),
    // Weekend bookings (Sat & Sun)
    b('bk_2108', 'r_601', 'u_s2', at(d(5), 9), at(d(5), 11), 'APPROVED', 'Weekend Robotics Workshop', 18, {
      members: '2110123, 2210311',
    }),
    b('bk_2109', 'r_602', 'u_s3', at(d(6), 14), at(d(6), 16), 'PENDING', 'Sunday Capstone Group Sync', 8, {
      members: '2310145, 2011907',
    }),
  ]
}

export function seedBlocks(): RoomBlock[] {
  const mon = startOfWeek(new Date())
  const d = (n: number) => addDays(mon, n)
  return [
    { id: 'blk_01', roomId: 'r_605', start: at(d(3), 8).toISOString(), end: at(d(3), 13).toISOString(), reason: 'Faculty Open Day — keynote', createdBy: 'u_mgr', active: true },
    { id: 'blk_02', roomId: 'r_601', start: at(d(4), 13).toISOString(), end: at(d(4), 17).toISOString(), reason: 'Industry Advisory Board dinner', createdBy: 'u_mgr', active: true },
    { id: 'blk_03', roomId: 'r_602', start: at(d(2), 8).toISOString(), end: at(d(2), 10).toISOString(), reason: 'AV maintenance window', createdBy: 'u_adm', active: true },
  ]
}

export function seedAudit(): AuditLog[] {
  const now = Date.now()
  const t = (minAgo: number) => new Date(now - minAgo * 60000).toISOString()
  return [
    { id: 'log_0009', ts: t(12), actorId: 'u_mgr', action: 'KEY_CHECKOUT', entity: 'booking:bk_1003', metadata: { room: '605', passCode: 'TNE-605-K8QZ2', by: 'u_mgr' } },
    { id: 'log_0008', ts: t(48), actorId: 'u_mgr', action: 'BOOKING_APPROVE', entity: 'booking:bk_2101', metadata: { note: null, previous: 'PENDING', next: 'APPROVED' } },
    { id: 'log_0007', ts: t(95), actorId: 'u_mgr', action: 'BOOKING_REJECT', entity: 'booking:bk_1005', metadata: { note: 'Conflicts with Faculty Open Day block. Please choose 602.' } },
    { id: 'log_0006', ts: t(180), actorId: 'u_mgr', action: 'ROOM_BLOCK_CREATE', entity: 'room:r_605', metadata: { reason: 'Faculty Open Day — keynote', hours: 5 } },
    { id: 'log_0005', ts: t(260), actorId: 'u_adm', action: 'SETTINGS_UPDATE', entity: 'settings:global', metadata: { maxActiveBookings: { from: 3, to: 5 } } },
    { id: 'log_0004', ts: t(410), actorId: 'u_adm', action: 'USER_STATUS', entity: 'user:u_s5', metadata: { from: 'ACTIVE', to: 'SUSPENDED', reason: 'Repeated no-show' } },
    { id: 'log_0003', ts: t(800), actorId: 'u_adm', action: 'ROOM_UPDATE', entity: 'room:r_602', metadata: { autoApprove: { from: false, to: true } } },
    { id: 'log_0002', ts: t(1500), actorId: 'u_s6', action: 'USER_REGISTER', entity: 'user:u_s6', metadata: { studentCode: '2310145', hcmutId: '2310145', utsId: '14301299', role: 'USER' } },
    { id: 'log_0001', ts: t(4300), actorId: 'system', action: 'SYSTEM_BOOT', entity: 'system', metadata: { version: '2.4.1', region: 'ap-southeast-1' } },
  ]
}
