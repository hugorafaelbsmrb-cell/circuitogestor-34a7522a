-- Add columns for completed lessons tracking
ALTER TABLE public.lms_credentials 
ADD COLUMN IF NOT EXISTS completed_lessons integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_lessons integer DEFAULT 110;