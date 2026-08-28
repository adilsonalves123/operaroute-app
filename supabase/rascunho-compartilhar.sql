-- Link público do Resumo da rota (/r/TOKEN).
-- Rode no Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.public_rascunho_resumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_public_rascunho_resumos_token
  ON public.public_rascunho_resumos(token);
CREATE INDEX IF NOT EXISTS idx_public_rascunho_resumos_empresa
  ON public.public_rascunho_resumos(empresa_id);

ALTER TABLE public.public_rascunho_resumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped insert public_rascunho_resumos" ON public.public_rascunho_resumos;
CREATE POLICY "Empresa scoped insert public_rascunho_resumos"
  ON public.public_rascunho_resumos FOR INSERT
  TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "Empresa scoped select public_rascunho_resumos" ON public.public_rascunho_resumos;
CREATE POLICY "Empresa scoped select public_rascunho_resumos"
  ON public.public_rascunho_resumos FOR SELECT
  TO authenticated
  USING (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT ON public.public_rascunho_resumos TO authenticated;
GRANT ALL ON public.public_rascunho_resumos TO service_role;

-- Leitura pública segura por token (sem service role na Vercel).
CREATE OR REPLACE FUNCTION public.get_public_rascunho_resumo(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  UPDATE public.public_rascunho_resumos
  SET last_viewed_at = NOW()
  WHERE token = p_token
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING snapshot INTO v_snapshot;

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_rascunho_resumo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_rascunho_resumo(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
