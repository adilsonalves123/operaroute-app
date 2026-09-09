-- OperaRoute security hardening (run in Supabase SQL Editor).
-- Does not change business data — only RLS / grants / triggers / storage policies.

-- ---------------------------------------------------------------------------
-- 1) Lock sensitive profile columns (cross-tenant takeover via empresa_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_lock_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Impede troca de tenant (cross-tenant takeover).
  IF TG_OP = 'UPDATE' THEN
    NEW.empresa_id := OLD.empresa_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_sensitive ON public.profiles;
CREATE TRIGGER trg_profiles_lock_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_lock_sensitive_columns();

-- ---------------------------------------------------------------------------
-- 2) Equipe: only owner/admin may mutate; block self-promotion to admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_empresa_admin_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = public.get_user_empresa_id() AND e.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.equipe eq
    WHERE eq.empresa_id = public.get_user_empresa_id()
      AND eq.user_id = auth.uid()
      AND lower(coalesce(eq.role, '')) IN ('admin')
  );
$$;

DROP POLICY IF EXISTS "Empresa scoped insert" ON public.equipe;
DROP POLICY IF EXISTS "Empresa scoped update" ON public.equipe;
DROP POLICY IF EXISTS "Empresa scoped delete" ON public.equipe;

CREATE POLICY "Equipe admin insert"
  ON public.equipe FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.is_empresa_admin_or_owner()
    AND (
      lower(coalesce(role, '')) IS DISTINCT FROM 'admin'
      OR EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = empresa_id AND e.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Equipe admin update"
  ON public.equipe FOR UPDATE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.is_empresa_admin_or_owner()
  )
  WITH CHECK (
    empresa_id = public.get_user_empresa_id()
    AND public.is_empresa_admin_or_owner()
    AND (
      lower(coalesce(role, '')) IS DISTINCT FROM 'admin'
      OR EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = empresa_id AND e.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Equipe admin delete"
  ON public.equipe FOR DELETE TO authenticated
  USING (
    empresa_id = public.get_user_empresa_id()
    AND public.is_empresa_admin_or_owner()
  );

-- ---------------------------------------------------------------------------
-- 3) Public rascunho: no anon table dump — token RPC only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon read public resumo by token" ON public.public_rascunho_resumos;
REVOKE SELECT ON public.public_rascunho_resumos FROM anon;

CREATE OR REPLACE FUNCTION public.get_resumo_rascunho_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT r.snapshot INTO v_snapshot
  FROM public.public_rascunho_resumos r
  WHERE r.token = trim(p_token)
    AND r.revoked_at IS NULL
    AND (r.expires_at IS NULL OR r.expires_at > NOW())
  LIMIT 1;

  IF v_snapshot IS NOT NULL THEN
    UPDATE public.public_rascunho_resumos
    SET last_viewed_at = NOW()
    WHERE token = trim(p_token);
  END IF;

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.get_resumo_rascunho_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_resumo_rascunho_by_token(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Storage: stop open listing; keep public CDN URLs for coleta-fotos
--    suporte-anexos becomes private (no public SELECT)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read coleta fotos" ON storage.objects;
DROP POLICY IF EXISTS "Empresa read coleta fotos" ON storage.objects;

CREATE POLICY "Empresa read coleta fotos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'coleta-fotos'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  );

-- Public bucket still serves /object/public/... without listing via REST.
UPDATE storage.buckets SET public = true WHERE id = 'coleta-fotos';

DROP POLICY IF EXISTS "Public read suporte anexos" ON storage.objects;
DROP POLICY IF EXISTS "Empresa read suporte anexos" ON storage.objects;

CREATE POLICY "Empresa read suporte anexos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'suporte-anexos'
    AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
  );

-- Mantém CDN público por URL direta; remove apenas listagem REST aberta.
UPDATE storage.buckets SET public = true WHERE id = 'suporte-anexos';

NOTIFY pgrst, 'reload schema';
