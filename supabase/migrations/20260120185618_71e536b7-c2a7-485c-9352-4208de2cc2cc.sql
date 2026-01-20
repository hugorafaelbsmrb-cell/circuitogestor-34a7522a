-- Add contract duration column to courses table
ALTER TABLE public.courses 
ADD COLUMN contract_duration_months integer DEFAULT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN public.courses.contract_duration_months IS 'Contract duration in months: 6, 12, 18, or NULL for indefinite';