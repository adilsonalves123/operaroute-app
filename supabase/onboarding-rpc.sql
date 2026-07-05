-- Rode no Supabase SQL Editor se o onboarding ainda falhar com erro 500
-- Cria função segura que salva empresa + profile + equipe de uma vez

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

  -- Garante profile
  INSERT INTO profiles (user_id, nome, email, trial_inicio, trial_fim, assinatura_ativa)
  VALUES (v_user_id, v_nome, v_email, NOW(), NOW() + INTERVAL '7 days', TRUE)
  ON CONFLICT (user_id) DO NOTHING;

  -- Cria empresa
  INSERT INTO empresas (
    owner_id, nome_operacao, nicho, quantidade_pontos,
    possui_funcionarios, objetivo_principal, plano, limite_pontos, limite_usuarios
  )
  VALUES (
    v_user_id, p_nome_operacao, p_nicho, p_quantidade_pontos,
    p_possui_funcionarios, p_objetivo_principal, 'start', 20, 1
  )
  RETURNING id INTO v_empresa_id;

  -- Atualiza profile
  UPDATE profiles SET
    onboarding_completo = TRUE,
    nicho = p_nicho,
    nome_operacao = p_nome_operacao,
    empresa_id = v_empresa_id,
    plano = 'start',
    assinatura_ativa = TRUE
  WHERE user_id = v_user_id;

  -- Admin na equipe
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
