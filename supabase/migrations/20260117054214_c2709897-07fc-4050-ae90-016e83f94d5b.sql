-- Create table to store LMS credentials for students
CREATE TABLE public.lms_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  matricula TEXT NOT NULL,
  lms_user_id TEXT,
  current_module TEXT,
  current_level TEXT,
  current_lesson TEXT,
  completion_percentage NUMERIC DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, enrollment_id)
);

-- Enable RLS
ALTER TABLE public.lms_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view lms_credentials" 
ON public.lms_credentials 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert lms_credentials" 
ON public.lms_credentials 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update lms_credentials" 
ON public.lms_credentials 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete lms_credentials" 
ON public.lms_credentials 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_lms_credentials_updated_at
BEFORE UPDATE ON public.lms_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_lms_credentials_student_id ON public.lms_credentials(student_id);
CREATE INDEX idx_lms_credentials_enrollment_id ON public.lms_credentials(enrollment_id);