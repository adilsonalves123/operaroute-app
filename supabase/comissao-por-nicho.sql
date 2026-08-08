-- Comissão % por nicho (não mais um único % fixo no ponto)
-- Supabase → SQL Editor → Run

ALTER TABLE pontos
  ADD COLUMN IF NOT EXISTS comissao_por_nicho JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN pontos.comissao_por_nicho IS
  'Comissão % por nicho. Ex.: {"maquinas_cassino":30,"fura_fura":30}. Consignado NÃO usa % — é tabela do produto.';

-- Consignado = tabela (custo / valor final / repasse do produto)
ALTER TABLE pontos
  ADD COLUMN IF NOT EXISTS consignado_modo_comissao TEXT DEFAULT 'tabela';

UPDATE pontos
SET consignado_modo_comissao = 'tabela'
WHERE consignado_modo_comissao IS NULL
   OR consignado_modo_comissao = ''
   OR consignado_modo_comissao = 'percentual';

-- Migra o % antigo para os nichos de máquina/fura (consignado fica 0)
UPDATE pontos
SET comissao_por_nicho = jsonb_build_object(
  'maquinas_cassino', COALESCE(comissao_percentual, 0),
  'fura_fura', COALESCE(comissao_percentual, 0),
  'ursinho', COALESCE(comissao_percentual, 0),
  'diversao', COALESCE(comissao_percentual, 0),
  'bolinha', COALESCE(comissao_percentual, 0),
  'consignado', 0
)
WHERE comissao_por_nicho IS NULL
   OR comissao_por_nicho = '{}'::jsonb
   OR comissao_por_nicho = 'null'::jsonb;
