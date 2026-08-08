-- Assinatura SaaS OperaRoute (painel do dono)
-- Rode no Supabase SQL Editor

-- Ciclo de cobrança do cliente (mensal x anual)
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS ciclo_cobranca TEXT NOT NULL DEFAULT 'mensal';

ALTER TABLE empresas
  DROP CONSTRAINT IF EXISTS empresas_ciclo_cobranca_check;
ALTER TABLE empresas
  ADD CONSTRAINT empresas_ciclo_cobranca_check
  CHECK (ciclo_cobranca IN ('mensal', 'anual'));

COMMENT ON COLUMN empresas.ciclo_cobranca IS
  'Ciclo de cobrança da assinatura OperaRoute: mensal ou anual';

-- Pagamentos / arrecadação real do SaaS (gateway futuro ou lançamento manual do dono)
CREATE TABLE IF NOT EXISTS plataforma_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  empresa_nome TEXT,
  ciclo TEXT NOT NULL CHECK (ciclo IN ('mensal', 'anual')),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  status TEXT NOT NULL DEFAULT 'pago'
    CHECK (status IN ('pago', 'pendente', 'estornado', 'falhou')),
  metodo TEXT DEFAULT 'manual',
  referencia TEXT,
  observacao TEXT,
  pago_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  competencia_mes DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_plataforma_pagamentos_pago_em
  ON plataforma_pagamentos(pago_em DESC);
CREATE INDEX IF NOT EXISTS idx_plataforma_pagamentos_status_pago
  ON plataforma_pagamentos(status, pago_em DESC);
CREATE INDEX IF NOT EXISTS idx_plataforma_pagamentos_empresa
  ON plataforma_pagamentos(empresa_id, pago_em DESC);
CREATE INDEX IF NOT EXISTS idx_plataforma_pagamentos_ciclo
  ON plataforma_pagamentos(ciclo, pago_em DESC);

ALTER TABLE plataforma_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all authenticated" ON plataforma_pagamentos;
CREATE POLICY "Deny all authenticated" ON plataforma_pagamentos
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT ALL ON plataforma_pagamentos TO service_role;
