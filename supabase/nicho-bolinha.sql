-- Nicho Bolinha / Cápsula (venda: valor contado ÷ preço da jogada + estoque por máquina)
ALTER TYPE nicho_type ADD VALUE IF NOT EXISTS 'bolinha';
ALTER TYPE equipamento_tipo ADD VALUE IF NOT EXISTS 'bolinha';

ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS preco_jogada NUMERIC(12,2);

ALTER TABLE visita_ponto_itens DROP CONSTRAINT IF EXISTS visita_ponto_itens_nicho_check;
ALTER TABLE visita_ponto_itens
  ADD CONSTRAINT visita_ponto_itens_nicho_check
  CHECK (nicho IN ('cassino', 'fura_fura', 'ursinho', 'diversao', 'bolinha'));
