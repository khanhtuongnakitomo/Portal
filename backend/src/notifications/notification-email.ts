import { NotificationEventType } from '../generated/prisma/client.js';
import {
  buildManagerBookingCreatedEmail,
  parseBookingCreatedPayload,
} from './booking-created-email.js';
import {
  buildStudentBookingDecisionEmail,
  parseBookingDecisionPayload,
} from './booking-decision-email.js';
import type { RenderedEmail } from './email-template.js';

export function renderNotificationEmail(
  eventType: NotificationEventType,
  payload: unknown,
  frontendUrl: string,
): RenderedEmail {
  switch (eventType) {
    case NotificationEventType.BOOKING_CREATED:
      return buildManagerBookingCreatedEmail(parseBookingCreatedPayload(payload), frontendUrl);
    case NotificationEventType.BOOKING_APPROVED:
    case NotificationEventType.BOOKING_REJECTED: {
      const decision = parseBookingDecisionPayload(payload);
      if (`BOOKING_${decision.status}` !== eventType) {
        throw new Error('Notification payload.status does not match its event type');
      }
      return buildStudentBookingDecisionEmail(decision, frontendUrl);
    }
    default:
      throw new Error(`Unsupported notification event type: ${String(eventType)}`);
  }
}
