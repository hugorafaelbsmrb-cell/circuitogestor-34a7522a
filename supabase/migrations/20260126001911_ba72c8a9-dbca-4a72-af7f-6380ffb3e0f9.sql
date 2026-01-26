-- Create table for teacher training progress (received via POST /sync from external system)
CREATE TABLE public.teacher_training_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  teacher_credential_id UUID REFERENCES public.teacher_credentials(id) ON DELETE CASCADE,
  track_name TEXT NOT NULL,
  current_module TEXT,
  current_lesson TEXT,
  completed_lessons INTEGER NOT NULL DEFAULT 0,
  total_lessons INTEGER NOT NULL DEFAULT 0,
  completion_percentage NUMERIC(5,2) DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teacher_training_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view teacher training progress"
  ON public.teacher_training_progress FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert teacher training progress"
  ON public.teacher_training_progress FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update teacher training progress"
  ON public.teacher_training_progress FOR UPDATE
  USING (true);

CREATE POLICY "Only admins can delete teacher training progress"
  ON public.teacher_training_progress FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Index for faster lookups
CREATE INDEX idx_teacher_training_teacher_id ON public.teacher_training_progress(teacher_id);
CREATE INDEX idx_teacher_training_credential_id ON public.teacher_training_progress(teacher_credential_id);

-- Trigger for updated_at
CREATE TRIGGER update_teacher_training_progress_updated_at
  BEFORE UPDATE ON public.teacher_training_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();