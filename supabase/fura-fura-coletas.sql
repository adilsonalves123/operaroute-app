-- Módulo fura-fura: coletas, pagamentos parciais e estoque por ponto
-- Rode no Supabase SQL Editor

ALTER TABLE pontos ADD COLUMN IF NOT EXISTS preco_furo NUMERIC(12,2) DEFAULT 1;
ALTER TABLE pontos ADD COLUMN IF NOT EXISTS furos_estoque INTEGER;
ALTER TABLE pontos ADD COLUMN IF NOT EXISTS furos_minimo INTEGER DEFAULT 0;
ALTER TABLE pontos ADD COLUMN IF NOT EXISTS estoque_brindes JSONB DEFAULT '[]'::jsonb;

ALTER TABLE coletas ADD COLUMN IF NOT EXISTS preco_furo NUMERIC(12,2);
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS desconto NUMERIC(12,2) DEFAULT 0;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS valor_a_receber NUMERIC(12,2);
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS valor_pago_recebido NUMERIC(12,2) DEFAULT 0;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS custo_brindes NUMERIC(12,2) DEFAULT 0;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS lucro_real NUMERIC(12,2);
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS relatorio_enviado BOOLEAN DEFAULT FALSE;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS brindes_entregues JSONB DEFAULT '[]'::jsonb;
ALTER TABLE coletas ADD COLUMN IF NOT EXISTS nicho_modulo TEXT;

CREATE TABLE IF NOT EXISTS coleta_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  coleta_id UUID REFERENCES coletas(id) ON DELETE CASCADE NOT NULL,
  ponto_id UUID REFERENCES pontos(id) ON DELETE SET NULL,
  valor NUMERIC(12,2) NOT NULL,
  forma_pagamento forma_pagamento DEFAULT 'dinheiro',
  observacao TEXT,
  operador_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coleta_pagamentos_coleta ON coleta_pagamentos(coleta_id);
CREATE INDEX IF NOT EXISTS idx_coleta_pagamentos_ponto ON coleta_pagamentos(ponto_id);
CREATE INDEX IF NOT EXISTS idx_coletas_nicho_modulo ON coletas(nicho_modulo) WHERE nicho_modulo IS NOT NULL;

ALTER TABLE coleta_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON coleta_pagamentos;
DROP POLICY IF EXISTS "Empresa scoped insert" ON coleta_pagamentos;

CREATE POLICY "Empresa scoped select" ON coleta_pagamentos
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped insert" ON coleta_pagamentos
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT ON coleta_pagamentos TO authenticated;
