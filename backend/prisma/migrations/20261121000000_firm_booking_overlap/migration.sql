-- Both the deployed migration and the former seed used bookings_no_active_overlap.
ALTER TABLE "app"."bookings"
  DROP CONSTRAINT IF EXISTS "bookings_no_active_overlap",
  DROP CONSTRAINT IF EXISTS "bookings_no_firm_overlap",
  ADD CONSTRAINT "bookings_no_firm_overlap" EXCLUDE USING GIST (
    "room_id" WITH =,
    tstzrange("start_time", "end_time", '[)') WITH &&
  ) WHERE ("status" IN ('APPROVED'::"app"."BookingStatus", 'KEY_CHECKED_OUT'::"app"."BookingStatus"));
