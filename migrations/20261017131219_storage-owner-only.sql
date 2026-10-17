-- Private files stay private. RLS on storage.objects was off, so any signed-in
-- user could download any other user's resume, tailored resume or receipt
-- screenshot by key. Every object lives under `<user_id>/...` in the resumes
-- bucket, so ownership is the first path segment. Checking the path rather than
-- uploaded_by keeps worker uploads (admin key, uploaded_by NULL) readable by
-- their owner. The admin key bypasses RLS, so the worker is unaffected.

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_objects_owner_select ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_insert ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_update ON storage.objects;
DROP POLICY IF EXISTS storage_objects_owner_delete ON storage.objects;

CREATE POLICY resumes_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket = 'resumes' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY resumes_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket = 'resumes' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY resumes_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket = 'resumes' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'))
  WITH CHECK (bucket = 'resumes' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY resumes_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket = 'resumes' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'));

GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated;
