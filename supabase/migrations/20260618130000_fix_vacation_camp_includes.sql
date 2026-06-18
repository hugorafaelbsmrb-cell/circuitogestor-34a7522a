-- Adiciona coluna 'includes' na tabela vacation_camp_packages
-- (caso a tabela tenha sido criada sem essa coluna via SQL Editor)
ALTER TABLE public.vacation_camp_packages 
ADD COLUMN IF NOT EXISTS includes JSONB DEFAULT '[]'::jsonb;
