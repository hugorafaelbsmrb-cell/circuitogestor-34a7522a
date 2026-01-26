-- Create table for student reports from external system
CREATE TABLE public.student_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  report_type VARCHAR(50) DEFAULT 'pedagogical',
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_reports ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (admin access)
CREATE POLICY "Authenticated users can manage reports"
ON public.student_reports
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_reports;

-- Create trigger for updated_at
CREATE TRIGGER update_student_reports_updated_at
BEFORE UPDATE ON public.student_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better query performance
CREATE INDEX idx_student_reports_student_id ON public.student_reports(student_id);
CREATE INDEX idx_student_reports_teacher_id ON public.student_reports(teacher_id);
CREATE INDEX idx_student_reports_status ON public.student_reports(status);