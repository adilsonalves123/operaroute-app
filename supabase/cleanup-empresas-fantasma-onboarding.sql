-- PASSO 1 de 2 — SÓ CONFERE, NÃO APAGA NADA.
-- Empresas fantasma = empresas criadas por retries do onboarding que não são a
-- empresa ligada ao perfil do dono (profiles.empresa_id).
-- Supabase → SQL Editor → colar tudo → Run. Pode rodar quantas vezes quiser.
--
-- A coluna "dados" conta tudo que aponta para a empresa (qualquer tabela com
-- chave para empresas), ignorando o que o próprio onboarding cria sozinho:
-- nichos e a linha do dono na equipe.
--   APAGAR (vazia)      → nada de uso real; o passo 2 apaga.
--   MANTER (tem dados)  → o passo 2 não toca. Olhe com calma.
-- ativa_tem_pontos = false numa linha MANTER quer dizer que o cliente usou a
-- empresa "errada": a ativa está vazia e os dados estão nesta. Não apague; me chame.
--
-- Donos sem empresa ligada no perfil não entram aqui (o onboarding liga sozinho).

DROP TABLE IF EXISTS pg_temp.fantasma_analise;

CREATE TEMP TABLE fantasma_analise AS
SELECT
  e.id,
  e.nome_operacao,
  e.owner_id,
  e.created_at,
  p.email AS dono_email,
  p.empresa_id AS empresa_ativa_id,
  '{}'::jsonb AS dados
FROM empresas e
JOIN profiles p ON p.user_id = e.owner_id
WHERE p.empresa_id IS NOT NULL
  AND e.id <> p.empresa_id;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tabela, a.attname AS coluna
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.empresas'::regclass
      AND cardinality(c.conkey) = 1
  LOOP
    CONTINUE WHEN r.tabela::text IN ('empresa_nichos', 'public.empresa_nichos');
    EXECUTE format(
      'UPDATE pg_temp.fantasma_analise f
          SET dados = f.dados || jsonb_build_object(%L, x.n)
         FROM (
           SELECT t.%I AS eid, count(*) AS n
             FROM %s t
             JOIN pg_temp.fantasma_analise g ON g.id = t.%I
            WHERE %s
            GROUP BY 1
         ) x
        WHERE x.eid = f.id',
      r.tabela::text || '.' || r.coluna,
      r.coluna,
      r.tabela,
      r.coluna,
      CASE
        WHEN r.tabela::text IN ('equipe', 'public.equipe')
          THEN 't.user_id IS DISTINCT FROM g.owner_id'
        ELSE 'true'
      END
    );
  END LOOP;
END $$;

SELECT
  CASE WHEN f.dados = '{}'::jsonb THEN 'APAGAR (vazia)' ELSE 'MANTER (tem dados)' END AS situacao,
  f.dono_email,
  f.nome_operacao,
  f.created_at,
  f.dados,
  EXISTS (SELECT 1 FROM pontos po WHERE po.empresa_id = f.empresa_ativa_id) AS ativa_tem_pontos,
  f.id AS empresa_id,
  f.empresa_ativa_id
FROM fantasma_analise f
ORDER BY situacao, f.dono_email, f.created_at DESC;
