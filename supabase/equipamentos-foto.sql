-- Foto de referência da máquina (identificação na coleta)
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS foto_url TEXT;
