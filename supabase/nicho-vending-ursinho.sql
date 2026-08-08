-- Separa ursinho/vending como nicho próprio (entrada só — lógica distinta do cassino)
ALTER TYPE nicho_type ADD VALUE IF NOT EXISTS 'vending_ursinho';

-- Empresas que já tinham cassino continuam só com cassino; ursinho é contratado em /planos
