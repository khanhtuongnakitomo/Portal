import { randomUUID } from 'node:crypto';
import { getZonedDayRange } from '../bookings/booking-policy.js';
import { generatePassCode } from '../bookings/bookings.service.js';
import {
  BookingStatus,
  type Prisma,
  RoomBlockStatus,
  RoomStatus,
} from '../generated/prisma/client.js';

const timezone = 'Asia/Ho_Chi_Minh';
const minute = 60_000;
const day = 24 * 60 * minute;
const { PENDING, APPROVED, KEY_CHECKED_OUT, COMPLETED, REJECTED, CANCELLED } = BookingStatus;
const activeStatuses: BookingStatus[] = [PENDING, APPROVED, KEY_CHECKED_OUT];

type Slot = { startTime: Date; endTime: Date };
type Request = { title: string; purpose: string; status: BookingStatus; official?: true };
type Scenario = Slot & ({ requests: Request[] } | { blockReason: string });
type PlannedBooking = {
  booking: Prisma.BookingCreateManyInput & { id: string };
  history: Prisma.BookingStatusHistoryCreateManyInput[];
};

function request(status: BookingStatus, title: string, purpose: string, official?: true): Request {
  return { status, title, purpose, official };
}

function slot(start: number, end: number): Slot {
  return { startTime: new Date(start), endTime: new Date(end) };
}

function overlaps(a: Slot, b: Slot) {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

function* workdays(midnight: number, count: number, direction: 1 | -1) {
  let date = midnight;
  for (let remaining = count; remaining > 0; ) {
    date += direction * day;
    const weekday = new Date(date + 7 * 60 * minute).getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      remaining -= 1;
      yield date;
    }
  }
}

function minutes(value: string) {
  const [hour, mins] = value.trim().split(':').map(Number);
  return hour * 60 + mins;
}

function planScenarios(
  now: Date,
  days: number,
  settings: { openTime: string; closeTime: string; maxDurationMinutes: number },
): Scenario[] {
  const { from, to } = getZonedDayRange(undefined, timezone, now);
  const midnight = +from;
  const current = +now;
  const later = Math.min(current + 3 * 60 * minute, Math.floor((current + +to) / 2));
  const scenarios: Scenario[] = [
    {
      ...slot(Math.max(midnight, current - 30 * minute), current + 60 * minute),
      requests: [request(APPROVED, 'Team presentation practice', 'Rehearse the capstone pitch')],
    },
    {
      ...slot(Math.max(midnight, current - 20 * minute), current + 40 * minute),
      requests: [request(KEY_CHECKED_OUT, 'Database workshop', 'Review diagrams and queries')],
    },
    {
      ...slot(current - 180 * minute, current - 120 * minute),
      requests: [request(KEY_CHECKED_OUT, 'Research methods study group', 'Prepare for the quiz')],
    },
    {
      ...slot(later, Math.max(later + 1, Math.min(later + 60 * minute, +to))),
      requests: [request(APPROVED, 'Design critique', 'Compare prototype designs')],
    },
  ];

  const opening = minutes(settings.openTime) * minute;
  const closing = minutes(settings.closeTime) * minute;
  const band = Math.floor((closing - opening) / 5);
  const duration = Math.min(band, 90 * minute, settings.maxDurationMinutes * minute);
  const at = (date: number, index: number) => {
    const start = date + opening + index * band;
    return slot(start, start + duration);
  };

  let needsBlock = true;
  for (const date of workdays(midnight, days, 1)) {
    scenarios.push(
      {
        ...at(date, 0),
        requests: [
          request(PENDING, 'Programming assignment', 'Pair program and test the assignment'),
          request(PENDING, 'Statistics revision', 'Practice problems with the tutorial group'),
        ],
      },
      {
        ...at(date, 1),
        requests: [request(PENDING, 'Peer mentoring', 'Plan the next mentoring session')],
      },
      {
        ...at(date, 2),
        requests: [request(APPROVED, 'Capstone team meeting', 'Review sprint goals')],
      },
      {
        ...at(date, 3),
        requests: [request(APPROVED, 'Student success workshop', 'Academic skills session', true)],
      },
    );
    if (needsBlock) {
      scenarios.push({ ...at(date, 4), blockReason: 'AV equipment inspection' });
      needsBlock = false;
    }
  }
  for (const date of workdays(midnight, 3, -1)) {
    scenarios.push(
      {
        ...at(date, 0),
        requests: [request(COMPLETED, 'Lab report review', 'Proofread the lab report')],
      },
      {
        ...at(date, 1),
        requests: [request(REJECTED, 'Society planning', 'Plan the next society event')],
      },
      {
        ...at(date, 2),
        requests: [request(CANCELLED, 'Tutorial preparation', 'Prepare slides for the tutorial')],
      },
    );
  }
  return scenarios;
}

