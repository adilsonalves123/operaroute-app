-- OperaRoute Database Schema
-- Execute no SQL Editor do Supabase

-- Enums
CREATE TYPE nicho_type AS ENUM ('fura_fura', 'maquinas_cassino', 'outros');
CREATE TYPE plano_type AS ENUM ('start', 'pro', 'elite');
CREATE TYPE user_role AS ENUM ('admin', 'gerente', 'operador', 'visualizador');
CREATE TYPE ponto_status AS ENUM ('ativo', 'pausado', 'retirado', 'inadimplente');
CREATE TYPE pendencia_prioridade AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE pendencia_status AS ENUM ('aberta', 'em_andamento', 'resolvida');
CREATE TYPE financeiro_tipo AS ENUM ('entrada', 'saida');
CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'pix', 'misto');

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT NOT NULL,
  onboarding_completo BOOLEAN DEFAULT FALSE,
  nicho nicho_type,
  nome_operacao TEXT,
  empresa_id UUID,
  plano plano_type DEFAULT 'start',
  trial_inicio TIMESTAMPTZ,
  trial_fim TIMESTAMPTZ,
  assinatura_ativa BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Empresas
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome_operacao TEXT NOT NULL,
  nicho nicho_type NOT NULL DEFAULT 'outros',
  quantidade_pontos TEXT,
  possui_funcionarios BOOLEAN DEFAULT FALSE,
  objetivo_principal TEXT,
  plano plano_type DEFAULT 'start',
  status TEXT DEFAULT 'ativo',
  limite_pontos INTEGER DEFAULT 20,
  limite_usuarios INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_empresa
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL;

-- Pontos
CREATE TABLE pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  responsavel TEXT,
  whatsapp TEXT,
  cidade TEXT,
  bairro TEXT,
  endereco TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  tipo_ponto TEXT,
  status ponto_status DEFAULT 'ativo',
  comissao_percentual NUMERIC(5,2) DEFAULT 0,
  operador_id UUID,
  observacoes TEXT,
  foto_url TEXT,
  ultima_coleta TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coletas
CREATE TABLE coletas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  ponto_id UUID REFERENCES pontos(id) ON DELETE CASCADE NOT NULL,
  operador_id UUID,
  valor_bruto NUMERIC(12,2) DEFAULT 0,
  comissao_percentual NUMERIC(5,2) DEFAULT 0,
  valor_comissao NUMERIC(12,2) DEFAULT 0,
  valor_liquido NUMERIC(12,2) DEFAULT 0,
  valor_pago_ponto NUMERIC(12,2),
  quantidade_furos INTEGER,
  brindes_repostos INTEGER,
  brindes_restantes INTEGER,
  entrada NUMERIC(12,2),
  saida NUMERIC(12,2),
  forma_pagamento forma_pagamento DEFAULT 'dinheiro',
  foto_url TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financeiro
CREATE TABLE financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  tipo financeiro_tipo NOT NULL,
  categoria TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  descricao TEXT,
  forma_pagamento forma_pagamento,
  ponto_id UUID REFERENCES pontos(id) ON DELETE SET NULL,
  coleta_id UUID REFERENCES coletas(id) ON DELETE SET NULL,
  operador_id UUID,
  data DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pendencias
CREATE TABLE pendencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  ponto_id UUID REFERENCES pontos(id) ON DELETE SET NULL,
  responsavel_id UUID,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(12,2),
  prioridade pendencia_prioridade DEFAULT 'media',
  status pendencia_status DEFAULT 'aberta',
  data_limite DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estoque
CREATE TABLE estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  nome_item TEXT NOT NULL,
  categoria TEXT,
  custo_unitario NUMERIC(12,2) DEFAULT 0,
  quantidade INTEGER DEFAULT 0,
  quantidade_minima INTEGER DEFAULT 0,
  foto_url TEXT,
  fornecedor TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estoque movimentacoes
CREATE TABLE estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES estoque(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  ponto_id UUID REFERENCES pontos(id) ON DELETE SET NULL,
  coleta_id UUID REFERENCES coletas(id) ON DELETE SET NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipe
CREATE TABLE equipe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  role user_role DEFAULT 'operador',
  comissao_percentual NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rotas
CREATE TABLE rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  operador_id UUID,
  cidade TEXT,
  bairro TEXT,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rota pontos
CREATE TABLE rota_pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID REFERENCES rotas(id) ON DELETE CASCADE NOT NULL,
  ponto_id UUID REFERENCES pontos(id) ON DELETE CASCADE NOT NULL,
  ordem INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pendente',
  observacao TEXT
);

-- Auditoria
CREATE TABLE auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  tabela TEXT NOT NULL,
  registro_id UUID,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper: get user's empresa_id
CREATE OR REPLACE FUNCTION get_user_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE coletas ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rota_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (user_id = auth.uid());

-- Empresas policies
CREATE POLICY "Users can view own empresa" ON empresas FOR SELECT USING (owner_id = auth.uid() OR id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa" ON empresas FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can update empresa" ON empresas FOR UPDATE USING (owner_id = auth.uid());

-- Generic empresa-scoped policies
CREATE POLICY "Empresa scoped select" ON pontos FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON pontos FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON pontos FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON pontos FOR DELETE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped select" ON coletas FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON coletas FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON coletas FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON coletas FOR DELETE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped select" ON financeiro FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON financeiro FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON financeiro FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON financeiro FOR DELETE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped select" ON pendencias FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON pendencias FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON pendencias FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON pendencias FOR DELETE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped select" ON estoque FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON estoque FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON estoque FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON estoque FOR DELETE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped select" ON estoque_movimentacoes FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON estoque_movimentacoes FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped select" ON equipe FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON equipe FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON equipe FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON equipe FOR DELETE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped select" ON rotas FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON rotas FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON rotas FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped delete" ON rotas FOR DELETE USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Rota pontos via rota" ON rota_pontos FOR SELECT USING (
  EXISTS (SELECT 1 FROM rotas WHERE rotas.id = rota_pontos.rota_id AND rotas.empresa_id = get_user_empresa_id())
);
CREATE POLICY "Rota pontos insert" ON rota_pontos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM rotas WHERE rotas.id = rota_pontos.rota_id AND rotas.empresa_id = get_user_empresa_id())
);
CREATE POLICY "Rota pontos update" ON rota_pontos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM rotas WHERE rotas.id = rota_pontos.rota_id AND rotas.empresa_id = get_user_empresa_id())
);

CREATE POLICY "Empresa scoped select" ON auditoria FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON auditoria FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, nome, email, trial_inicio, trial_fim, assinatura_ativa)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    NOW(),
    NOW() + INTERVAL '7 days',
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Indexes
CREATE INDEX idx_pontos_empresa ON pontos(empresa_id);
CREATE INDEX idx_coletas_empresa ON coletas(empresa_id);
CREATE INDEX idx_coletas_ponto ON coletas(ponto_id);
CREATE INDEX idx_financeiro_empresa ON financeiro(empresa_id);
CREATE INDEX idx_pendencias_empresa ON pendencias(empresa_id);
CREATE INDEX idx_profiles_user ON profiles(user_id);

-- Permissões (necessário ao rodar schema via SQL Editor)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated, anon;
