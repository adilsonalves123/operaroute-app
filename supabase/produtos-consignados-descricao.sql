-- Descrição curta do produto consignado (ex.: nome "Fonte 20W", descrição "entrada 110/220")
ALTER TABLE produtos_consignados
  ADD COLUMN IF NOT EXISTS descricao TEXT;

COMMENT ON COLUMN produtos_consignados.descricao IS 'Detalhe do produto (ex.: Tipo C, 50g, sabor)';
