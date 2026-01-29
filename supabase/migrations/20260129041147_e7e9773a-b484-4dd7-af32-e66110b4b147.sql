-- Add images column to student_reports table
-- Stores array of Google Drive image URLs
ALTER TABLE public.student_reports 
ADD COLUMN images text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.student_reports.images IS 'Array of Google Drive image URLs for activity photos';