-- Data do financeiro no fuso do Brasil (não UTC do CURRENT_DATE).
-- Coletas à noite (após 21h BRT) deixavam de cair no dia certo.

ALTER TABLE public.financeiro
  ALTER COLUMN data SET DEFAULT ((timezone('America/Sao_Paulo', now()))::date);

-- Alinha data ao dia civil de created_at em Brasília (últimos 60 dias).
UPDATE public.financeiro
SET data = (timezone('America/Sao_Paulo', created_at))::date
WHERE created_at IS NOT NULL
  AND data IS DISTINCT FROM (timezone('America/Sao_Paulo', created_at))::date
  AND created_at >= (now() - interval '60 days');
