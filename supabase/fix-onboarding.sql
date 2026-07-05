-- Rode DEPOIS do schema.sql se o onboarding ainda falhar
-- Supabase → SQL Editor → colar tudo → Run

-- 1) Criar profiles para usuários que se cadastraram antes do trigger
INSERT INTO profiles (user_id, nome, email, trial_inicio, trial_fim, assinatura_ativa)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'nome', email),
  email,
  NOW(),
  NOW() + INTERVAL '7 days',
  TRUE
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM profiles WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- 2) Garantir políticas de empresas
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own empresa" ON empresas;
DROP POLICY IF EXISTS "Users can insert empresa" ON empresas;
DROP POLICY IF EXISTS "Owner can update empresa" ON empresas;

CREATE POLICY "Users can view own empresa" ON empresas
  FOR SELECT USING (owner_id = auth.uid() OR id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa" ON empresas
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update empresa" ON empresas
  FOR UPDATE USING (owner_id = auth.uid());

-- 3) Garantir políticas de profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 4) Garantir políticas de equipe
ALTER TABLE equipe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON equipe;
DROP POLICY IF EXISTS "Empresa scoped insert" ON equipe;
DROP POLICY IF EXISTS "Empresa scoped update" ON equipe;
DROP POLICY IF EXISTS "Empresa scoped delete" ON equipe;

CREATE POLICY "Empresa scoped select" ON equipe
  FOR SELECT USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped insert" ON equipe
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped update" ON equipe
  FOR UPDATE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped delete" ON equipe
  FOR DELETE USING (empresa_id = get_user_empresa_id());

-- 5) Conferir se tabelas existem (deve retornar profiles, empresas, equipe)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'empresas', 'equipe')
ORDER BY table_name;
