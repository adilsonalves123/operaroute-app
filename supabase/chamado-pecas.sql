-- Peças de reparo: consumo no chamado + rastreio na movimentação de estoque
-- Cadastro: tabela estoque com categoria = 'Pecas' (sem tabela nova de catálogo)

ALTER TABLE estoque_movimentacoes
  ADD COLUMN IF NOT EXISTS chamado_id UUID REFERENCES chamados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estoque_movimentacoes_chamado
  ON estoque_movimentacoes(chamado_id);

CREATE TABLE IF NOT EXISTS chamado_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  chamado_id UUID NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  estoque_item_id UUID NOT NULL REFERENCES estoque(id) ON DELETE RESTRICT,
  nome_item TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  custo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chamado_pecas_chamado ON chamado_pecas(chamado_id);
CREATE INDEX IF NOT EXISTS idx_chamado_pecas_empresa ON chamado_pecas(empresa_id);

ALTER TABLE chamado_pecas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON chamado_pecas;
DROP POLICY IF EXISTS "Empresa scoped insert" ON chamado_pecas;

CREATE POLICY "Empresa scoped select" ON chamado_pecas
  FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped insert" ON chamado_pecas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT ON chamado_pecas TO authenticated;
