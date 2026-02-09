-- Add hero urgency text and social proof count to course_landing_pages
ALTER TABLE public.course_landing_pages
ADD COLUMN IF NOT EXISTS hero_urgency_text text DEFAULT 'Vagas Limitadas!',
ADD COLUMN IF NOT EXISTS hero_social_proof_count integer DEFAULT 150;