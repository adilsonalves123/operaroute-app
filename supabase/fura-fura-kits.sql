-- Kits fura-fura: reposição no ponto + prêmios avulsos + análise por furos
-- Rode no SQL Editor do Supabase após fura-fura-coletas.sql

CREATE TABLE IF NOT EXISTS fura_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fura_kits_empresa ON fura_kits(empresa_id);

-- Itens que compõem o kit na reposição (ex.: Kit Faca = 5 facas)
CREATE TABLE IF NOT EXISTS fura_kit_reposicao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES fura_kits(id) ON DELETE CASCADE,
  estoque_item_id UUID REFERENCES estoque(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  custo_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fura_kit_reposicao_kit ON fura_kit_reposicao_itens(kit_id);

-- Prêmios avulsos que o cliente pode ganhar (ex.: faca espada, ou 6 itens do eletrônico)
CREATE TABLE IF NOT EXISTS fura_kit_premios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES fura_kits(id) ON DELETE CASCADE,
  estoque_item_id UUID REFERENCES estoque(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  custo_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fura_kit_premios_kit ON fura_kit_premios(kit_id);

-- Kit ativo no ponto + histórico de instalação
ALTER TABLE pontos ADD COLUMN IF NOT EXISTS kit_ativo_id UUID REFERENCES fura_kits(id) ON DELETE SET NULL;
ALTER TABLE pontos ADD COLUMN IF NOT EXISTS kit_instalado_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS fura_kit_instalacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  ponto_id UUID NOT NULL REFERENCES pontos(id) ON DELETE CASCADE,
  kit_id UUID NOT NULL REFERENCES fura_kits(id) ON DELETE CASCADE,
  operador_id UUID,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fura_kit_inst_ponto ON fura_kit_instalacoes(ponto_id);

-- Coleta: qual kit estava no ponto (métrica principal = furos por kit)
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS kit_id UUID REFERENCES fura_kits(id) ON DELETE SET NULL;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS kit_nome TEXT;

-- RLS (idempotente — pode rodar de novo se falhar no meio)
ALTER TABLE fura_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE fura_kit_reposicao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fura_kit_premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fura_kit_instalacoes ENABLE ROW LEVEL SECURITY;

-- Permissões (tabelas novas não herdam GRANT do fix-permissions.sql antigo)
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kit_reposicao_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kit_premios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fura_kit_instalacoes TO authenticated;

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
