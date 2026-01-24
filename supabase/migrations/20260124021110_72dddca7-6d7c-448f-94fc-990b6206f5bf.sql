-- Create table to store Soroban credentials for students
CREATE TABLE public.soroban_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  matricula TEXT NOT NULL UNIQUE,
  soroban_user_id TEXT,
  current_level INTEGER DEFAULT 1,
  current_module TEXT,
  completion_percentage NUMERIC DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.soroban_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view soroban credentials"
ON public.soroban_credentials FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert soroban credentials"
ON public.soroban_credentials FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update soroban credentials"
ON public.soroban_credentials FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Only admins can delete soroban credentials"
ON public.soroban_credentials FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_soroban_credentials_updated_at
BEFORE UPDATE ON public.soroban_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();