-- Fotos do carrossel de nichos (editáveis no painel do dono)
-- Rode no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS plataforma_config (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plataforma_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all authenticated config" ON plataforma_config;
CREATE POLICY "Deny all authenticated config" ON plataforma_config
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT ALL ON plataforma_config TO service_role;

INSERT INTO plataforma_config (chave, valor, updated_at)
VALUES ('nicho_covers', '{}'::jsonb, NOW())
ON CONFLICT (chave) DO NOTHING;

INSERT INTO plataforma_config (chave, valor, updated_at)
VALUES ('nicho_cards', '{}'::jsonb, NOW())
ON CONFLICT (chave) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plataforma-assets',
  'plataforma-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read plataforma assets" ON storage.objects;
CREATE POLICY "Public read plataforma assets" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'plataforma-assets');

-- Uploads só via service_role (painel do dono). Sem policy de INSERT para authenticated.
