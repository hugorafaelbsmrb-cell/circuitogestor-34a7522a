-- Add column to allow guardians to hide reports from their view in the portal
ALTER TABLE public.student_reports 
ADD COLUMN IF NOT EXISTS hidden_from_portal boolean DEFAULT false;

-- Add index for better performance when filtering hidden reports
CREATE INDEX IF NOT EXISTS idx_student_reports_hidden_from_portal 
ON public.student_reports(hidden_from_portal) 
WHERE hidden_from_portal = true;