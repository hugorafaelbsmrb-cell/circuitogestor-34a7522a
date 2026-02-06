-- Add custom price to course landing pages (independent from course price)
ALTER TABLE public.course_landing_pages
ADD COLUMN custom_price numeric NULL,
ADD COLUMN custom_duration text NULL,
ADD COLUMN custom_name text NULL,
ADD COLUMN custom_description text NULL;