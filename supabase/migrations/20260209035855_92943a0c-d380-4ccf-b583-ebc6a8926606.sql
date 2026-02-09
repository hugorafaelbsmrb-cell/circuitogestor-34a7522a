-- Add hero trust indicators column
ALTER TABLE public.course_landing_pages
ADD COLUMN IF NOT EXISTS hero_trust_indicators jsonb DEFAULT '["Sem taxas ocultas", "Primeira semana grátis", "Cancele quando quiser"]'::jsonb;