-- Zera caixa, coletas, visitas e pendências da empresa — mantém pontos e equipamentos.
-- Rode no Supabase SQL Editor.

CREATE OR REPLACE FUNCTION zerar_dados_operacionais()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_empresa_id UUID;
  v_financeiro INT := 0;
  v_pendencias INT := 0;
  v_estoque_mov INT := 0;
  v_visitas INT := 0;
  v_coletas INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT e.id INTO v_empresa_id
  FROM empresas e
  WHERE e.id = get_user_empresa_id()
    AND (
      e.owner_id = v_user_id
      OR EXISTS (
        SELECT 1 FROM equipe eq
        WHERE eq.empresa_id = e.id
          AND eq.user_id = v_user_id
          AND eq.role IN ('admin', 'gerente')
          AND eq.status = 'ativo'
      )
    );

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM financeiro WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_financeiro = ROW_COUNT;

  DELETE FROM pendencias WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_pendencias = ROW_COUNT;

  DELETE FROM estoque_movimentacoes WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_estoque_mov = ROW_COUNT;

  DELETE FROM visitas WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_visitas = ROW_COUNT;

  DELETE FROM coletas WHERE empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_coletas = ROW_COUNT;

  UPDATE pontos SET ultima_coleta = NULL WHERE empresa_id = v_empresa_id;

  RETURN jsonb_build_object(
    'financeiro', v_financeiro,
    'pendencias', v_pendencias,
    'estoque_movimentacoes', v_estoque_mov,
    'visitas', v_visitas,
    'coletas', v_coletas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION zerar_dados_operacionais() TO authenticated;
