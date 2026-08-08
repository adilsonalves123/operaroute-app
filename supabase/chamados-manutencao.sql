-- Chamados de manutenção (todos os nichos / equipamentos)
-- Rode no Supabase SQL Editor

CREATE TYPE chamado_status AS ENUM ('aberta', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE chamado_prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente');

CREATE TABLE IF NOT EXISTS chamados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  ponto_id UUID NOT NULL REFERENCES pontos(id) ON DELETE CASCADE,
  equipamento_id UUID REFERENCES equipamentos(id) ON DELETE SET NULL,
  criado_por_id UUID,
  responsavel_id UUID,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade chamado_prioridade NOT NULL DEFAULT 'media',
  status chamado_status NOT NULL DEFAULT 'aberta',
  observacao_resolucao TEXT,
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chamado_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id UUID NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  autor_id UUID,
  autor_nome TEXT,
  tipo TEXT NOT NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chamados_empresa ON chamados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_chamados_ponto ON chamados(ponto_id);
CREATE INDEX IF NOT EXISTS idx_chamados_equipamento ON chamados(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_chamado_eventos_chamado ON chamado_eventos(chamado_id);

ALTER TABLE chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamado_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON chamados;
DROP POLICY IF EXISTS "Empresa scoped insert" ON chamados;
DROP POLICY IF EXISTS "Empresa scoped update" ON chamados;
DROP POLICY IF EXISTS "Empresa scoped delete" ON chamados;

CREATE POLICY "Empresa scoped select" ON chamados
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON chamados
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON chamados
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON chamados
  FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "Empresa scoped select" ON chamado_eventos;
DROP POLICY IF EXISTS "Empresa scoped insert" ON chamado_eventos;

CREATE POLICY "Empresa scoped select" ON chamado_eventos
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON chamado_eventos
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON chamados TO authenticated;
GRANT SELECT, INSERT ON chamado_eventos TO authenticated;
