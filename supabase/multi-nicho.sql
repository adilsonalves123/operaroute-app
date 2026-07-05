-- Multi-nicho + limites por faixa de pontos
-- Rode no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS empresa_nichos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  nicho nicho_type NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, nicho)
);

CREATE INDEX IF NOT EXISTS idx_empresa_nichos_empresa ON empresa_nichos(empresa_id);

ALTER TABLE empresa_nichos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON empresa_nichos;
DROP POLICY IF EXISTS "Empresa scoped insert" ON empresa_nichos;
DROP POLICY IF EXISTS "Empresa scoped update" ON empresa_nichos;
DROP POLICY IF EXISTS "Empresa scoped delete" ON empresa_nichos;

CREATE POLICY "Empresa scoped select" ON empresa_nichos
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped insert" ON empresa_nichos
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped update" ON empresa_nichos
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped delete" ON empresa_nichos
  FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON empresa_nichos TO authenticated;

-- Migra nicho único existente
INSERT INTO empresa_nichos (empresa_id, nicho)
SELECT id, nicho FROM empresas
ON CONFLICT (empresa_id, nicho) DO NOTHING;

-- Sempre inclui "outros" (nicho base gratuito)
INSERT INTO empresa_nichos (empresa_id, nicho)
SELECT id, 'outros'::nicho_type FROM empresas
ON CONFLICT (empresa_id, nicho) DO NOTHING;

CREATE OR REPLACE FUNCTION limite_pontos_from_faixa(p_faixa TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_faixa
    WHEN '1-10' THEN 10
    WHEN '11-30' THEN 30
    WHEN '11-50' THEN 30
    WHEN '31-60' THEN 60
    WHEN '51-100' THEN 100
    WHEN '61-100' THEN 100
    WHEN '100+' THEN 9999
    ELSE 10
  END;
$$;

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
  v_limite INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_limite := limite_pontos_from_faixa(p_quantidade_pontos);

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
    p_possui_funcionarios, p_objetivo_principal, 'start', v_limite, 1
  )
  RETURNING id INTO v_empresa_id;

  INSERT INTO empresa_nichos (empresa_id, nicho)
  VALUES (v_empresa_id, p_nicho)
  ON CONFLICT (empresa_id, nicho) DO NOTHING;

  INSERT INTO empresa_nichos (empresa_id, nicho)
  VALUES (v_empresa_id, 'outros')
  ON CONFLICT (empresa_id, nicho) DO NOTHING;

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
