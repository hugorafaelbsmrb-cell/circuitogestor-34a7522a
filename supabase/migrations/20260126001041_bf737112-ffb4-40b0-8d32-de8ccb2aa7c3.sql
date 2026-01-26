-- Create teacher_credentials table for teacher authentication
CREATE TABLE public.teacher_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  matricula VARCHAR(50) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teacher_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view teacher credentials"
  ON public.teacher_credentials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert teacher credentials"
  ON public.teacher_credentials FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update teacher credentials"
  ON public.teacher_credentials FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can delete teacher credentials"
  ON public.teacher_credentials FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_teacher_credentials_updated_at
  BEFORE UPDATE ON public.teacher_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_teacher_credentials_email ON public.teacher_credentials(email);
CREATE INDEX idx_teacher_credentials_matricula ON public.teacher_credentials(matricula);