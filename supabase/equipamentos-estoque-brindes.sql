-- Estoque de brindes alocado por máquina (ursinho)
ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS estoque_brindes JSONB DEFAULT '[]'::jsonb;
