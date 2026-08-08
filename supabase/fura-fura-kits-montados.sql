-- Kits montados no depósito (baixa avulsa ao montar; baixa kit pronto ao enviar pro ponto)
-- Rode após supabase/fura-fura-kits.sql

CREATE TABLE IF NOT EXISTS fura_kits_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  kit_id UUID NOT NULL REFERENCES fura_kits(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, kit_id)
);

CREATE INDEX IF NOT EXISTS idx_fura_kits_estoque_empresa ON fura_kits_estoque(empresa_id);

CREATE TABLE IF NOT EXISTS fura_kit_montagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  kit_id UUID NOT NULL REFERENCES fura_kits(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  operador_id UUID,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fura_kit_montagens_kit ON fura_kit_montagens(kit_id);

ALTER TABLE fura_kits_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE fura_kit_montagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fura_kits_estoque empresa" ON fura_kits_estoque;
CREATE POLICY "fura_kits_estoque empresa" ON fura_kits_estoque FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "fura_kit_montagens empresa" ON fura_kit_montagens;
CREATE POLICY "fura_kit_montagens empresa" ON fura_kit_montagens FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

-- Permissões (tabelas novas não herdam GRANT automático)
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kits_estoque TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kit_montagens TO authenticated;
