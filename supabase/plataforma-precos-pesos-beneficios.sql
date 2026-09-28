-- Pesos dos nichos e benefícios dos planos editáveis no painel do dono.
-- Rode no Supabase SQL Editor (depois de plataforma-precos.sql).

ALTER TABLE plataforma_planos_catalogo
  ADD COLUMN IF NOT EXISTS beneficios_extras JSONB;

-- Pesos atuais do código (1 = preço cheio do plano). Não sobrescreve se o dono já salvou.
INSERT INTO plataforma_config (chave, valor)
VALUES (
  'pesos_nichos',
  '{"maquinas_cassino":1,"ursinho":0.9,"diversao":0.85,"consignado":0.8,"bolinha":0.7,"fura_fura":0.65}'::jsonb
)
ON CONFLICT (chave) DO NOTHING;
