-- Adiciona coluna numero_maquina (número da máquina separado do nome)
-- Rode no Supabase → SQL Editor → New query → Run

ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS numero_maquina TEXT;

-- Após rodar, aguarde ~10s ou recarregue o schema cache do PostgREST
-- (no Supabase isso costuma atualizar sozinho)
