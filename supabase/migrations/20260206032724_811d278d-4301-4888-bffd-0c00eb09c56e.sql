-- Add slug column to courses table for friendly URLs
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_courses_slug ON public.courses(slug);

-- Create table for course-specific landing page content
CREATE TABLE public.course_landing_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  hero_title text,
  hero_subtitle text,
  hero_image text,
  benefits jsonb DEFAULT '[]'::jsonb,
  gallery_images jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_course_landing UNIQUE (course_id)
);

-- Enable RLS
ALTER TABLE public.course_landing_pages ENABLE ROW LEVEL SECURITY;

-- RLS policies for course_landing_pages
CREATE POLICY "Public can view active course landing pages"
  ON public.course_landing_pages
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can view all course landing pages"
  ON public.course_landing_pages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert course landing pages"
  ON public.course_landing_pages
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update course landing pages"
  ON public.course_landing_pages
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete course landing pages"
  ON public.course_landing_pages
  FOR DELETE
  USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_course_landing_pages_updated_at
  BEFORE UPDATE ON public.course_landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();