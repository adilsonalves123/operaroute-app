-- Visão do operador: painel/lista com valores publicados, sem alterar coleta real.
-- Rode no Supabase SQL Editor. Quem não for marcado continua vendo tudo como hoje.

ALTER TABLE public.equipe
  ADD COLUMN IF NOT EXISTS visao_restrita BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.equipe.visao_restrita IS
  'Se true, o membro coleta normal mas painel/lista/pontos usam só a visão publicada.';

CREATE TABLE IF NOT EXISTS public.visao_pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES public.equipe(id) ON DELETE CASCADE,
  ponto_id UUID NOT NULL REFERENCES public.pontos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (equipe_id, ponto_id)
);

CREATE INDEX IF NOT EXISTS idx_visao_pontos_empresa ON public.visao_pontos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_visao_pontos_equipe ON public.visao_pontos(equipe_id);

CREATE TABLE IF NOT EXISTS public.visao_valores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES public.equipe(id) ON DELETE CASCADE,
  ponto_id UUID NOT NULL REFERENCES public.pontos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  valor_exibido NUMERIC(14, 2) NOT NULL DEFAULT 0,
  publicado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (equipe_id, ponto_id, data)
);

CREATE INDEX IF NOT EXISTS idx_visao_valores_empresa_data
  ON public.visao_valores(empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_visao_valores_equipe_data
  ON public.visao_valores(equipe_id, data DESC);

ALTER TABLE public.visao_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visao_valores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped visao_pontos" ON public.visao_pontos;
CREATE POLICY "Empresa scoped visao_pontos"
  ON public.visao_pontos FOR ALL
  TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "Empresa scoped visao_valores" ON public.visao_valores;
CREATE POLICY "Empresa scoped visao_valores"
  ON public.visao_valores FOR ALL
  TO authenticated
  USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visao_pontos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visao_valores TO authenticated;
GRANT ALL ON public.visao_pontos TO service_role;
GRANT ALL ON public.visao_valores TO service_role;

NOTIFY pgrst, 'reload schema';
