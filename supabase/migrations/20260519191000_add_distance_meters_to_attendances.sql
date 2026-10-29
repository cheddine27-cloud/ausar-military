-- Store the geofence distance (in meters) at attendance time, so the teacher
-- can see exactly how far each student was from the session location.
-- NULL means: distance was not measurable (no geofence on session, or no GPS
-- on student device).

ALTER TABLE public.attendances
  ADD COLUMN IF NOT EXISTS distance_meters integer;

COMMENT ON COLUMN public.attendances.distance_meters IS
  'Distance from session geofence center to student GPS at registration time, in meters. NULL if not measured.';
