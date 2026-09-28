-- PASSO 2 de 2 — APAGA as empresas fantasma VAZIAS.
-- Rode só depois de conferir o passo 1 (cleanup-empresas-fantasma-onboarding.sql).
-- Supabase → SQL Editor → colar tudo → Run.
--
-- Refaz a mesma análise do passo 1 e apaga apenas as linhas "APAGAR (vazia)".
-- Antes de apagar, guarda cada empresa em backup_empresas_fantasma (linha
-- completa + nichos). Tudo roda numa transação: se algo falhar, nada é apagado.

BEGIN;

DROP TABLE IF EXISTS pg_temp.fantasma_analise;

CREATE TEMP TABLE fantasma_analise AS
SELECT
  e.id,
  e.owner_id,
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

CREATE TABLE IF NOT EXISTS public.backup_empresas_fantasma (
  id UUID PRIMARY KEY,
  owner_id UUID,
  dono_email TEXT,
  empresa_ativa_id UUID,
  linha JSONB NOT NULL,
  nichos JSONB,
  apagada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Tabela no schema public: sem RLS o app conseguiria ler pela API.
ALTER TABLE public.backup_empresas_fantasma ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_empresas_fantasma FROM anon, authenticated;

INSERT INTO public.backup_empresas_fantasma
  (id, owner_id, dono_email, empresa_ativa_id, linha, nichos)
SELECT
  e.id,
  e.owner_id,
  f.dono_email,
  f.empresa_ativa_id,
  to_jsonb(e),
  (SELECT jsonb_agg(n.nicho) FROM empresa_nichos n WHERE n.empresa_id = e.id)
FROM empresas e
JOIN fantasma_analise f ON f.id = e.id
WHERE f.dados = '{}'::jsonb
ON CONFLICT (id) DO NOTHING;

DELETE FROM empresas e
USING fantasma_analise f
WHERE f.id = e.id
  AND f.dados = '{}'::jsonb;

COMMIT;

SELECT
  count(*) FILTER (WHERE apagada_em >= NOW() - INTERVAL '10 minutes') AS apagadas_agora,
  count(*) AS total_no_backup
FROM public.backup_empresas_fantasma;
