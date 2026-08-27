-- Ativa o menu/tela Rascunho (valores manuais) por empresa. Desligado por padrão.
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS rascunho_dashboard_ativo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN empresas.rascunho_dashboard_ativo IS
  'Se true, mostra o menu Rascunho no app (dashboard de valores manuais, sem gravar).';
