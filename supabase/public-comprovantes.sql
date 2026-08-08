-- Comprovantes públicos (link mágico /c/TOKEN).
-- Rode no Supabase SQL Editor (projeto certo).
-- Depois: Table Editor → confira se existe public_comprovantes.
-- Se a API ainda reclamar: Settings → API → Reload schema (ou rode o NOTIFY no final).

CREATE TABLE IF NOT EXISTS public.public_comprovantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  visita_ponto_id UUID REFERENCES public.visitas_ponto(id) ON DELETE CASCADE,
  visita_id UUID REFERENCES public.visitas(id) ON DELETE CASCADE,
  previa BOOLEAN NOT NULL DEFAULT false,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_public_comprovantes_token
  ON public.public_comprovantes(token);
CREATE INDEX IF NOT EXISTS idx_public_comprovantes_empresa
  ON public.public_comprovantes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_public_comprovantes_visita_ponto
  ON public.public_comprovantes(visita_ponto_id)
  WHERE visita_ponto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_public_comprovantes_visita
  ON public.public_comprovantes(visita_id)
  WHERE visita_id IS NOT NULL;

ALTER TABLE public.public_comprovantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped insert public_comprovantes" ON public.public_comprovantes;
CREATE POLICY "Empresa scoped insert public_comprovantes"
  ON public.public_comprovantes FOR INSERT
  TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "Empresa scoped select public_comprovantes" ON public.public_comprovantes;
CREATE POLICY "Empresa scoped select public_comprovantes"
  ON public.public_comprovantes FOR SELECT
  TO authenticated
  USING (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "Empresa scoped update public_comprovantes" ON public.public_comprovantes;
CREATE POLICY "Empresa scoped update public_comprovantes"
  ON public.public_comprovantes FOR UPDATE
  TO authenticated
  USING (empresa_id = get_user_empresa_id());

-- App usa service role na API (bypass RLS). Garante privilégio explícito.
GRANT SELECT, INSERT, UPDATE ON public.public_comprovantes TO authenticated;
GRANT ALL ON public.public_comprovantes TO service_role;

-- Força o PostgREST a enxergar a tabela nova (evita "schema cache").
NOTIFY pgrst, 'reload schema';

-- Confirmação: deve retornar 1 linha.
SELECT 'public_comprovantes ok' AS status, COUNT(*) AS cols
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'public_comprovantes';
