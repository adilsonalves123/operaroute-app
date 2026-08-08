-- Funil de marketing / produto (painel do dono OperaRoute)
-- Rode no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS plataforma_funil_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  path TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plataforma_funil_tipo_created
  ON plataforma_funil_eventos(tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plataforma_funil_created
  ON plataforma_funil_eventos(created_at DESC);

-- Sem RLS de empresa: só service role / APIs do dono escrevem e leem
ALTER TABLE plataforma_funil_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all authenticated" ON plataforma_funil_eventos;
-- authenticated não acessa; service role bypassa RLS
CREATE POLICY "Deny all authenticated" ON plataforma_funil_eventos
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT ALL ON plataforma_funil_eventos TO service_role;
