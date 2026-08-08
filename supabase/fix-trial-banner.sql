-- Corrige contas travadas com assinatura_ativa=TRUE pelo complete_onboarding antigo
-- (banner de trial sumia e o app nunca expirava o teste).
-- Rode no Supabase SQL Editor. Não mexe em quem você ativou assinatura de propósito
-- depois do trial — ajuste o filtro se precisar.

-- Opção A: só quem ainda tem trial_fim no futuro (ainda “em teste” na prática)
UPDATE public.profiles
SET assinatura_ativa = FALSE
WHERE assinatura_ativa = TRUE
  AND trial_fim IS NOT NULL
  AND trial_fim > NOW()
  AND onboarding_completo = TRUE;

-- Opção B (conta específica): descomente e troque o e-mail
-- UPDATE public.profiles
-- SET
--   assinatura_ativa = FALSE,
--   trial_inicio = COALESCE(trial_inicio, NOW()),
--   trial_fim = NOW() + INTERVAL '7 days'
-- WHERE email ILIKE 'seu@email.com';
