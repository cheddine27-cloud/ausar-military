-- A device fingerprint must be bound to ONE student for life,
-- regardless of is_active. Soft-deleting (is_active=false) and then letting
-- another student bind the same device defeats the anti-cheat purpose.
--
-- Steps:
-- 1) Cleanup: keep only the EARLIEST registration per fingerprint (the legitimate
--    first owner). Delete all later duplicates.
-- 2) Re-activate the surviving records.
-- 3) Cleanup fraudulent attendances tied to those duplicates.
-- 4) Add a global UNIQUE index on device_fingerprint.

WITH ranked AS (
  SELECT id, device_fingerprint,
         ROW_NUMBER() OVER (
           PARTITION BY device_fingerprint
           ORDER BY last_used ASC NULLS LAST, id ASC
         ) AS rn
  FROM public.student_devices
),
duplicates AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.student_devices
WHERE id IN (SELECT id FROM duplicates);

UPDATE public.student_devices SET is_active = true WHERE is_active = false;

DELETE FROM public.attendances a
WHERE a.device_fingerprint IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.student_devices sd
    WHERE sd.device_fingerprint = a.device_fingerprint
      AND sd.student_id = a.student_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_devices_fingerprint_global_unique
  ON public.student_devices (device_fingerprint);
