-- Nicho Diversão: sinuca, fliperama, cadeira de massagem e outros (só entrada, sem brinde)
ALTER TYPE nicho_type ADD VALUE IF NOT EXISTS 'diversao';

ALTER TYPE equipamento_tipo ADD VALUE IF NOT EXISTS 'diversao';
ALTER TYPE equipamento_tipo ADD VALUE IF NOT EXISTS 'sinuca';
ALTER TYPE equipamento_tipo ADD VALUE IF NOT EXISTS 'fliperama';
ALTER TYPE equipamento_tipo ADD VALUE IF NOT EXISTS 'cadeira_massagem';

-- Visita ao ponto: permitir item do nicho diversao
ALTER TABLE visita_ponto_itens DROP CONSTRAINT IF EXISTS visita_ponto_itens_nicho_check;
ALTER TABLE visita_ponto_itens
  ADD CONSTRAINT visita_ponto_itens_nicho_check
  CHECK (nicho IN ('cassino', 'fura_fura', 'ursinho', 'diversao'));
