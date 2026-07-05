-- Rode no Supabase SQL Editor

-- 1) Se não existe empresa, libera refazer onboarding
UPDATE profiles
SET onboarding_completo = FALSE
WHERE empresa_id IS NULL;

-- 2) Vincula profile ↔ empresa (se empresa existir)
UPDATE profiles p
SET
  empresa_id = e.id,
  onboarding_completo = TRUE,
  nome_operacao = COALESCE(p.nome_operacao, e.nome_operacao),
  nicho = COALESCE(p.nicho, e.nicho)
FROM empresas e
WHERE e.owner_id = p.user_id
  AND p.empresa_id IS NULL;

-- 3) Conferir
SELECT
  p.email,
  p.onboarding_completo,
  p.empresa_id,
  e.nome_operacao
FROM profiles p
LEFT JOIN empresas e ON e.id = p.empresa_id
ORDER BY p.created_at DESC;
