-- Corrige erro HTTP 500 ao criar login de membro da equipe
-- (AuthRetryableFetchError / "Database error saving new user")
--
-- Causa comum: trigger on_auth_user_created em auth.users falha ao inserir em profiles
-- por falta de search_path ou permissões.
--
-- Supabase → SQL Editor → cole tudo → Run

-- 1) Função segura (SECURITY DEFINER + search_path)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, trial_inicio, trial_fim, assinatura_ativa)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.email, ''),
    NOW(),
    NOW() + INTERVAL '7 days',
    FALSE
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user falhou para %: %', NEW.id, SQLERRM;
    RAISE;
END;
$$;

-- 2) Recriar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3) Permissões para o Auth escrever em profiles via trigger
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT, UPDATE ON public.profiles TO supabase_auth_admin;

-- 4) Conferência
SELECT
  tgname AS trigger_name,
  proname AS function_name,
  prosecdef AS security_definer
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';