function bookingAndHistory(
  room: { id: string; capacity: number },
  { startTime, endTime }: Slot,
  request: Request,
  userId: string,
  staffId: string,
  now: Date,
): PlannedBooking {
  const { status, title, purpose, official } = request;
  const id = randomUUID();
  const milestone = Math.min(+startTime, +now);
  const createdAt = new Date(milestone - 20 * 60 * minute);
  const reviewedAt = new Date(milestone - 3 * 60 * minute);
  const reviewed =
    status === APPROVED ||
    status === KEY_CHECKED_OUT ||
    status === COMPLETED ||
    status === REJECTED;
  const hasKey = status === KEY_CHECKED_OUT || status === COMPLETED;
  const reviewNote = status === REJECTED ? 'The activity needs a larger room' : undefined;
  const history: Prisma.BookingStatusHistoryCreateManyInput[] = [
    {
      bookingId: id,
      toStatus: official ? APPROVED : PENDING,
      changedById: userId,
      createdAt: official ? reviewedAt : createdAt,
    },
  ];
  if (reviewed && !official) {
    history.push({
      bookingId: id,
      fromStatus: PENDING,
      toStatus: status === REJECTED ? REJECTED : APPROVED,
      changedById: staffId,
      note: reviewNote,
      createdAt: reviewedAt,
    });
  }
  if (hasKey) {
    history.push({
      bookingId: id,
      fromStatus: APPROVED,
      toStatus: KEY_CHECKED_OUT,
      changedById: staffId,
      createdAt: startTime,
    });
    if (status === COMPLETED) {
      history.push({
        bookingId: id,
        fromStatus: KEY_CHECKED_OUT,
        toStatus: COMPLETED,
        changedById: staffId,
        createdAt: endTime,
      });
    }
  } else if (status === CANCELLED) {
    history.push({
      bookingId: id,
      fromStatus: PENDING,
      toStatus: CANCELLED,
      changedById: userId,
      createdAt: reviewedAt,
    });
  }
  return {
    booking: {
      id,
      roomId: room.id,
      userId,
      title,
      purpose,
      status,
      startTime,
      endTime,
      attendeeCount: Math.min(room.capacity, official ? 18 : 4),
      passCode: generatePassCode(),
      createdAt: official ? reviewedAt : createdAt,
      reviewedAt: reviewed ? reviewedAt : undefined,
      reviewedById: reviewed ? staffId : undefined,
      reviewNote,
      keyCheckedOutAt: hasKey ? startTime : undefined,
      keyCheckedOutById: hasKey ? staffId : undefined,
      keyReturnedAt: status === COMPLETED ? endTime : undefined,
      keyReturnedById: status === COMPLETED ? staffId : undefined,
    },
    history,
  };
}

