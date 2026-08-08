-- Fase 2: checkout unificado da visita ao ponto
-- Rode após visitas-ponto.sql

ALTER TABLE visitas_ponto ADD COLUMN IF NOT EXISTS subtotal_cobravel NUMERIC(12,2) DEFAULT 0;
ALTER TABLE visitas_ponto ADD COLUMN IF NOT EXISTS divida_anterior_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE visitas_ponto ADD COLUMN IF NOT EXISTS divida_recebida_inicio NUMERIC(12,2) DEFAULT 0;
ALTER TABLE visitas_ponto ADD COLUMN IF NOT EXISTS desconto NUMERIC(12,2) DEFAULT 0;
ALTER TABLE visitas_ponto ADD COLUMN IF NOT EXISTS valor_pix NUMERIC(12,2) DEFAULT 0;
ALTER TABLE visitas_ponto ADD COLUMN IF NOT EXISTS valor_dinheiro NUMERIC(12,2) DEFAULT 0;
ALTER TABLE visitas_ponto ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(12,2) DEFAULT 0;
ALTER TABLE visitas_ponto ADD COLUMN IF NOT EXISTS total_cobrado NUMERIC(12,2) DEFAULT 0;
ALTER TABLE visitas_ponto ADD COLUMN IF NOT EXISTS restante NUMERIC(12,2) DEFAULT 0;
ALTER TABLE visitas_ponto ADD COLUMN IF NOT EXISTS forma_pagamento forma_pagamento DEFAULT 'dinheiro';

ALTER TABLE pendencias ADD COLUMN IF NOT EXISTS visita_ponto_id UUID REFERENCES visitas_ponto(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pendencias_visita_ponto ON pendencias(visita_ponto_id);
