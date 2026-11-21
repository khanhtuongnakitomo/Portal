ALTER TABLE "app"."bookings" ADD COLUMN "is_event" BOOLEAN NOT NULL DEFAULT false;

-- Staff-owned bookings created before personal mode were official room activities.
UPDATE "app"."bookings" AS b
SET "is_event" = true
FROM "app"."users" AS u
WHERE b."user_id" = u."id" AND u."role" IN ('MANAGER', 'ADMIN');
