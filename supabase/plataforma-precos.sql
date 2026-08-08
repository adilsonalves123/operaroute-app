-- 4 planos fixos OperaRoute (substituem a matriz faixa × nichos)
-- Rode no Supabase SQL Editor

-- Permitir slug growth no enum (se ainda for o antigo)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plano_type') THEN
    BEGIN
      ALTER TYPE plano_type ADD VALUE IF NOT EXISTS 'growth';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS plataforma_planos_catalogo (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  destaque BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plataforma_planos_catalogo
  ADD COLUMN IF NOT EXISTS faixa TEXT,
  ADD COLUMN IF NOT EXISTS limite_pontos INTEGER,
  ADD COLUMN IF NOT EXISTS max_nichos INTEGER,
  ADD COLUMN IF NOT EXISTS preco_mensal NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS plataforma_config (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plataforma_planos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE plataforma_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all authenticated planos_cat" ON plataforma_planos_catalogo;
CREATE POLICY "Deny all authenticated planos_cat" ON plataforma_planos_catalogo
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all authenticated config" ON plataforma_config;
CREATE POLICY "Deny all authenticated config" ON plataforma_config
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT ALL ON plataforma_planos_catalogo TO service_role;
GRANT ALL ON plataforma_config TO service_role;

-- Upsert dos 4 planos
INSERT INTO plataforma_planos_catalogo
  (id, nome, descricao, destaque, ativo, ordem, faixa, limite_pontos, max_nichos, preco_mensal, updated_at)
VALUES
  ('start', 'Start', 'Operação enxuta — até 10 pontos e 1 nicho.', false, true, 1, '1-10', 10, 1, 99.90, NOW()),
  ('growth', 'Growth', 'Crescimento — até 50 pontos e 3 nichos.', true, true, 2, '11-50', 50, 3, 259.90, NOW()),
  ('pro', 'Pro', 'Escala — até 100 pontos e 6 nichos.', false, true, 3, '51-100', 100, 6, 349.90, NOW()),
  ('elite', 'Elite', 'Grande operação — 100+ pontos e até 6 nichos.', false, true, 4, '100+', 9999, 6, 399.90, NOW())
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  destaque = EXCLUDED.destaque,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  faixa = EXCLUDED.faixa,
  limite_pontos = EXCLUDED.limite_pontos,
  max_nichos = EXCLUDED.max_nichos,
  preco_mensal = EXCLUDED.preco_mensal,
  updated_at = NOW();

INSERT INTO plataforma_config (chave, valor)
VALUES ('multiplicador_anual', '10'::jsonb)
ON CONFLICT (chave) DO UPDATE SET valor = '10'::jsonb, updated_at = NOW();

-- Normalizar faixas antigas nas empresas
UPDATE empresas SET quantidade_pontos = '11-50'
WHERE quantidade_pontos IN ('11-30', '11-50');
UPDATE empresas SET quantidade_pontos = '51-100'
WHERE quantidade_pontos IN ('31-60', '61-100', '51-100');
UPDATE empresas SET limite_pontos = 10 WHERE quantidade_pontos = '1-10';
UPDATE empresas SET limite_pontos = 50 WHERE quantidade_pontos = '11-50';
UPDATE empresas SET limite_pontos = 100 WHERE quantidade_pontos = '51-100';
UPDATE empresas SET limite_pontos = 9999 WHERE quantidade_pontos = '100+';
