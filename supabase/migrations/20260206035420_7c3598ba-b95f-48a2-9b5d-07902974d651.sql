-- Add urgency banner and floating CTA customization fields
ALTER TABLE public.course_landing_pages
ADD COLUMN urgency_banner_message text NULL,
ADD COLUMN urgency_banner_variant text NULL DEFAULT 'warning',
ADD COLUMN floating_cta_text text NULL DEFAULT 'Quero me matricular!',
ADD COLUMN floating_cta_enabled boolean NULL DEFAULT true;