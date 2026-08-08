-- Anexos do suporte (fotos / arquivos)
-- Rode no Supabase SQL Editor (depois de suporte.sql)

ALTER TABLE suporte_mensagens
  ADD COLUMN IF NOT EXISTS anexo_url TEXT,
  ADD COLUMN IF NOT EXISTS anexo_nome TEXT,
  ADD COLUMN IF NOT EXISTS anexo_mime TEXT,
  ADD COLUMN IF NOT EXISTS anexo_tamanho INTEGER;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'suporte-anexos',
  'suporte-anexos',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/avif',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Empresa upload suporte anexos" ON storage.objects;
DROP POLICY IF EXISTS "Empresa update suporte anexos" ON storage.objects;
DROP POLICY IF EXISTS "Empresa delete suporte anexos" ON storage.objects;
DROP POLICY IF EXISTS "Public read suporte anexos" ON storage.objects;

CREATE POLICY "Empresa upload suporte anexos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'suporte-anexos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()::text
  );

CREATE POLICY "Empresa update suporte anexos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'suporte-anexos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()::text
  )
  WITH CHECK (
    bucket_id = 'suporte-anexos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()::text
  );

CREATE POLICY "Empresa delete suporte anexos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'suporte-anexos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()::text
  );

CREATE POLICY "Public read suporte anexos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'suporte-anexos');
