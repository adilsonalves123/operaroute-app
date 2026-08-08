-- Universidade OperaRoute — aulas editáveis pelo painel do dono
-- Rode no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS plataforma_universidade_aulas (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  modulo TEXT NOT NULL DEFAULT 'comecar',
  duracao TEXT NOT NULL DEFAULT '',
  youtube_id TEXT,
  publicado BOOLEAN NOT NULL DEFAULT FALSE,
  ordem INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plataforma_uni_aulas_ordem
  ON plataforma_universidade_aulas (ordem ASC);

ALTER TABLE plataforma_universidade_aulas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all authenticated uni_aulas" ON plataforma_universidade_aulas;
CREATE POLICY "Deny all authenticated uni_aulas" ON plataforma_universidade_aulas
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT ALL ON plataforma_universidade_aulas TO service_role;

-- Seed inicial (só insere se ainda não existir)
INSERT INTO plataforma_universidade_aulas
  (id, titulo, descricao, modulo, duracao, youtube_id, publicado, ordem, updated_at)
VALUES
  ('tour-5min', 'Tour rápido do OperaRoute', 'Dashboard, menu e o fluxo do dia a dia em poucos minutos.', 'comecar', '6 min', NULL, true, 1, NOW()),
  ('primeiro-acesso', 'Primeiro acesso e configuração', 'Pesquisa, nichos, trial de 7 dias e o que ajustar nas configurações.', 'comecar', '8 min', NULL, true, 2, NOW()),
  ('cadastrar-ponto', 'Cadastrar pontos e clientes', 'Criar ponto, endereço, contato e vincular o nicho certo.', 'pontos', '10 min', NULL, true, 3, NOW()),
  ('maquinas', 'Máquinas e equipamentos', 'Alocar máquina no ponto, identificação e transferência.', 'pontos', '9 min', NULL, true, 4, NOW()),
  ('coleta-geral', 'Como fazer uma coleta', 'Do ponto até o resumo: valores, fotos e o que vai para o financeiro.', 'coletas', '12 min', NULL, true, 5, NOW()),
  ('coleta-fura', 'Coleta Fura Fura', 'Passo a passo específico do módulo Fura Fura.', 'nichos', '8 min', NULL, true, 6, NOW()),
  ('coleta-diversao', 'Coleta Diversão', 'Passo a passo do módulo Diversão.', 'nichos', '8 min', NULL, true, 7, NOW()),
  ('coleta-cassino', 'Visita e cassino', 'Operação de máquinas / cassino, comissão e abatimentos.', 'nichos', '10 min', NULL, true, 8, NOW()),
  ('financeiro-basico', 'Entendendo o financeiro', 'A receber, haver, lucro e como ler o mês.', 'financeiro', '11 min', NULL, true, 9, NOW()),
  ('baixas', 'Baixas e recebimentos', 'Registrar pagamento, PIX/dinheiro e limpar pendências.', 'financeiro', '7 min', NULL, true, 10, NOW()),
  ('equipe', 'Equipe e permissões', 'Convidar operador/gerente, login e o que cada um pode ver.', 'equipe', '9 min', NULL, true, 11, NOW()),
  ('rotas', 'Montar e executar rotas', 'Montar o percurso do dia, atribuir e acompanhar no app.', 'rotas', '8 min', NULL, true, 12, NOW()),
  ('planos-nichos', 'Planos, pontos e nichos', 'Régua de capacidade, limite de nichos e quando fazer upgrade.', 'planos', '7 min', NULL, true, 13, NOW())
ON CONFLICT (id) DO NOTHING;
