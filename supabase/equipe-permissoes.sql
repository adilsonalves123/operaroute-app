-- Permissões personalizadas por membro da equipe
-- Supabase → SQL Editor → Run

ALTER TABLE equipe
  ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT NULL;

COMMENT ON COLUMN equipe.permissoes IS
  'Overrides de permissão por módulo. NULL = usa padrão da função (role).';
