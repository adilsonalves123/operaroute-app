-- Libera AVIF no bucket coleta-fotos (fotos do estoque / equipamento)
-- Rode no Supabase SQL Editor se quiser aceitar AVIF sem conversão no app

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/avif'
]
WHERE id = 'coleta-fotos';
