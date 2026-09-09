-- Forma de pagamento na visão publicada do operador (Pix / dinheiro).
-- Rode no Supabase SQL Editor.

ALTER TABLE public.visao_valores
  ADD COLUMN IF NOT EXISTS forma TEXT;

COMMENT ON COLUMN public.visao_valores.forma IS
  'pix, dinheiro ou misto — só para a barra do painel do operador.';

NOTIFY pgrst, 'reload schema';
