-- Issue 1: Public Bucket Allows Listing
-- The bucket `institution-images` is public:true, which means any object URL
-- is reachable directly via /storage/v1/object/public/... — this does NOT
-- require a SELECT policy on storage.objects. The current SELECT policy
-- additionally permits enumerating/listing the entire bucket contents,
-- which leaks information.
--
-- Fix: drop the broad public SELECT policy. Direct URL fetches will keep working
-- (they are served by storage's public bucket logic, bypassing this RLS),
-- while listing/enumeration via the API will be blocked for anon.

DROP POLICY IF EXISTS "institution images public read" ON storage.objects;
