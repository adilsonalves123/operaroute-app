-- Pesquisa de onboarding: gravada na empresa para upgrade/promoções inteligentes.
-- Supabase → SQL Editor → Run

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS pesquisa_onboarding JSONB;

COMMENT ON COLUMN public.empresas.pesquisa_onboarding IS
  'Respostas da pesquisa rápida: { quantidade_pontos, nichos_interesse[], possui_funcionarios, respondido_em }';

CREATE INDEX IF NOT EXISTS idx_empresas_pesquisa_onboarding
  ON public.empresas USING gin (pesquisa_onboarding)
  WHERE pesquisa_onboarding IS NOT NULL;
