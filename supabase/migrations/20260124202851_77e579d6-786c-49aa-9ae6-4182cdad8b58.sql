-- Create table for guardian support/communication tracking
CREATE TABLE public.guardian_support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'waiting_response', 'completed')),
  subject TEXT NOT NULL,
  notes TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.guardian_support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all tickets"
  ON public.guardian_support_tickets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create tickets"
  ON public.guardian_support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update tickets"
  ON public.guardian_support_tickets
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete tickets"
  ON public.guardian_support_tickets
  FOR DELETE
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_guardian_support_tickets_updated_at
  BEFORE UPDATE ON public.guardian_support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.guardian_support_tickets;