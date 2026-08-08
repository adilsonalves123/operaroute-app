-- Número de série das máquinas (cassino) + snapshot nas coletas para histórico
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS numero_serie TEXT;

CREATE INDEX IF NOT EXISTS idx_equipamentos_empresa_numero_serie
  ON equipamentos (empresa_id, lower(trim(numero_serie)))
  WHERE numero_serie IS NOT NULL AND trim(numero_serie) <> '';

ALTER TABLE coletas ADD COLUMN IF NOT EXISTS equipamento_numero_serie TEXT;

CREATE INDEX IF NOT EXISTS idx_coletas_equipamento_numero_serie
  ON coletas (empresa_id, lower(trim(equipamento_numero_serie)))
  WHERE equipamento_numero_serie IS NOT NULL AND trim(equipamento_numero_serie) <> '';
