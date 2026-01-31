-- Add preferred_due_day column to leads table for pre-enrollment form
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS preferred_due_day integer;