export async function generateMockSchedule(
  tx: Prisma.TransactionClient,
  days: number,
  studentIds: string[],
  staffId: string,
) {
  const now = new Date();
  const settings = await tx.systemSetting.findUniqueOrThrow({ where: { id: 'default' } });
  const scenarios = planScenarios(now, days, settings);
  const from = new Date(Math.min(...scenarios.map(({ startTime }) => +startTime)));
  const to = new Date(Math.max(...scenarios.map(({ endTime }) => +endTime)));
  // Use the same room row locks as the normal booking/block services, without updating unchanged rooms.
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM app.rooms WHERE status = 'AVAILABLE' ORDER BY id FOR NO KEY UPDATE`;
  const rooms = await tx.room.findMany({
    where: { id: { in: locked.map(({ id }) => id) }, status: RoomStatus.AVAILABLE },
    select: {
      id: true,
      capacity: true,
      autoApprove: true,
      blockStatus: true,
      blockStartTime: true,
      blockEndTime: true,
      bookings: {
        where: { startTime: { lt: to }, endTime: { gt: from }, status: { in: activeStatuses } },
        select: { startTime: true, endTime: true, status: true },
      },
    },
    orderBy: { name: 'asc' },
  });
  const schedules = rooms.map((room) => {
    const hasBlock = room.blockStatus === RoomBlockStatus.ACTIVE;
    const blocked =
      hasBlock && room.blockStartTime && room.blockEndTime
        ? [{ startTime: room.blockStartTime, endTime: room.blockEndTime }]
        : [];
    return {
      ...room,
      hasBlock,
      unavailable: [...blocked, ...room.bookings.filter(({ status }) => status !== PENDING)],
    };
  });

  const currentActive = await tx.booking.groupBy({
    by: ['userId'],
    where: { userId: { in: studentIds }, status: { in: activeStatuses }, endTime: { gt: now } },
    _count: { _all: true },
  });
  const activeCount = new Map(currentActive.map(({ userId, _count }) => [userId, _count._all]));
  let roomCursor = 0;
  let studentCursor = 0;
  let blocks = 0;
  let skipped = 0;
  const planned: PlannedBooking[] = [];
  for (const scenario of scenarios) {
    const isBlock = 'blockReason' in scenario;
    const pending = !isBlock && scenario.requests[0].status === PENDING;
    const candidates = [...schedules.slice(roomCursor), ...schedules.slice(0, roomCursor)];
    const canFit = (room: (typeof schedules)[number]) =>
      !room.unavailable.some((item) => overlaps(scenario, item)) &&
      (!isBlock || (!room.hasBlock && !room.bookings.some((item) => overlaps(scenario, item))));
    const room =
      (pending
        ? candidates.find((candidate) => !candidate.autoApprove && canFit(candidate))
        : undefined) ?? candidates.find(canFit);
    if (!room) {
      skipped += isBlock ? 1 : scenario.requests.length;
      continue;
    }
    roomCursor = (schedules.indexOf(room) + 1) % schedules.length;
    if (isBlock) {
      await tx.room.update({
        where: { id: room.id },
        data: {
          blockStartTime: scenario.startTime,
          blockEndTime: scenario.endTime,
          blockReason: scenario.blockReason,
          blockStatus: RoomBlockStatus.ACTIVE,
          blockCreatedById: staffId,
          blockCancelledById: null,
          blockCancelledAt: null,
          scheduleVersion: { increment: 1 },
        },
      });
      room.hasBlock = true;
      room.unavailable.push(scenario);
      blocks += 1;
      continue;
    }

    const used = new Set<string>();
    for (const request of scenario.requests) {
      const active = scenario.endTime > now && activeStatuses.includes(request.status);
      let userId = staffId;
      if (!request.official) {
        const choices = [...studentIds.slice(studentCursor), ...studentIds.slice(0, studentCursor)];
        if (active) {
          choices.sort((a, b) => (activeCount.get(a) ?? 0) - (activeCount.get(b) ?? 0));
        }
        userId = choices.find((id) => !used.has(id))!;
        used.add(userId);
        studentCursor = (studentIds.indexOf(userId) + 1) % studentIds.length;
        if (active) activeCount.set(userId, (activeCount.get(userId) ?? 0) + 1);
      }
      planned.push(bookingAndHistory(room, scenario, request, userId, staffId, now));
      if (request.status === APPROVED || request.status === KEY_CHECKED_OUT) {
        room.unavailable.push(scenario);
      }
    }
  }

  if (planned.length === 0) return { bookings: 0, blocks, skipped };
  // PostgreSQL also omits concurrent inserts that conflict with the firm-booking exclusion constraint.
  const inserted = await tx.booking.createManyAndReturn({
    data: planned.map(({ booking }) => booking),
    select: { id: true },
    skipDuplicates: true,
  });
  const insertedIds = new Set(inserted.map(({ id }) => id));
  const history = planned.flatMap((item) => (insertedIds.has(item.booking.id) ? item.history : []));
  if (history.length) await tx.bookingStatusHistory.createMany({ data: history });
  return { bookings: inserted.length, blocks, skipped: skipped + planned.length - inserted.length };
}
