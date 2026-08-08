-- Suporte OperaRoute: cliente fala com IA; se precisar, escala para staff da plataforma.
-- Rode no Supabase SQL Editor.

DO $$ BEGIN
  CREATE TYPE suporte_modo AS ENUM ('ia', 'humano', 'resolvido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE suporte_autor AS ENUM ('cliente', 'ia', 'staff', 'sistema');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS suporte_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_nome TEXT,
  user_email TEXT,
  empresa_nome TEXT,
  assunto TEXT,
  modo suporte_modo NOT NULL DEFAULT 'ia',
  prioridade TEXT NOT NULL DEFAULT 'normal',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS suporte_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES suporte_conversas(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  autor suporte_autor NOT NULL,
  autor_id UUID,
  autor_nome TEXT,
  corpo TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suporte_conversas_empresa
  ON suporte_conversas(empresa_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_suporte_conversas_modo
  ON suporte_conversas(modo, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_suporte_conversas_user
  ON suporte_conversas(user_id, modo);
CREATE INDEX IF NOT EXISTS idx_suporte_mensagens_conversa
  ON suporte_mensagens(conversa_id, created_at ASC);

ALTER TABLE suporte_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE suporte_mensagens ENABLE ROW LEVEL SECURITY;

-- Anexos (também em suporte-anexos.sql se a tabela já existir)
ALTER TABLE suporte_mensagens
  ADD COLUMN IF NOT EXISTS anexo_url TEXT,
  ADD COLUMN IF NOT EXISTS anexo_nome TEXT,
  ADD COLUMN IF NOT EXISTS anexo_mime TEXT,
  ADD COLUMN IF NOT EXISTS anexo_tamanho INTEGER;

DROP POLICY IF EXISTS "Empresa scoped select" ON suporte_conversas;
DROP POLICY IF EXISTS "Empresa scoped insert" ON suporte_conversas;
DROP POLICY IF EXISTS "Empresa scoped update" ON suporte_conversas;

CREATE POLICY "Empresa scoped select" ON suporte_conversas
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON suporte_conversas
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped update" ON suporte_conversas
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id());

DROP POLICY IF EXISTS "Empresa scoped select" ON suporte_mensagens;
DROP POLICY IF EXISTS "Empresa scoped insert" ON suporte_mensagens;

CREATE POLICY "Empresa scoped select" ON suporte_mensagens
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Empresa scoped insert" ON suporte_mensagens
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE ON suporte_conversas TO authenticated;
GRANT SELECT, INSERT ON suporte_mensagens TO authenticated;

-- Painel do dono / APIs admin (service_role)
GRANT ALL ON suporte_conversas TO service_role;
GRANT ALL ON suporte_mensagens TO service_role;
