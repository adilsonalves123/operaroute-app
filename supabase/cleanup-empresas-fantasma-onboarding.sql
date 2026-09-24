-- Limpa empresas fantasma criadas por retries de onboarding.
-- Mantém só a empresa vinculada em profiles.empresa_id (ou a mais recente se ainda sem vínculo).
-- Supabase → SQL Editor → Run
-- Revise o SELECT antes do DELETE.

-- 1) Preview: duplicatas por owner (exceto a ativa no profile)
SELECT
  e.id,
  e.nome_operacao,
  e.owner_id,
  e.created_at,
  p.empresa_id AS profile_empresa_id,
  CASE
    WHEN p.empresa_id = e.id THEN 'ATIVA (manter)'
    WHEN p.empresa_id IS NOT NULL THEN 'FANTASMA (pode apagar)'
    ELSE 'SEM VÍNCULO'
  END AS situacao
FROM empresas e
LEFT JOIN profiles p ON p.user_id = e.owner_id
WHERE e.owner_id IS NOT NULL
  AND (
    p.empresa_id IS NULL
    OR e.id <> p.empresa_id
  )
ORDER BY e.owner_id, e.created_at DESC;

-- 2) Soft-ocultar: zera owner_id das fantasmas que NÃO são a do profile
-- (a listagem do dono já esconde orfas; isso limpa o CRM)
UPDATE empresas e
SET owner_id = NULL
FROM profiles p
WHERE p.user_id = e.owner_id
  AND p.empresa_id IS NOT NULL
  AND e.id <> p.empresa_id;

-- 3) Opcional — delete duro só de fantasmas SEM pontos/equipe/equipamentos
-- Descomente se quiser apagar de vez:
/*
DELETE FROM empresas e
USING profiles p
WHERE p.user_id = e.owner_id
  AND p.empresa_id IS NOT NULL
  AND e.id <> p.empresa_id
  AND NOT EXISTS (SELECT 1 FROM pontos po WHERE po.empresa_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM equipamentos eq WHERE eq.empresa_id = e.id)
  AND NOT EXISTS (SELECT 1 FROM equipe eqp WHERE eqp.empresa_id = e.id);
*/
