-- Nicho Consignado (venda consignada em comércios via expositores)
-- Rode no Supabase SQL Editor

-- 1) Enums do nicho e do equipamento (expositor)
ALTER TYPE nicho_type ADD VALUE IF NOT EXISTS 'consignado';
ALTER TYPE equipamento_tipo ADD VALUE IF NOT EXISTS 'consignado';

-- 2) Modo de comissão por ponto/comércio: 'percentual' (usa comissao_percentual) ou 'tabela' (R$ fixo por produto)
ALTER TABLE pontos
  ADD COLUMN IF NOT EXISTS consignado_modo_comissao TEXT DEFAULT 'percentual';

-- 3) Catálogo de produtos consignados (com código/SKU, custo, preço de venda e comissão fixa opcional)
CREATE TABLE IF NOT EXISTS produtos_consignados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  codigo TEXT,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  foto_url TEXT,
  custo_unitario NUMERIC(12,2) DEFAULT 0,
  preco_venda NUMERIC(12,2) DEFAULT 0,
  comissao_fixa NUMERIC(12,2),
  quantidade INTEGER DEFAULT 0,
  quantidade_minima INTEGER DEFAULT 0,
  fornecedor TEXT,
  observacao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_consignados_empresa
  ON produtos_consignados(empresa_id);

-- Código único por empresa (quando informado)
CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_consignados_codigo
  ON produtos_consignados(empresa_id, codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

ALTER TABLE produtos_consignados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON produtos_consignados;
DROP POLICY IF EXISTS "Empresa scoped insert" ON produtos_consignados;
DROP POLICY IF EXISTS "Empresa scoped update" ON produtos_consignados;
DROP POLICY IF EXISTS "Empresa scoped delete" ON produtos_consignados;

CREATE POLICY "Empresa scoped select" ON produtos_consignados
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON produtos_consignados
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON produtos_consignados
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON produtos_consignados
  FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON produtos_consignados TO authenticated;

-- 4) Libera o nicho consignado no check de itens de visita
ALTER TABLE visita_ponto_itens DROP CONSTRAINT IF EXISTS visita_ponto_itens_nicho_check;
ALTER TABLE visita_ponto_itens
  ADD CONSTRAINT visita_ponto_itens_nicho_check
  CHECK (nicho IN ('cassino', 'fura_fura', 'ursinho', 'diversao', 'bolinha', 'consignado'));
