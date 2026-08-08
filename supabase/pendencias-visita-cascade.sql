-- Pendência criada pela visita some junto com a visita (não fica órfã com visita_id NULL).
-- Antes: ON DELETE SET NULL — apagar a coleta deixava a dívida "cliente deve" no ar.

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'pendencias'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'visita_id'
    AND ccu.table_name = 'visitas'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pendencias DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.pendencias
  ADD CONSTRAINT pendencias_visita_id_fkey
  FOREIGN KEY (visita_id) REFERENCES public.visitas(id) ON DELETE CASCADE;
