-- CORREÇÃO: permission denied for table produtos_consignados
-- Supabase → SQL Editor → cole tudo → Run

-- 1) Garante a tabela (se ainda não existir)
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

ALTER TABLE produtos_consignados
  ADD COLUMN IF NOT EXISTS descricao TEXT;

ALTER TABLE produtos_consignados
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- 2) Permissões (tabela nova não herda GRANT antigo)
GRANT SELECT, INSERT, UPDATE, DELETE ON produtos_consignados TO authenticated;
GRANT ALL ON produtos_consignados TO service_role;

-- 3) RLS
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

-- 4) Índices úteis
CREATE INDEX IF NOT EXISTS idx_produtos_consignados_empresa
  ON produtos_consignados(empresa_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_consignados_codigo
  ON produtos_consignados(empresa_id, codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';
