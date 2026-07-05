-- Adiantamento em visita negativa: Pix/dinheiro + flags de caixa (por forma)
ALTER TABLE visitas
  ADD COLUMN IF NOT EXISTS adiantamento_pix NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adiantamento_dinheiro NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adiantamento_do_caixa BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS adiantamento_pix_do_caixa BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS adiantamento_dinheiro_do_caixa BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recebimento_pix_do_caixa BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recebimento_dinheiro_do_caixa BOOLEAN DEFAULT FALSE;

-- Migra legado: dinheiro marcado no campo antigo
UPDATE visitas
SET adiantamento_dinheiro_do_caixa = TRUE
WHERE adiantamento_do_caixa = TRUE
  AND COALESCE(adiantamento_dinheiro, 0) > 0
  AND COALESCE(adiantamento_dinheiro_do_caixa, FALSE) = FALSE;
