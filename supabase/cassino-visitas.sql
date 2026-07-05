-- Módulo cassino: visitas + coletas por equipamento (GameControlPro)
-- Rode no Supabase SQL Editor APÓS schema.sql, equipamentos.sql e multi-nicho.sql

CREATE TABLE IF NOT EXISTS visitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  ponto_id UUID REFERENCES pontos(id) ON DELETE CASCADE NOT NULL,
  operador_id UUID,
  total_entrada_periodo BIGINT DEFAULT 0,
  total_saida_periodo BIGINT DEFAULT 0,
  total_lucro_centavos BIGINT DEFAULT 0,
  debito_abatido NUMERIC(12,2) DEFAULT 0,
  desconto NUMERIC(12,2) DEFAULT 0,
  valor_cliente NUMERIC(12,2) DEFAULT 0,
  valor_operacao NUMERIC(12,2) DEFAULT 0,
  desconto_recebimento NUMERIC(12,2) DEFAULT 0,
  valor_operacao_efetivo NUMERIC(12,2) DEFAULT 0,
  valor_pago NUMERIC(12,2) DEFAULT 0,
  valor_pix NUMERIC(12,2) DEFAULT 0,
  valor_dinheiro NUMERIC(12,2) DEFAULT 0,
  restante NUMERIC(12,2) DEFAULT 0,
  forma_pagamento forma_pagamento DEFAULT 'dinheiro',
  saldo_negativo BOOLEAN DEFAULT FALSE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitas_empresa ON visitas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_visitas_ponto ON visitas(ponto_id);
CREATE INDEX IF NOT EXISTS idx_visitas_created ON visitas(created_at DESC);

ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON visitas;
DROP POLICY IF EXISTS "Empresa scoped insert" ON visitas;
DROP POLICY IF EXISTS "Empresa scoped update" ON visitas;
DROP POLICY IF EXISTS "Empresa scoped delete" ON visitas;

CREATE POLICY "Empresa scoped select" ON visitas
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped insert" ON visitas
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped update" ON visitas
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped delete" ON visitas
  FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON visitas TO authenticated;

-- Pontos: abatimento automático de débito (padrão GCP)
ALTER TABLE pontos ADD COLUMN IF NOT EXISTS abater_automatico BOOLEAN DEFAULT TRUE;

-- Coletas: leituras por equipamento vinculadas à visita
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS visita_id UUID REFERENCES visitas(id) ON DELETE CASCADE;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS equipamento_id UUID REFERENCES equipamentos(id) ON DELETE SET NULL;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS entrada_anterior BIGINT;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS saida_anterior BIGINT;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS entrada_atual BIGINT;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS saida_atual BIGINT;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS entrada_periodo BIGINT;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS saida_periodo BIGINT;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS lucro_centavos BIGINT;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS valor_cliente NUMERIC(12,2);
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS valor_operacao NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_coletas_visita ON coletas(visita_id);
CREATE INDEX IF NOT EXISTS idx_coletas_equipamento ON coletas(equipamento_id);

-- Pendências vinculadas à visita
ALTER TABLE pendencias ADD COLUMN IF NOT EXISTS visita_id UUID REFERENCES visitas(id) ON DELETE SET NULL;
ALTER TABLE pendencias ADD COLUMN IF NOT EXISTS coleta_id UUID REFERENCES coletas(id) ON DELETE SET NULL;
ALTER TABLE pendencias ADD COLUMN IF NOT EXISTS resolvido_em TIMESTAMPTZ;

-- Financeiro vinculado à visita (1 movimento por visita)
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS visita_id UUID REFERENCES visitas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_visita ON financeiro(visita_id);
CREATE INDEX IF NOT EXISTS idx_pendencias_visita ON pendencias(visita_id);
