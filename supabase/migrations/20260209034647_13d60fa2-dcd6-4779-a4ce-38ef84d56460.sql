-- Add pricing features and original price columns to course_landing_pages
ALTER TABLE public.course_landing_pages
ADD COLUMN IF NOT EXISTS pricing_features jsonb DEFAULT '["Material didático incluso", "Certificado de conclusão", "Turmas reduzidas", "Acompanhamento individual"]'::jsonb,
ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT NULL;