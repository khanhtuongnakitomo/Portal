import {
  buildManagerBookingCreatedEmail,
  parseBookingCreatedPayload,
  type BookingCreatedEmailPayload,
} from './booking-created-email.js';

const payload: BookingCreatedEmailPayload = {
  bookingId: 'booking-123',
  title: 'Study <script>alert(1)</script>',
  purpose: 'Prepare & review',
  attendeeCount: 4,
  startTime: '2026-11-12T02:00:00.000Z',
  endTime: '2026-11-12T03:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  roomName: 'Room 1',
  roomLocation: 'TNE Floor',
  requesterName: 'Student One',
  requesterEmail: 'student@example.edu.vn',
  studentCode: 'SE001',
};

describe('manager booking-created email', () => {
  it('renders the manager link and escapes booking content in HTML', () => {
    const result = buildManagerBookingCreatedEmail(payload, 'https://portal.example.edu.vn');

    expect(result.subject).toContain('Room 1');
    expect(result.html).toContain('https://portal.example.edu.vn/#/manager');
    expect(result.text).toContain('https://portal.example.edu.vn/#/manager');
    expect(result.html).toContain('Study &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.text).toContain('SE001');
  });

  it('preserves a frontend deployment subpath when opening the manager queue', () => {
    const result = buildManagerBookingCreatedEmail(payload, 'https://example.edu.vn/portal');
    expect(result.text).toContain('https://example.edu.vn/portal/#/manager');
  });

  it('rejects malformed persisted payloads', () => {
    expect(() => parseBookingCreatedPayload({ ...payload, attendeeCount: 0 })).toThrow(
      'attendeeCount',
    );
  });
});
