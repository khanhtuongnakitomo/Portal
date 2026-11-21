-- Durable transactional-email outbox for manager booking notifications.

CREATE TYPE "app"."NotificationEventType" AS ENUM ('BOOKING_CREATED');
CREATE TYPE "app"."NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "app"."notification_outbox" (
  "id" UUID NOT NULL,
  "event_type" "app"."NotificationEventType" NOT NULL,
  "booking_id" UUID NOT NULL,
  "recipient_user_id" UUID,
  "recipient_email" VARCHAR(255) NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "app"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(3),
  "provider_message_id" VARCHAR(255),
  "last_error" VARCHAR(2000),
  "dedupe_key" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "sent_at" TIMESTAMPTZ(3),
  CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_outbox_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "notification_outbox_sent_at_check" CHECK (
    "status" <> 'SENT'::"app"."NotificationStatus" OR "sent_at" IS NOT NULL
  )
);

CREATE UNIQUE INDEX "notification_outbox_dedupe_key_key"
  ON "app"."notification_outbox"("dedupe_key");
CREATE INDEX "notification_outbox_status_next_attempt_at_created_at_idx"
  ON "app"."notification_outbox"("status", "next_attempt_at", "created_at");
CREATE INDEX "notification_outbox_booking_id_idx"
  ON "app"."notification_outbox"("booking_id");
CREATE INDEX "notification_outbox_recipient_user_id_idx"
  ON "app"."notification_outbox"("recipient_user_id");

ALTER TABLE "app"."notification_outbox"
  ADD CONSTRAINT "notification_outbox_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "app"."bookings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "notification_outbox_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "app"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
