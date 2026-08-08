-- Retenção configurável de mídia de coleta/relatório.
-- Coletas e valores NÃO são apagados — só arquivos pesados + linhas de relatorios_coleta.
-- retencao_midia_dias: 30 | 60 | 90 | 180 | 0 (0 = nunca apagar automaticamente). Padrão 90.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS retencao_midia_dias INTEGER NOT NULL DEFAULT 90;

COMMENT ON COLUMN empresas.retencao_midia_dias IS
  'Dias para manter fotos/relatórios. 0 = só exclusão manual. Padrão 90.';

GRANT SELECT, INSERT, DELETE ON relatorios_coleta TO authenticated;

DROP POLICY IF EXISTS "Empresa scoped delete" ON relatorios_coleta;
CREATE POLICY "Empresa scoped delete" ON relatorios_coleta
  FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id());

CREATE INDEX IF NOT EXISTS idx_relatorios_coleta_created
  ON relatorios_coleta (empresa_id, created_at);

CREATE INDEX IF NOT EXISTS idx_coletas_foto_created
  ON coletas (empresa_id, created_at)
  WHERE foto_url IS NOT NULL;
