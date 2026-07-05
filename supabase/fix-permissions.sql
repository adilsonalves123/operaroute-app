-- CORREÇÃO: permission denied for table empresas
-- Supabase → SQL Editor → cole tudo → Run

-- 1) Permissões no schema e tabelas
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated, anon;

-- 2) Tabelas principais (garantia extra)
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON equipe TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pontos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON coletas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON financeiro TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pendencias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON estoque TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON estoque_movimentacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rotas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rota_pontos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON auditoria TO authenticated;

-- 3) Função de onboarding (contorna RLS)
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
  VALUES (v_user_id, v_nome, v_email, NOW(), NOW() + INTERVAL '7 days', TRUE)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO empresas (
    owner_id, nome_operacao, nicho, quantidade_pontos,
    possui_funcionarios, objetivo_principal, plano, limite_pontos, limite_usuarios
  )
  VALUES (
    v_user_id, p_nome_operacao, p_nicho, p_quantidade_pontos,
    p_possui_funcionarios, p_objetivo_principal, 'start', 20, 1
  )
  RETURNING id INTO v_empresa_id;

  UPDATE profiles SET
    onboarding_completo = TRUE,
    nicho = p_nicho,
    nome_operacao = p_nome_operacao,
    empresa_id = v_empresa_id,
    plano = 'start',
    assinatura_ativa = TRUE
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

-- 4) Políticas RLS empresas
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own empresa" ON empresas;
DROP POLICY IF EXISTS "Users can insert empresa" ON empresas;
DROP POLICY IF EXISTS "Owner can update empresa" ON empresas;

CREATE POLICY "Users can view own empresa" ON empresas
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa" ON empresas
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update empresa" ON empresas
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- Pronto! Recarregue o app e tente Finalizar configuração de novo.
