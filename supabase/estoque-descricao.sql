-- Descrição curta do item de estoque (ex.: nome "Cabo de carregamento", descrição "Tipo C")
ALTER TABLE estoque
  ADD COLUMN IF NOT EXISTS descricao TEXT;

COMMENT ON COLUMN estoque.descricao IS 'Detalhe do item (ex.: Tipo C, 2 metros, vermelho)';
