import { NotificationEventType } from '../generated/prisma/client.js';
import { renderNotificationEmail } from './notification-email.js';

const payload = {
  bookingId: 'booking-1',
  status: 'REJECTED',
  title: 'Study',
  roomName: '601',
  roomLocation: 'Level 6',
  startTime: '2026-11-16T02:00:00.000Z',
  endTime: '2026-11-16T03:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requesterName: 'Student',
  reviewNote: 'Room unavailable',
};

describe('notification template selection', () => {
  it('does not send a rejection payload as an approval event', () => {
    expect(() =>
      renderNotificationEmail(
        NotificationEventType.BOOKING_APPROVED,
        payload,
        'http://localhost:5173',
      ),
    ).toThrow('does not match');
  });

  it('renders a student template for a rejection event', () => {
    const email = renderNotificationEmail(
      NotificationEventType.BOOKING_REJECTED,
      payload,
      'http://localhost:5173',
    );
    expect(email.subject).toContain('không được duyệt');
    expect(email.html).toContain('/#/student');
    expect(email.html).not.toContain('/#/manager');
  });

  it('refuses unknown event types instead of using a manager template', () => {
    expect(() =>
      renderNotificationEmail('UNKNOWN' as NotificationEventType, payload, 'http://localhost:5173'),
    ).toThrow('Unsupported notification');
  });
});
