-- Additive change: preserve existing manager notifications and queued messages.
ALTER TYPE "app"."NotificationEventType" ADD VALUE IF NOT EXISTS 'BOOKING_APPROVED';
ALTER TYPE "app"."NotificationEventType" ADD VALUE IF NOT EXISTS 'BOOKING_REJECTED';
