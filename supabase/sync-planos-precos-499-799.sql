-- Alinha preços do catálogo: Pro R$ 499 · Elite R$ 799
-- (A página /planos lê deste tabela, não só do código.)

UPDATE plataforma_planos_catalogo SET
  descricao = 'De 1 a 10 pontos, até 10 equipamentos, painel simples.',
  preco_mensal = 99.90,
  updated_at = NOW()
WHERE id = 'start';

UPDATE plataforma_planos_catalogo SET
  descricao = 'De 11 a 50 pontos, até 50 equipamentos, operação em crescimento.',
  preco_mensal = 259.90,
  updated_at = NOW()
WHERE id = 'growth';

UPDATE plataforma_planos_catalogo SET
  descricao = 'De 51 a 100 pontos, escala com Inteligência Artificial.',
  preco_mensal = 499.00,
  updated_at = NOW()
WHERE id = 'pro';

UPDATE plataforma_planos_catalogo SET
  descricao = 'Pontos e nichos ilimitados — o plano mais completo.',
  preco_mensal = 799.00,
  updated_at = NOW()
WHERE id = 'elite';
