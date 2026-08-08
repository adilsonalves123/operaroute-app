-- Cria/repara empresa_nichos (necessário para multi-nicho + trava de suporte)
-- Cole TUDO no Supabase → SQL Editor → Run

CREATE TABLE IF NOT EXISTS empresa_nichos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  nicho nicho_type NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, nicho)
);

CREATE INDEX IF NOT EXISTS idx_empresa_nichos_empresa ON empresa_nichos(empresa_id);

ALTER TABLE empresa_nichos
  ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ;

ALTER TABLE empresa_nichos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON empresa_nichos;
DROP POLICY IF EXISTS "Empresa scoped insert" ON empresa_nichos;
DROP POLICY IF EXISTS "Empresa scoped update" ON empresa_nichos;
DROP POLICY IF EXISTS "Empresa scoped delete" ON empresa_nichos;

CREATE POLICY "Empresa scoped select" ON empresa_nichos
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped insert" ON empresa_nichos
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped update" ON empresa_nichos
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped delete" ON empresa_nichos
  FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON empresa_nichos TO authenticated;
GRANT ALL ON empresa_nichos TO service_role;

-- Migra nicho principal de cada empresa
INSERT INTO empresa_nichos (empresa_id, nicho, ativo)
SELECT id, nicho, TRUE FROM empresas
WHERE nicho IS NOT NULL
ON CONFLICT (empresa_id, nicho) DO UPDATE SET ativo = TRUE;

-- Sempre inclui "outros"
INSERT INTO empresa_nichos (empresa_id, nicho, ativo)
SELECT id, 'outros'::nicho_type, TRUE FROM empresas
ON CONFLICT (empresa_id, nicho) DO UPDATE SET ativo = TRUE;

-- Nichos já ativos = confirmados (cliente não troca sozinho)
UPDATE empresa_nichos
SET confirmado_em = COALESCE(confirmado_em, created_at, NOW())
WHERE ativo = TRUE
  AND nicho IS DISTINCT FROM 'outros'
  AND confirmado_em IS NULL;
