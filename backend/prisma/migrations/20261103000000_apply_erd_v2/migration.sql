-- Apply the approved ERD v2 while preserving compatible data from v1.

-- User superclass/subclass specialization.
CREATE TABLE "app"."student_profiles" (
  "user_id" UUID NOT NULL,
  "student_code" VARCHAR(50) NOT NULL,
  CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "app"."manager_profiles" (
  "user_id" UUID NOT NULL,
  CONSTRAINT "manager_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "app"."admin_profiles" (
  "user_id" UUID NOT NULL,
  CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "student_profiles_student_code_key"
  ON "app"."student_profiles"("student_code");

ALTER TABLE "app"."student_profiles"
  ADD CONSTRAINT "student_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app"."manager_profiles"
  ADD CONSTRAINT "manager_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app"."admin_profiles"
  ADD CONSTRAINT "admin_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "app"."student_profiles" ("user_id", "student_code")
SELECT
  "id",
  COALESCE("student_code", 'LEGACY-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', ''), 1, 12)))
FROM "app"."users"
WHERE "role" = 'USER'::"app"."Role";

INSERT INTO "app"."manager_profiles" ("user_id")
SELECT "id" FROM "app"."users" WHERE "role" = 'MANAGER'::"app"."Role";

INSERT INTO "app"."admin_profiles" ("user_id")
SELECT "id" FROM "app"."users" WHERE "role" = 'ADMIN'::"app"."Role";

DROP INDEX "app"."users_student_code_key";
ALTER TABLE "app"."users" DROP COLUMN "student_code";

-- Merge room schedule locks and the single active block into rooms.
ALTER TABLE "app"."rooms"
  ADD COLUMN "schedule_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "block_start_time" TIMESTAMPTZ(3),
  ADD COLUMN "block_end_time" TIMESTAMPTZ(3),
  ADD COLUMN "block_reason" VARCHAR(500),
  ADD COLUMN "block_status" "app"."RoomBlockStatus",
  ADD COLUMN "block_created_by_id" UUID,
  ADD COLUMN "block_cancelled_by_id" UUID,
  ADD COLUMN "block_cancelled_at" TIMESTAMPTZ(3);

UPDATE "app"."rooms" AS room
SET "schedule_version" = lock."version"
FROM "app"."room_schedule_locks" AS lock
WHERE lock."room_id" = room."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "app"."room_blocks"
    WHERE "status" = 'ACTIVE'::"app"."RoomBlockStatus"
    GROUP BY "room_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'ERD v2 supports one active room block per room; cancel extra active blocks before migration';
  END IF;
END
$$;

UPDATE "app"."rooms" AS room
SET
  "block_start_time" = block."start_time",
  "block_end_time" = block."end_time",
  "block_reason" = block."reason",
  "block_status" = block."status",
  "block_created_by_id" = block."created_by_id",
  "block_cancelled_by_id" = block."cancelled_by_id",
  "block_cancelled_at" = block."cancelled_at"
FROM "app"."room_blocks" AS block
WHERE block."room_id" = room."id"
  AND block."status" = 'ACTIVE'::"app"."RoomBlockStatus";

DROP TABLE "app"."room_blocks";
DROP TABLE "app"."room_schedule_locks";

CREATE INDEX "rooms_block_schedule_idx"
  ON "app"."rooms"("block_status", "block_start_time", "block_end_time");
CREATE INDEX "rooms_block_created_by_id_idx"
  ON "app"."rooms"("block_created_by_id");
CREATE INDEX "rooms_block_cancelled_by_id_idx"
  ON "app"."rooms"("block_cancelled_by_id");

ALTER TABLE "app"."rooms"
  ADD CONSTRAINT "rooms_block_created_by_id_fkey"
  FOREIGN KEY ("block_created_by_id") REFERENCES "app"."users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "rooms_block_cancelled_by_id_fkey"
  FOREIGN KEY ("block_cancelled_by_id") REFERENCES "app"."users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "rooms_block_required_fields_check" CHECK (
    (
      "block_start_time" IS NULL
      AND "block_end_time" IS NULL
      AND "block_reason" IS NULL
      AND "block_status" IS NULL
      AND "block_created_by_id" IS NULL
    ) OR (
      "block_start_time" IS NOT NULL
      AND "block_end_time" IS NOT NULL
      AND "block_reason" IS NOT NULL
      AND "block_status" IS NOT NULL
      AND "block_created_by_id" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "rooms_block_time_check" CHECK (
    "block_start_time" IS NULL OR "block_end_time" > "block_start_time"
  ),
  ADD CONSTRAINT "rooms_block_cancelled_fields_check" CHECK (
    "block_status" IS DISTINCT FROM 'CANCELLED'::"app"."RoomBlockStatus"
    OR ("block_cancelled_by_id" IS NOT NULL AND "block_cancelled_at" IS NOT NULL)
  );

-- Merge booking approval and key lifecycle into one status enum.
ALTER TABLE "app"."bookings" DROP CONSTRAINT "bookings_no_active_overlap";
ALTER TABLE "app"."bookings" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "app"."BookingStatus_v2" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'KEY_CHECKED_OUT',
  'COMPLETED'
);

