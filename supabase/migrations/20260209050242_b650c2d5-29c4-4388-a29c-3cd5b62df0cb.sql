-- Add Meta Pixel ID column to course landing pages
ALTER TABLE public.course_landing_pages
ADD COLUMN IF NOT EXISTS meta_pixel_id text DEFAULT NULL;

COMMENT ON COLUMN public.course_landing_pages.meta_pixel_id IS 'Meta (Facebook) Pixel ID for tracking conversions on this landing page';