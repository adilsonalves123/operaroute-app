-- Auditoria elaborada OperaRoute
-- Rode no Supabase SQL Editor (a tabela auditoria já existe no schema base)

ALTER TABLE auditoria
  ADD COLUMN IF NOT EXISTS severidade TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'sistema',
  ADD COLUMN IF NOT EXISTS modulo TEXT,
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS resumo TEXT,
  ADD COLUMN IF NOT EXISTS user_nome TEXT,
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS user_role TEXT,
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB;

CREATE INDEX IF NOT EXISTS idx_auditoria_empresa_created
  ON auditoria(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_severidade
  ON auditoria(empresa_id, severidade, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_categoria
  ON auditoria(empresa_id, categoria, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_user
  ON auditoria(empresa_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela
  ON auditoria(empresa_id, tabela, created_at DESC);

-- Sessões de acesso (quando entrou no app)
CREATE TABLE IF NOT EXISTS auditoria_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_nome TEXT,
  user_email TEXT,
  user_role TEXT,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_ping_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrado_em TIMESTAMPTZ,
  ip TEXT,
  user_agent TEXT,
  dispositivo TEXT,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_auditoria_sessoes_empresa
  ON auditoria_sessoes(empresa_id, iniciado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_sessoes_user
  ON auditoria_sessoes(user_id, iniciado_em DESC);

ALTER TABLE auditoria_sessoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON auditoria_sessoes;
DROP POLICY IF EXISTS "Empresa scoped insert" ON auditoria_sessoes;
DROP POLICY IF EXISTS "Empresa scoped update" ON auditoria_sessoes;

CREATE POLICY "Empresa scoped select" ON auditoria_sessoes
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON auditoria_sessoes
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON auditoria_sessoes
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE ON auditoria_sessoes TO authenticated;
