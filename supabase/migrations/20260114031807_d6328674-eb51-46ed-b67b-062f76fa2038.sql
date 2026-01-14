-- Add is_active column to students table
ALTER TABLE public.students 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Add index for filtering active students
CREATE INDEX idx_students_is_active ON public.students(is_active);