-- Add sex column to students table
ALTER TABLE public.students 
ADD COLUMN sex text DEFAULT 'M' CHECK (sex IN ('M', 'F'));