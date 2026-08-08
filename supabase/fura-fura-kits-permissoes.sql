-- Corrige "permission denied for table fura_kits" e tabelas relacionadas
-- Supabase → SQL Editor → cole tudo → Run
-- Rode após fura-fura-kits.sql (e fura-fura-kits-montados.sql se usar montagem)

-- Coluna de foto (se ainda não existir)
ALTER TABLE fura_kits ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Permissões para o app (role authenticated)
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kit_reposicao_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kit_premios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kit_instalacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kits_estoque TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kit_montagens TO authenticated;

-- RLS (idempotente)
ALTER TABLE fura_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE fura_kit_reposicao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fura_kit_premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fura_kit_instalacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fura_kits_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE fura_kit_montagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fura_kits empresa" ON fura_kits;
CREATE POLICY "fura_kits empresa" ON fura_kits FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "fura_kit_reposicao via kit" ON fura_kit_reposicao_itens;
CREATE POLICY "fura_kit_reposicao via kit" ON fura_kit_reposicao_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM fura_kits k WHERE k.id = kit_id AND k.empresa_id = get_user_empresa_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM fura_kits k WHERE k.id = kit_id AND k.empresa_id = get_user_empresa_id()));

DROP POLICY IF EXISTS "fura_kit_premios via kit" ON fura_kit_premios;
CREATE POLICY "fura_kit_premios via kit" ON fura_kit_premios FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM fura_kits k WHERE k.id = kit_id AND k.empresa_id = get_user_empresa_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM fura_kits k WHERE k.id = kit_id AND k.empresa_id = get_user_empresa_id()));

DROP POLICY IF EXISTS "fura_kit_inst empresa" ON fura_kit_instalacoes;
CREATE POLICY "fura_kit_inst empresa" ON fura_kit_instalacoes FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "fura_kits_estoque empresa" ON fura_kits_estoque;
CREATE POLICY "fura_kits_estoque empresa" ON fura_kits_estoque FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "fura_kit_montagens empresa" ON fura_kit_montagens;
CREATE POLICY "fura_kit_montagens empresa" ON fura_kit_montagens FOR ALL TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());
