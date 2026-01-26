-- Add course_id column to teachers table for direct course association
ALTER TABLE public.teachers 
ADD COLUMN course_id UUID REFERENCES public.courses(id);

-- Create index for better query performance
CREATE INDEX idx_teachers_course_id ON public.teachers(course_id);

-- Add comment for documentation
COMMENT ON COLUMN public.teachers.course_id IS 'Direct association with the course the teacher is responsible for';