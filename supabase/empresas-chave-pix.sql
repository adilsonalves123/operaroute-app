-- Chave Pix da operação (cobrança WhatsApp ao finalizar visita sem pagamento).
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS chave_pix TEXT;

COMMENT ON COLUMN empresas.chave_pix IS
  'Chave Pix (CPF/CNPJ/email/telefone/aleatória) usada nas mensagens de cobrança.';
