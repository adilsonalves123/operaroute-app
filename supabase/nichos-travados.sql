-- Trava de nichos confirmados: cliente não troca sozinho (só suporte/plataforma).
-- Rode no Supabase SQL Editor.

ALTER TABLE empresa_nichos
  ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ;

COMMENT ON COLUMN empresa_nichos.confirmado_em IS
  'Quando o nicho foi confirmado pelo cliente. Enquanto preenchido e ativo, só suporte pode desativar/trocar.';

-- Empresas que já usam nichos: considera escolhido (não podem mais trocar sozinhas).
UPDATE empresa_nichos
SET confirmado_em = COALESCE(confirmado_em, created_at, NOW())
WHERE ativo = TRUE
  AND nicho IS DISTINCT FROM 'outros'
  AND confirmado_em IS NULL;