ALTER TABLE "app"."bookings"
  ALTER COLUMN "status" TYPE "app"."BookingStatus_v2"
  USING (
    CASE
      WHEN "status" = 'APPROVED'::"app"."BookingStatus"
        AND "key_status" = 'CHECKED_OUT'::"app"."KeyStatus"
      THEN 'KEY_CHECKED_OUT'
      ELSE "status"::text
    END
  )::"app"."BookingStatus_v2";

ALTER TABLE "app"."booking_status_history"
  ALTER COLUMN "from_status" TYPE "app"."BookingStatus_v2"
  USING "from_status"::text::"app"."BookingStatus_v2",
  ALTER COLUMN "to_status" TYPE "app"."BookingStatus_v2"
  USING "to_status"::text::"app"."BookingStatus_v2";

DROP TYPE "app"."BookingStatus";
ALTER TYPE "app"."BookingStatus_v2" RENAME TO "BookingStatus";
ALTER TABLE "app"."bookings"
  ALTER COLUMN "status" SET DEFAULT 'PENDING'::"app"."BookingStatus";

INSERT INTO "app"."booking_status_history" (
  "id",
  "booking_id",
  "from_status",
  "to_status",
  "changed_by_id",
  "note",
  "created_at"
)
SELECT
  gen_random_uuid(),
  "id",
  'APPROVED'::"app"."BookingStatus",
  'KEY_CHECKED_OUT'::"app"."BookingStatus",
  COALESCE("key_checked_out_by_id", "user_id"),
  'Migrated from key_status=CHECKED_OUT',
  COALESCE("key_checked_out_at", CURRENT_TIMESTAMP)
FROM "app"."bookings"
WHERE "status" = 'KEY_CHECKED_OUT'::"app"."BookingStatus";

DROP INDEX "app"."bookings_key_status_end_time_idx";
ALTER TABLE "app"."bookings" DROP COLUMN "key_status";
DROP TYPE "app"."KeyStatus";

CREATE INDEX "bookings_status_end_time_idx"
  ON "app"."bookings"("status", "end_time");

ALTER TABLE "app"."bookings"
  ADD CONSTRAINT "bookings_checkout_state_check" CHECK (
    "status" NOT IN (
      'KEY_CHECKED_OUT'::"app"."BookingStatus",
      'COMPLETED'::"app"."BookingStatus"
    ) OR "key_checked_out_at" IS NOT NULL
  ),
  ADD CONSTRAINT "bookings_return_state_check" CHECK (
    "status" <> 'COMPLETED'::"app"."BookingStatus"
    OR "key_returned_at" IS NOT NULL
  );

ALTER TABLE "app"."bookings"
  ADD CONSTRAINT "bookings_no_active_overlap"
  EXCLUDE USING GIST (
    "room_id" WITH =,
    tstzrange("start_time", "end_time", '[)') WITH &&
  )
  WHERE (
    "status" IN (
      'PENDING'::"app"."BookingStatus",
      'APPROVED'::"app"."BookingStatus",
      'KEY_CHECKED_OUT'::"app"."BookingStatus"
    )
  );

-- Remove refresh-token persistence and the pickup-window setting.
DROP TABLE "app"."refresh_tokens";
ALTER TABLE "app"."system_settings"
  DROP CONSTRAINT "settings_key_pickup_window_check",
  DROP COLUMN "key_pickup_window_minutes";

-- Enforce total, disjoint user specialization at transaction commit.
CREATE FUNCTION "app"."check_user_profile_specialization"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_user_id UUID;
  target_role "app"."Role";
  student_count INTEGER;
  manager_count INTEGER;
  admin_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    target_user_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    target_user_id := OLD."user_id";
  ELSE
    target_user_id := NEW."user_id";
  END IF;

  SELECT "role" INTO target_role
  FROM "app"."users"
  WHERE "id" = target_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO student_count
  FROM "app"."student_profiles" WHERE "user_id" = target_user_id;
  SELECT COUNT(*) INTO manager_count
  FROM "app"."manager_profiles" WHERE "user_id" = target_user_id;
  SELECT COUNT(*) INTO admin_count
  FROM "app"."admin_profiles" WHERE "user_id" = target_user_id;

  IF student_count + manager_count + admin_count <> 1
    OR (target_role = 'USER'::"app"."Role" AND student_count <> 1)
    OR (target_role = 'MANAGER'::"app"."Role" AND manager_count <> 1)
    OR (target_role = 'ADMIN'::"app"."Role" AND admin_count <> 1)
  THEN
    RAISE EXCEPTION 'User % must have exactly one profile matching role %',
      target_user_id, target_role
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "users_profile_specialization_check"
AFTER INSERT OR UPDATE ON "app"."users"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "app"."check_user_profile_specialization"();

CREATE CONSTRAINT TRIGGER "student_profile_specialization_check"
AFTER INSERT OR UPDATE OR DELETE ON "app"."student_profiles"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "app"."check_user_profile_specialization"();

CREATE CONSTRAINT TRIGGER "manager_profile_specialization_check"
AFTER INSERT OR UPDATE OR DELETE ON "app"."manager_profiles"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "app"."check_user_profile_specialization"();

CREATE CONSTRAINT TRIGGER "admin_profile_specialization_check"
AFTER INSERT OR UPDATE OR DELETE ON "app"."admin_profiles"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "app"."check_user_profile_specialization"();
