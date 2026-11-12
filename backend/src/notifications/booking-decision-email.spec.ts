import {
  buildStudentBookingDecisionEmail,
  parseBookingDecisionPayload,
  type BookingDecisionEmailPayload,
} from './booking-decision-email.js';

const payload: BookingDecisionEmailPayload = {
  bookingId: 'booking-123',
  status: 'APPROVED',
  title: 'Buổi học <nhóm>',
  roomName: 'Seminar Hall 601',
  roomLocation: 'Level 6 · TNE Building',
  startTime: '2026-11-16T02:00:00.000Z',
  endTime: '2026-11-16T03:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requesterName: 'Linh & bạn',
  reviewNote: 'Mang theo thẻ sinh viên',
};

describe('student booking decision emails', () => {
  it('confirms approval with the room, local time, manager note and key pickup instructions', () => {
    const email = buildStudentBookingDecisionEmail(payload, 'https://portal.example.edu.vn');
    expect(email.subject).toBe('[TNE Portal] Đặt phòng đã được duyệt — Seminar Hall 601');
    expect(email.text).toContain('Chào Linh & bạn,');
    expect(email.text).toContain('09:00');
    expect(email.text).toContain('10:00');
    expect(email.text).toContain('Mang theo thẻ sinh viên');
    expect(email.text).toContain('nhận chìa khóa');
    expect(email.text).toContain('booking-123');
    expect(email.html).toContain('https://portal.example.edu.vn/#/student');
    expect(email.html).toContain('Buổi học &lt;nhóm&gt;');
    expect(email.html).toContain('Linh &amp; bạn');
  });

  it('explains rejection using the actual manager reason and offers rebooking', () => {
    const email = buildStudentBookingDecisionEmail(
      { ...payload, status: 'REJECTED', reviewNote: 'Phòng bảo trì <script>alert(1)</script>' },
      'https://example.edu.vn/portal',
    );
    expect(email.subject).toBe('[TNE Portal] Đặt phòng không được duyệt — Seminar Hall 601');
    expect(email.text).toContain('Lý do: Phòng bảo trì <script>alert(1)</script>');
    expect(email.text).toContain('gửi yêu cầu mới');
    expect(email.text).not.toContain('nhận chìa khóa');
    expect(email.html).toContain('Phòng bảo trì &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).not.toContain('<script>');
    expect(email.text).toContain('https://example.edu.vn/portal/#/student');
  });

  it('does not invent a rejection reason when the manager leaves it blank', () => {
    const email = buildStudentBookingDecisionEmail(
      { ...payload, status: 'REJECTED', reviewNote: '  ' },
      'http://localhost:5173',
    );
    expect(email.text).toContain('Quản lý chưa cung cấp lý do cụ thể');
  });

  it('omits an empty optional approval note', () => {
    const email = buildStudentBookingDecisionEmail(
      { ...payload, reviewNote: null },
      'http://localhost:5173',
    );
    expect(email.text).not.toContain('Ghi chú từ quản lý:');
    expect(email.html).not.toContain('Ghi chú từ quản lý');
  });

  it.each([
    { ...payload, status: 'PENDING' },
    { ...payload, reviewNote: 123 },
    { ...payload, startTime: 'invalid' },
    { ...payload, endTime: payload.startTime },
    { ...payload, timezone: 'Invalid/Zone' },
    { ...payload, requesterName: undefined },
  ])('rejects malformed persisted decision payloads', (invalid) => {
    expect(() => parseBookingDecisionPayload(invalid)).toThrow('Notification payload');
  });
});
