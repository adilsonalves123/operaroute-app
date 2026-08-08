-- Cadastro por SMS/WhatsApp: o Auth cria o user sem e-mail no auth.users.
-- O e-mail vai em raw_user_meta_data até /api/auth/completar-cadastro-telefone.
-- Rode no SQL Editor se o trial-7-dias.sql antigo já foi aplicado.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, whatsapp, trial_inicio, trial_fim, assinatura_ativa)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      split_part(COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''), '@', 1)
    ),
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    NULLIF(NEW.raw_user_meta_data->>'whatsapp', ''),
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
