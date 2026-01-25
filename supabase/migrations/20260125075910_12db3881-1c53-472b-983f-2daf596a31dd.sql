-- Create teachers table linked to class rooms
CREATE TABLE public.teachers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  class_group_id UUID REFERENCES public.class_groups(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Authenticated users can read, admins can write
CREATE POLICY "Authenticated users can view teachers"
ON public.teachers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert teachers"
ON public.teachers
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update teachers"
ON public.teachers
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete teachers"
ON public.teachers
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Create homework reports table to track processed reports
CREATE TABLE public.homework_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES public.guardians(id) ON DELETE SET NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  original_message TEXT NOT NULL,
  processed_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.homework_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view homework reports"
ON public.homework_reports
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can insert homework reports"
ON public.homework_reports
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role can update homework reports"
ON public.homework_reports
FOR UPDATE
TO authenticated
USING (true);

-- Enable realtime for homework_reports
ALTER PUBLICATION supabase_realtime ADD TABLE public.homework_reports;

-- Create trigger for updated_at on teachers
CREATE TRIGGER update_teachers_updated_at
BEFORE UPDATE ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_teachers_class_group ON public.teachers(class_group_id);
CREATE INDEX idx_homework_reports_status ON public.homework_reports(status);
CREATE INDEX idx_homework_reports_guardian ON public.homework_reports(guardian_id);