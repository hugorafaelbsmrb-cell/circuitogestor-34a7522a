-- Create table for parent comments on student reports
CREATE TABLE public.report_parent_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES public.guardians(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint to allow only one comment per report per guardian
CREATE UNIQUE INDEX idx_report_parent_comments_unique ON public.report_parent_comments(report_id, guardian_id);

-- Enable RLS
ALTER TABLE public.report_parent_comments ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access (since parents access via CPF without auth)
CREATE POLICY "Allow public read access to report comments"
ON public.report_parent_comments
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access to report comments"
ON public.report_parent_comments
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access to report comments"
ON public.report_parent_comments
FOR UPDATE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_report_parent_comments_updated_at
BEFORE UPDATE ON public.report_parent_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();