CREATE TABLE "app"."room_schedule_locks" (
    "room_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "room_schedule_locks_pkey" PRIMARY KEY ("room_id")
);

ALTER TABLE "app"."room_schedule_locks"
ADD CONSTRAINT "room_schedule_locks_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "app"."rooms"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "app"."room_schedule_locks" ("room_id")
SELECT "id" FROM "app"."rooms"
ON CONFLICT ("room_id") DO NOTHING;
