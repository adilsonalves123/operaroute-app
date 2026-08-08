-- Estoque central de equipamentos: ponto_id pode ser NULL (não alocado)
-- Rode no Supabase SQL Editor

-- 1) Remove NOT NULL de ponto_id
ALTER TABLE equipamentos
  ALTER COLUMN ponto_id DROP NOT NULL;

-- 2) Troca CASCADE por SET NULL: ao excluir ponto, equipamento volta ao estoque
ALTER TABLE equipamentos
  DROP CONSTRAINT IF EXISTS equipamentos_ponto_id_fkey;

ALTER TABLE equipamentos
  ADD CONSTRAINT equipamentos_ponto_id_fkey
  FOREIGN KEY (ponto_id) REFERENCES pontos(id) ON DELETE SET NULL;

-- 3) Índice parcial: equipamentos em estoque
CREATE INDEX IF NOT EXISTS idx_equipamentos_estoque
  ON equipamentos(empresa_id)
  WHERE ponto_id IS NULL;

COMMENT ON COLUMN equipamentos.ponto_id IS
  'NULL = equipamento no estoque central (ainda não alocado a um ponto)';
