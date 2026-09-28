-- Envio de coleta com código único (sem duplicata em reenvio) + fila offline.
-- Rode no Supabase SQL Editor.
--
-- Cada envio de coleta do celular leva um código (x-envio-id). Se o mesmo código
-- chegar de novo (sinal caiu, operador tocou 2x, fila offline reenviou), o servidor
-- devolve a resposta já gravada em vez de lançar a coleta outra vez.

CREATE TABLE IF NOT EXISTS coleta_envios (
  id UUID PRIMARY KEY,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rota TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processando'
    CHECK (status IN ('processando', 'ok', 'erro')),
  http_status INTEGER,
  resposta JSONB,
  -- Enviada pela fila offline (feita sem sinal, sincronizada depois).
  offline BOOLEAN NOT NULL DEFAULT FALSE,
  coletado_em TIMESTAMPTZ,
  -- Valor que o operador viu na tela x valor recalculado no envio.
  previsto_total NUMERIC(12,2),
  gravado_total NUMERIC(12,2),
  revisar BOOLEAN NOT NULL DEFAULT FALSE,
  revisar_motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coleta_envios_empresa_revisar
  ON coleta_envios(empresa_id, revisar, created_at DESC);

-- Só o servidor (service role) lê e grava.
ALTER TABLE coleta_envios ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE coleta_envios IS
  'Registro de envios de coleta por código único (idempotência) e coletas feitas offline.';
