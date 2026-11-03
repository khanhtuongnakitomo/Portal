CREATE SCHEMA IF NOT EXISTS "app";

CREATE TYPE "app"."Role" AS ENUM ('USER', 'MANAGER', 'ADMIN');
CREATE TYPE "app"."UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "app"."RoomStatus" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'INACTIVE');
CREATE TYPE "app"."BookingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "app"."KeyStatus" AS ENUM ('NOT_COLLECTED', 'CHECKED_OUT', 'RETURNED');
CREATE TYPE "app"."RoomBlockStatus" AS ENUM ('ACTIVE', 'CANCELLED');

CREATE TABLE "app"."users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "full_name" VARCHAR(120) NOT NULL,
  "student_code" VARCHAR(50),
  "role" "app"."Role" NOT NULL DEFAULT 'USER',
  "status" "app"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app"."refresh_tokens" (
  "id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "family_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "replaced_by_token_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app"."rooms" (
  "id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "location" VARCHAR(200) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "auto_approve" BOOLEAN NOT NULL DEFAULT false,
  "status" "app"."RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rooms_capacity_check" CHECK ("capacity" > 0)
);

CREATE TABLE "app"."bookings" (
  "id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "purpose" VARCHAR(1000) NOT NULL,
  "attendee_count" INTEGER NOT NULL,
  "pass_code" VARCHAR(20) NOT NULL,
  "start_time" TIMESTAMPTZ(3) NOT NULL,
  "end_time" TIMESTAMPTZ(3) NOT NULL,
  "status" "app"."BookingStatus" NOT NULL DEFAULT 'PENDING',
  "key_status" "app"."KeyStatus" NOT NULL DEFAULT 'NOT_COLLECTED',
  "key_checked_out_at" TIMESTAMPTZ(3),
  "key_checked_out_by_id" UUID,
  "key_returned_at" TIMESTAMPTZ(3),
  "key_returned_by_id" UUID,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMPTZ(3),
  "review_note" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_time_check" CHECK ("end_time" > "start_time"),
  CONSTRAINT "bookings_attendee_count_check" CHECK ("attendee_count" > 0)
);

CREATE TABLE "app"."room_blocks" (
  "id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "start_time" TIMESTAMPTZ(3) NOT NULL,
  "end_time" TIMESTAMPTZ(3) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "status" "app"."RoomBlockStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by_id" UUID NOT NULL,
  "cancelled_by_id" UUID,
  "cancelled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "room_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "room_blocks_time_check" CHECK ("end_time" > "start_time")
);

