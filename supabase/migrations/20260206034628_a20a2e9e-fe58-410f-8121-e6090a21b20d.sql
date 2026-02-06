-- Add testimonials column to course_landing_pages
ALTER TABLE public.course_landing_pages
ADD COLUMN testimonials jsonb NULL DEFAULT '[]'::jsonb;