-- Bolinha / cápsula: preço da jogada por máquina (venda)
-- Rode no Supabase SQL Editor

ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS preco_jogada NUMERIC(12,2);

COMMENT ON COLUMN equipamentos.preco_jogada IS
  'Valor da jogada em reais (ex.: 2.00). Na coleta: unidades = dinheiro_contado / preco_jogada';