CREATE TABLE "app"."booking_status_history" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "from_status" "app"."BookingStatus",
  "to_status" "app"."BookingStatus" NOT NULL,
  "changed_by_id" UUID NOT NULL,
  "note" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app"."audit_logs" (
  "id" UUID NOT NULL,
  "actor_id" UUID,
  "action" VARCHAR(100) NOT NULL,
  "target_type" VARCHAR(100) NOT NULL,
  "target_id" VARCHAR(100),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app"."system_settings" (
  "id" VARCHAR(30) NOT NULL DEFAULT 'default',
  "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "open_time" CHAR(5) NOT NULL DEFAULT '07:00',
  "close_time" CHAR(5) NOT NULL DEFAULT '21:00',
  "max_duration_minutes" INTEGER NOT NULL DEFAULT 240,
  "max_advance_days" INTEGER NOT NULL DEFAULT 90,
  "max_active_bookings_per_user" INTEGER NOT NULL DEFAULT 5,
  "key_pickup_window_minutes" INTEGER NOT NULL DEFAULT 30,
  "updated_by_id" UUID,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "settings_duration_check" CHECK ("max_duration_minutes" BETWEEN 15 AND 1440),
  CONSTRAINT "settings_advance_check" CHECK ("max_advance_days" BETWEEN 1 AND 365),
  CONSTRAINT "settings_active_booking_check" CHECK ("max_active_bookings_per_user" BETWEEN 1 AND 100),
  CONSTRAINT "settings_key_pickup_window_check" CHECK ("key_pickup_window_minutes" BETWEEN 0 AND 240),
  CONSTRAINT "settings_time_format_check" CHECK ("open_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "close_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE UNIQUE INDEX "users_email_key" ON "app"."users"("email");
CREATE UNIQUE INDEX "users_student_code_key" ON "app"."users"("student_code");
CREATE INDEX "users_role_status_idx" ON "app"."users"("role", "status");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "app"."refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "app"."refresh_tokens"("user_id", "revoked_at");
CREATE INDEX "refresh_tokens_family_id_idx" ON "app"."refresh_tokens"("family_id");
CREATE UNIQUE INDEX "rooms_name_key" ON "app"."rooms"("name");
CREATE INDEX "rooms_status_idx" ON "app"."rooms"("status");
CREATE UNIQUE INDEX "bookings_pass_code_key" ON "app"."bookings"("pass_code");
CREATE INDEX "bookings_user_id_status_start_time_idx" ON "app"."bookings"("user_id", "status", "start_time");
CREATE INDEX "bookings_room_id_start_time_end_time_idx" ON "app"."bookings"("room_id", "start_time", "end_time");
CREATE INDEX "bookings_status_created_at_idx" ON "app"."bookings"("status", "created_at");
CREATE INDEX "bookings_key_status_end_time_idx" ON "app"."bookings"("key_status", "end_time");
CREATE INDEX "bookings_reviewed_by_id_idx" ON "app"."bookings"("reviewed_by_id");
CREATE INDEX "bookings_key_checked_out_by_id_idx" ON "app"."bookings"("key_checked_out_by_id");
CREATE INDEX "bookings_key_returned_by_id_idx" ON "app"."bookings"("key_returned_by_id");
CREATE INDEX "room_blocks_room_id_start_time_end_time_idx" ON "app"."room_blocks"("room_id", "start_time", "end_time");
CREATE INDEX "room_blocks_status_start_time_idx" ON "app"."room_blocks"("status", "start_time");
CREATE INDEX "room_blocks_created_by_id_idx" ON "app"."room_blocks"("created_by_id");
CREATE INDEX "room_blocks_cancelled_by_id_idx" ON "app"."room_blocks"("cancelled_by_id");
CREATE INDEX "booking_status_history_booking_id_created_at_idx" ON "app"."booking_status_history"("booking_id", "created_at");
CREATE INDEX "booking_status_history_changed_by_id_idx" ON "app"."booking_status_history"("changed_by_id");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "app"."audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "app"."audit_logs"("target_type", "target_id");
CREATE INDEX "system_settings_updated_by_id_idx" ON "app"."system_settings"("updated_by_id");

ALTER TABLE "app"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "app"."rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "app"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_key_checked_out_by_id_fkey" FOREIGN KEY ("key_checked_out_by_id") REFERENCES "app"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "app"."bookings" ADD CONSTRAINT "bookings_key_returned_by_id_fkey" FOREIGN KEY ("key_returned_by_id") REFERENCES "app"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "app"."room_blocks" ADD CONSTRAINT "room_blocks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "app"."rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "app"."room_blocks" ADD CONSTRAINT "room_blocks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "app"."room_blocks" ADD CONSTRAINT "room_blocks_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "app"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "app"."booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "app"."bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app"."booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "app"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "app"."system_settings" ADD CONSTRAINT "system_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "app"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- btree_gist lets PostgreSQL combine room equality with time-range overlap.
CREATE EXTENSION IF NOT EXISTS "btree_gist";
ALTER TABLE "app"."bookings"
  ADD CONSTRAINT "bookings_no_active_overlap"
  EXCLUDE USING GIST (
    "room_id" WITH =,
    tstzrange("start_time", "end_time", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING'::"app"."BookingStatus", 'APPROVED'::"app"."BookingStatus"));

ALTER TABLE "app"."room_blocks"
  ADD CONSTRAINT "room_blocks_no_active_overlap"
  EXCLUDE USING GIST (
    "room_id" WITH =,
    tstzrange("start_time", "end_time", '[)') WITH &&
  )
  WHERE ("status" = 'ACTIVE'::"app"."RoomBlockStatus");

INSERT INTO "app"."system_settings" ("id", "updated_at") VALUES ('default', CURRENT_TIMESTAMP);

-- This schema is backend-only. Supabase has these roles; plain local PostgreSQL does not.
-- Do not add app to the Supabase Data API exposed schemas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA "app" FROM "anon";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA "app" FROM "authenticated";
  END IF;
END
$$;
