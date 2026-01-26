-- Add teacher_id column to students table for direct teacher-student linking
ALTER TABLE public.students 
ADD COLUMN teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_students_teacher_id ON public.students(teacher_id);

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.students.teacher_id IS 'Professor vinculado ao aluno para envio de lições de casa e comunicações';