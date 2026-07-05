-- Storage para fotos de coleta e relatórios
-- Rode no Supabase SQL Editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'coleta-fotos',
  'coleta-fotos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Empresa upload coleta fotos" ON storage.objects;
DROP POLICY IF EXISTS "Empresa read coleta fotos" ON storage.objects;
DROP POLICY IF EXISTS "Empresa update coleta fotos" ON storage.objects;
DROP POLICY IF EXISTS "Empresa delete coleta fotos" ON storage.objects;
DROP POLICY IF EXISTS "Public read coleta fotos" ON storage.objects;

CREATE POLICY "Empresa upload coleta fotos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coleta-fotos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()::text
  );

CREATE POLICY "Empresa update coleta fotos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'coleta-fotos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()::text
  );

CREATE POLICY "Empresa delete coleta fotos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'coleta-fotos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()::text
  );

CREATE POLICY "Public read coleta fotos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'coleta-fotos');

-- Relatórios gerados por visita
CREATE TABLE IF NOT EXISTS relatorios_coleta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  visita_id UUID REFERENCES visitas(id) ON DELETE CASCADE,
  ponto_id UUID REFERENCES pontos(id) ON DELETE SET NULL,
  foto_url TEXT NOT NULL,
  previa BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relatorios_visita ON relatorios_coleta(visita_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_empresa ON relatorios_coleta(empresa_id);

ALTER TABLE relatorios_coleta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON relatorios_coleta;
DROP POLICY IF EXISTS "Empresa scoped insert" ON relatorios_coleta;

CREATE POLICY "Empresa scoped select" ON relatorios_coleta
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped insert" ON relatorios_coleta
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT ON relatorios_coleta TO authenticated;

ALTER TABLE visitas ADD COLUMN IF NOT EXISTS relatorio_url TEXT;
