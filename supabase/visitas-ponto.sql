-- Visita unificada ao ponto (multi-nicho)
-- Rode no Supabase SQL Editor após schema.sql e cassino-visitas.sql

CREATE TABLE IF NOT EXISTS visitas_ponto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  ponto_id UUID NOT NULL REFERENCES pontos(id) ON DELETE CASCADE,
  operador_id UUID,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'finalizada', 'cancelada')),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finalizada_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_visitas_ponto_empresa ON visitas_ponto(empresa_id);
CREATE INDEX IF NOT EXISTS idx_visitas_ponto_ponto ON visitas_ponto(ponto_id);
CREATE INDEX IF NOT EXISTS idx_visitas_ponto_status ON visitas_ponto(status);
CREATE INDEX IF NOT EXISTS idx_visitas_ponto_created ON visitas_ponto(created_at DESC);

CREATE TABLE IF NOT EXISTS visita_ponto_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_ponto_id UUID NOT NULL REFERENCES visitas_ponto(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nicho TEXT NOT NULL CHECK (nicho IN ('cassino', 'fura_fura', 'ursinho')),
  cassino_visita_id UUID REFERENCES visitas(id) ON DELETE CASCADE,
  coleta_id UUID REFERENCES coletas(id) ON DELETE CASCADE,
  grupo_id UUID,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT visita_ponto_item_ref CHECK (
    (cassino_visita_id IS NOT NULL AND coleta_id IS NULL)
    OR (cassino_visita_id IS NULL AND coleta_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_visita_ponto_itens_visita ON visita_ponto_itens(visita_ponto_id);
CREATE INDEX IF NOT EXISTS idx_visita_ponto_itens_empresa ON visita_ponto_itens(empresa_id);

ALTER TABLE visitas_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE visita_ponto_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON visitas_ponto;
DROP POLICY IF EXISTS "Empresa scoped insert" ON visitas_ponto;
DROP POLICY IF EXISTS "Empresa scoped update" ON visitas_ponto;
DROP POLICY IF EXISTS "Empresa scoped delete" ON visitas_ponto;

CREATE POLICY "Empresa scoped select" ON visitas_ponto
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON visitas_ponto
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON visitas_ponto
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON visitas_ponto
  FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "Empresa scoped select" ON visita_ponto_itens;
DROP POLICY IF EXISTS "Empresa scoped insert" ON visita_ponto_itens;
DROP POLICY IF EXISTS "Empresa scoped update" ON visita_ponto_itens;
DROP POLICY IF EXISTS "Empresa scoped delete" ON visita_ponto_itens;

CREATE POLICY "Empresa scoped select" ON visita_ponto_itens
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON visita_ponto_itens
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON visita_ponto_itens
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON visita_ponto_itens
  FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON visitas_ponto TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON visita_ponto_itens TO authenticated;
