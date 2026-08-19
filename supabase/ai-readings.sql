CREATE TABLE IF NOT EXISTS ai_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  equipamento_id uuid NULL REFERENCES equipamentos(id) ON DELETE SET NULL,
  ponto_id uuid NULL REFERENCES pontos(id) ON DELETE SET NULL,
  operador_id uuid NULL REFERENCES profiles(user_id) ON DELETE SET NULL,
  visita_id uuid NULL REFERENCES visitas(id) ON DELETE SET NULL,
  coleta_id uuid NULL REFERENCES coletas(id) ON DELETE SET NULL,
  entrada_anterior bigint NULL,
  saida_anterior bigint NULL,
  entrada_sugerida bigint NULL,
  saida_sugerida bigint NULL,
  entrada_final bigint NULL,
  saida_final bigint NULL,
  confidence numeric(6,5) NULL,
  score integer NULL,
  status text NOT NULL DEFAULT 'processing',
  final_status text NULL,
  flags jsonb NULL DEFAULT '[]'::jsonb,
  avisos jsonb NULL DEFAULT '[]'::jsonb,
  motivo_recusa text NULL,
  modelos jsonb NULL DEFAULT '[]'::jsonb,
  divergencia_digitos jsonb NULL,
  historico_resumo jsonb NULL,
  usando_recortes boolean NOT NULL DEFAULT false,
  alternativas jsonb NULL,
  corrected_by uuid NULL REFERENCES profiles(user_id) ON DELETE SET NULL,
  imagem_nome text NULL,
  imagem_tipo text NULL,
  imagem_tamanho bigint NULL,
  finalized_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_readings_status_check CHECK (
    status IN ('processing', 'approved_ai', 'needs_review', 'approved_manual', 'rejected', 'error')
  ),
  CONSTRAINT ai_readings_final_status_check CHECK (
    final_status IS NULL OR final_status IN ('approved_ai', 'approved_manual', 'rejected', 'error')
  )
);

CREATE INDEX IF NOT EXISTS idx_ai_readings_empresa_created
  ON ai_readings (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_readings_equipamento_created
  ON ai_readings (empresa_id, equipamento_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_readings_status
  ON ai_readings (empresa_id, status, created_at DESC);

ALTER TABLE ai_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa scoped select" ON ai_readings;
DROP POLICY IF EXISTS "Empresa scoped insert" ON ai_readings;
DROP POLICY IF EXISTS "Empresa scoped update" ON ai_readings;

CREATE POLICY "Empresa scoped select" ON ai_readings
  FOR SELECT USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped insert" ON ai_readings
  FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Empresa scoped update" ON ai_readings
  FOR UPDATE USING (empresa_id = get_user_empresa_id())
  WITH CHECK (empresa_id = get_user_empresa_id());

GRANT SELECT, INSERT, UPDATE ON ai_readings TO authenticated;
