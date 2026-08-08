-- Mercado Pago — checkouts pendentes + vencimento da assinatura
-- Rode no Supabase SQL Editor

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS assinatura_vence_em TIMESTAMPTZ;

COMMENT ON COLUMN empresas.assinatura_vence_em IS
  'Fim do período pago (mensal +1 mês / anual +1 ano). Null = só trial ou manual.';

CREATE TABLE IF NOT EXISTS plataforma_checkout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID,
  ciclo TEXT NOT NULL CHECK (ciclo IN ('mensal', 'anual')),
  faixa TEXT NOT NULL,
  nichos JSONB NOT NULL DEFAULT '[]'::jsonb,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  plano_nome TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'pago', 'cancelado', 'expirado')),
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  mp_status TEXT,
  init_point TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plataforma_checkout_empresa
  ON plataforma_checkout(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plataforma_checkout_status
  ON plataforma_checkout(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plataforma_checkout_preference
  ON plataforma_checkout(mp_preference_id);

ALTER TABLE plataforma_checkout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all authenticated checkout" ON plataforma_checkout;
CREATE POLICY "Deny all authenticated checkout" ON plataforma_checkout
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT ALL ON plataforma_checkout TO service_role;

ALTER TABLE plataforma_pagamentos
  ADD COLUMN IF NOT EXISTS checkout_id UUID REFERENCES plataforma_checkout(id) ON DELETE SET NULL;
