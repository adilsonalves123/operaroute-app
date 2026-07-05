-- Tabela de equipamentos por ponto
-- Rode no Supabase SQL Editor

CREATE TYPE equipamento_tipo AS ENUM ('cassino', 'vending_ursinho', 'fura_fura');

CREATE TABLE IF NOT EXISTS equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  ponto_id UUID REFERENCES pontos(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  numero_maquina TEXT,
  tipo equipamento_tipo NOT NULL,
  numero_entrada NUMERIC(14,0),
  numero_saida NUMERIC(14,0),
  entrada_atual NUMERIC(14,0),
  status TEXT DEFAULT 'ativo',
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipamentos_ponto ON equipamentos(ponto_id);
CREATE INDEX IF NOT EXISTS idx_equipamentos_empresa ON equipamentos(empresa_id);

ALTER TABLE equipamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON equipamentos;
DROP POLICY IF EXISTS "Empresa scoped insert" ON equipamentos;
DROP POLICY IF EXISTS "Empresa scoped update" ON equipamentos;
DROP POLICY IF EXISTS "Empresa scoped delete" ON equipamentos;

CREATE POLICY "Empresa scoped select" ON equipamentos
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped insert" ON equipamentos
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped update" ON equipamentos
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped delete" ON equipamentos
  FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON equipamentos TO authenticated;

-- Migração: número da máquina (se a tabela já existir)
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS numero_maquina TEXT;
