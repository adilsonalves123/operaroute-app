-- Afiliados / parceiros que vendem o SaaS OperaRoute
-- Rode no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS plataforma_afiliados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  whatsapp TEXT,
  -- percentual: comissao_valor = % (ex. 20) | fixo: valor em R$ (ex. 50)
  comissao_tipo TEXT NOT NULL DEFAULT 'percentual'
    CHECK (comissao_tipo IN ('percentual', 'fixo')),
  comissao_valor NUMERIC(12, 2) NOT NULL DEFAULT 20,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plataforma_afiliados_codigo
  ON plataforma_afiliados (codigo);

CREATE TABLE IF NOT EXISTS plataforma_afiliado_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id UUID NOT NULL REFERENCES plataforma_afiliados(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('click', 'cadastro', 'conversao')),
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_afiliado_eventos_afiliado
  ON plataforma_afiliado_eventos (afiliado_id, created_at DESC);

CREATE TABLE IF NOT EXISTS plataforma_afiliado_comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id UUID NOT NULL REFERENCES plataforma_afiliados(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  empresa_nome TEXT,
  valor_centavos INTEGER NOT NULL DEFAULT 0,
  base_centavos INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'pago', 'cancelado')),
  referencia TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pago_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_afiliado_comissoes_afiliado
  ON plataforma_afiliado_comissoes (afiliado_id, created_at DESC);

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS afiliado_id UUID REFERENCES plataforma_afiliados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS afiliado_codigo TEXT,
  ADD COLUMN IF NOT EXISTS afiliado_atribuido_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_empresas_afiliado
  ON empresas (afiliado_id)
  WHERE afiliado_id IS NOT NULL;

ALTER TABLE plataforma_afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE plataforma_afiliado_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE plataforma_afiliado_comissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all authenticated afiliados" ON plataforma_afiliados;
CREATE POLICY "Deny all authenticated afiliados" ON plataforma_afiliados
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all authenticated afiliado_eventos" ON plataforma_afiliado_eventos;
CREATE POLICY "Deny all authenticated afiliado_eventos" ON plataforma_afiliado_eventos
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all authenticated afiliado_comissoes" ON plataforma_afiliado_comissoes;
CREATE POLICY "Deny all authenticated afiliado_comissoes" ON plataforma_afiliado_comissoes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT ALL ON plataforma_afiliados TO service_role;
GRANT ALL ON plataforma_afiliado_eventos TO service_role;
GRANT ALL ON plataforma_afiliado_comissoes TO service_role;
