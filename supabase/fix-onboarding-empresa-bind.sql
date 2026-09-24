-- Corrige cadastro/onboarding travado em "Salvo parcialmente".
-- Causa: trigger de segurança impedia o 1º vínculo profile.empresa_id (NULL → id).
-- Supabase → SQL Editor → colar tudo → Run

-- 1) Permitir 1º bind; continuar bloqueando troca de tenant depois
CREATE OR REPLACE FUNCTION public.profiles_lock_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Só trava se já havia empresa; NULL → id é o onboarding legítimo.
    IF OLD.empresa_id IS NOT NULL THEN
      NEW.empresa_id := OLD.empresa_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_sensitive ON public.profiles;
CREATE TRIGGER trg_profiles_lock_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_lock_sensitive_columns();

-- 2) RPC de onboarding (idempotente)
CREATE OR REPLACE FUNCTION complete_onboarding(
  p_nome_operacao TEXT,
  p_nicho nicho_type,
  p_quantidade_pontos TEXT,
  p_possui_funcionarios BOOLEAN,
  p_objetivo_principal TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_empresa_id UUID;
  v_nome TEXT;
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT
    COALESCE(raw_user_meta_data->>'nome', email),
    email
  INTO v_nome, v_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO profiles (user_id, nome, email, trial_inicio, trial_fim, assinatura_ativa)
  VALUES (v_user_id, v_nome, v_email, NOW(), NOW() + INTERVAL '7 days', FALSE)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT empresa_id INTO v_empresa_id
  FROM profiles
  WHERE user_id = v_user_id;

  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id
    FROM empresas
    WHERE owner_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_empresa_id IS NULL THEN
    INSERT INTO empresas (
      owner_id, nome_operacao, nicho, quantidade_pontos,
      possui_funcionarios, objetivo_principal, plano, limite_pontos, limite_usuarios
    )
    VALUES (
      v_user_id, p_nome_operacao, p_nicho, p_quantidade_pontos,
      p_possui_funcionarios, p_objetivo_principal, 'start', 20, 1
    )
    RETURNING id INTO v_empresa_id;
  ELSE
    UPDATE empresas SET
      nome_operacao = p_nome_operacao,
      nicho = p_nicho,
      quantidade_pontos = p_quantidade_pontos,
      possui_funcionarios = p_possui_funcionarios,
      objetivo_principal = p_objetivo_principal
    WHERE id = v_empresa_id;
  END IF;

  UPDATE profiles SET
    onboarding_completo = TRUE,
    nicho = p_nicho,
    nome_operacao = p_nome_operacao,
    empresa_id = v_empresa_id,
    plano = 'start',
    trial_inicio = COALESCE(trial_inicio, NOW()),
    trial_fim = COALESCE(trial_fim, NOW() + INTERVAL '7 days'),
    assinatura_ativa = FALSE
  WHERE user_id = v_user_id;

  IF NOT EXISTS (
    SELECT 1 FROM equipe WHERE empresa_id = v_empresa_id AND user_id = v_user_id
  ) THEN
    INSERT INTO equipe (empresa_id, user_id, nome, email, role, status)
    VALUES (v_empresa_id, v_user_id, v_nome, v_email, 'admin', 'ativo');
  END IF;

  RETURN v_empresa_id;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_onboarding(TEXT, nicho_type, TEXT, BOOLEAN, TEXT) TO authenticated;

-- 3) Repara quem já criou empresa mas ficou sem empresa_id no profile
UPDATE profiles p
SET
  empresa_id = e.id,
  onboarding_completo = TRUE,
  nome_operacao = COALESCE(p.nome_operacao, e.nome_operacao),
  nicho = COALESCE(p.nicho, e.nicho)
FROM empresas e
WHERE e.owner_id = p.user_id
  AND p.empresa_id IS NULL;

-- Admin na equipe para esses casos
INSERT INTO equipe (empresa_id, user_id, nome, email, role, status)
SELECT
  e.id,
  p.user_id,
  COALESCE(p.nome, p.email, 'Admin'),
  p.email,
  'admin',
  'ativo'
FROM profiles p
JOIN empresas e ON e.id = p.empresa_id AND e.owner_id = p.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM equipe eq
  WHERE eq.empresa_id = e.id AND eq.user_id = p.user_id
);

NOTIFY pgrst, 'reload schema';

-- Conferência
SELECT p.email, p.empresa_id IS NOT NULL AS vinculado, e.nome_operacao
FROM profiles p
LEFT JOIN empresas e ON e.id = p.empresa_id
ORDER BY p.created_at DESC
LIMIT 20;
