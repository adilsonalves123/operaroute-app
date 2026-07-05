-- Cartela de pontos: histórico de entradas e saídas na base
-- Rode no SQL Editor do Supabase

ALTER TABLE pontos ADD COLUMN IF NOT EXISTS status_alterado_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS pontos_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  ponto_id UUID REFERENCES pontos(id) ON DELETE SET NULL,
  ponto_nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  motivo TEXT NOT NULL DEFAULT 'cadastro',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pontos_movimentos_empresa_data
  ON pontos_movimentos(empresa_id, created_at DESC);

ALTER TABLE pontos_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON pontos_movimentos;
DROP POLICY IF EXISTS "Empresa scoped insert" ON pontos_movimentos;

CREATE POLICY "Empresa scoped select" ON pontos_movimentos
  FOR SELECT USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped insert" ON pontos_movimentos
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
