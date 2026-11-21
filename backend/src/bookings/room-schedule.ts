import { NotFoundException } from '../common/http-exceptions.js';
import { BookingStatus, type Prisma } from '../generated/prisma/client.js';

export async function lockRoomSchedule(tx: Prisma.TransactionClient, roomId: string) {
  const locked = await tx.room.updateMany({
    where: { id: roomId },
    data: { scheduleVersion: { increment: 1 } },
  });
  if (locked.count !== 1) throw new NotFoundException('Room not found');
}

interface SlotOverlap {
  roomId: string;
  startTime: { lt: Date };
  endTime: { gt: Date };
}

export function overlappingSlot(roomId: string, startTime: Date, endTime: Date): SlotOverlap {
  return { roomId, startTime: { lt: endTime }, endTime: { gt: startTime } };
}

// Call with the room lock held. Cancellations and rejections don't need the room lock;
// RETURNING ensures a booking they changed never gets a second history or audit entry.
export async function rejectOverlaps(
  tx: Prisma.TransactionClient,
  slot: SlotOverlap,
  fromStatus: typeof BookingStatus.PENDING | typeof BookingStatus.APPROVED,
  actorId: string,
  note: string,
  metadata: Prisma.InputJsonObject,
) {
  const rejected = await tx.booking.updateManyAndReturn({
    where: { ...slot, status: fromStatus },
    data: {
      status: BookingStatus.REJECTED,
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote: note,
    },
    select: { id: true },
  });
  if (rejected.length === 0) return;
  await tx.bookingStatusHistory.createMany({
    data: rejected.map(({ id }) => ({
      bookingId: id,
      fromStatus,
      toStatus: BookingStatus.REJECTED,
      changedById: actorId,
      note,
    })),
  });
  await tx.auditLog.createMany({
    data: rejected.map(({ id }) => ({
      actorId,
      action: 'BOOKING_REJECTED',
      targetType: 'Booking',
      targetId: id,
      metadata: { ...metadata, note },
    })),
  });
}
