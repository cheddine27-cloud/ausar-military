-- Store optional public cover images for SaaS institutions.

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'institution-images',
  'institution-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "institution images public read" ON storage.objects;
DROP POLICY IF EXISTS "institution images super insert" ON storage.objects;
DROP POLICY IF EXISTS "institution images super update" ON storage.objects;
DROP POLICY IF EXISTS "institution images super delete" ON storage.objects;

CREATE POLICY "institution images public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'institution-images');

CREATE POLICY "institution images super insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'institution-images' AND private.is_super_admin());

CREATE POLICY "institution images super update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'institution-images' AND private.is_super_admin())
  WITH CHECK (bucket_id = 'institution-images' AND private.is_super_admin());

CREATE POLICY "institution images super delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'institution-images' AND private.is_super_admin());
