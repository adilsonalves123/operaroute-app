-- Nicho Máquina de Ursinho (plano + equipamentos)
ALTER TYPE nicho_type ADD VALUE IF NOT EXISTS 'ursinho';
ALTER TYPE equipamento_tipo ADD VALUE IF NOT EXISTS 'ursinho';

-- vending_ursinho permanece só como tipo de equipamento legado (equipamento_tipo),
-- não é nicho contratável em /planos — use o nicho "ursinho".
