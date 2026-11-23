import 'reflect-metadata';
import { CheckoutKeyDto } from '../bookings/dto/review-booking.dto.js';
import { CancelRoomBlockDto } from '../room-blocks/dto/cancel-room-block.dto.js';
import { CreateRoomDto } from '../rooms/dto/create-room.dto.js';
import { UpdateRoomDto } from '../rooms/dto/update-room.dto.js';
import { validateDto } from './validate.js';

const room = { name: 'Room 601', location: 'TNE Building', capacity: 30 };

it.each([CreateRoomDto, UpdateRoomDto])('requires a JSON boolean in %p', async (dto) => {
  for (const autoApprove of ['true', 'false', null]) {
    await expect(
      validateDto<{ autoApprove?: boolean }>(dto, { ...room, autoApprove }),
    ).rejects.toThrow('autoApprove must be a boolean value');
  }
  await expect(
    validateDto<{ autoApprove?: boolean }>(dto, { ...room, autoApprove: false }),
  ).resolves.toMatchObject({ autoApprove: false });
});

it('requires a string pass code and preserves the optional checkout note', async () => {
  await expect(validateDto(CheckoutKeyDto, {})).rejects.toThrow('passCode must be a string');
  await expect(validateDto(CheckoutKeyDto, { passCode: 1234 })).rejects.toThrow(
    'passCode must be a string',
  );
  await expect(
    validateDto(CheckoutKeyDto, { passCode: 'bA12', note: 'Collected' }),
  ).resolves.toEqual({
    passCode: 'bA12',
    note: 'Collected',
  });
});

it('accepts an optional block interval but rejects a single endpoint', async () => {
  const interval = { startTime: '2026-12-01T01:00:00Z', endTime: '2026-12-01T02:00:00Z' };
  await expect(validateDto(CancelRoomBlockDto, undefined)).resolves.toEqual({});
  await expect(validateDto(CancelRoomBlockDto, interval)).resolves.toEqual(interval);
  await expect(validateDto(CancelRoomBlockDto, { startTime: interval.startTime })).rejects.toThrow(
    'endTime must be a valid ISO 8601 date string',
  );
});
