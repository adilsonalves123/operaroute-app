-- Aumenta limite de colaboradores (gerentes/operadores) para operações existentes
-- Rode no SQL Editor do Supabase

UPDATE empresas
SET limite_usuarios = 10
WHERE limite_usuarios IS NULL OR limite_usuarios < 10;
