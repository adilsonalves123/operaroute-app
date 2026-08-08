-- Corrige upsert de fotos no Storage (UPDATE sem WITH CHECK quebrava reenvio)
-- Rode no Supabase SQL Editor

DROP POLICY IF EXISTS "Empresa update coleta fotos" ON storage.objects;

CREATE POLICY "Empresa update coleta fotos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'coleta-fotos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()::text
  )
  WITH CHECK (
    bucket_id = 'coleta-fotos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()::text
  );
