-- Mercado Pago — renovação automática no cartão (preapproval / assinatura sem plano)
-- Rode no Supabase SQL Editor (depois de mercado-pago-billing.sql).

-- avulso = pagamento único (Pix/boleto/cartão) · assinatura = modelo da recorrência
-- assinatura_cobranca = cada cobrança mensal/anual aprovada da recorrência
ALTER TABLE plataforma_checkout
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'avulso';

ALTER TABLE plataforma_checkout
  DROP CONSTRAINT IF EXISTS plataforma_checkout_tipo_check;
ALTER TABLE plataforma_checkout
  ADD CONSTRAINT plataforma_checkout_tipo_check
  CHECK (tipo IN ('avulso', 'assinatura', 'assinatura_cobranca'));

ALTER TABLE plataforma_checkout
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT;

CREATE INDEX IF NOT EXISTS idx_plataforma_checkout_preapproval
  ON plataforma_checkout(mp_preapproval_id);

-- Mesmo pagamento do MP nunca ativa dois períodos (webhook duplicado / corrida).
CREATE UNIQUE INDEX IF NOT EXISTS uq_plataforma_checkout_mp_payment
  ON plataforma_checkout(mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT;

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS renovacao_automatica BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN empresas.renovacao_automatica IS
  'Assinatura recorrente no cartão (Mercado Pago) ativa. Pix/boleto continuam manuais.';
