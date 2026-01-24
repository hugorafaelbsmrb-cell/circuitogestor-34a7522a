-- Create table for saved message templates
CREATE TABLE public.bulk_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulk_message_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view templates"
ON public.bulk_message_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create templates"
ON public.bulk_message_templates FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update templates"
ON public.bulk_message_templates FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete templates"
ON public.bulk_message_templates FOR DELETE
TO authenticated
USING (true);

-- Create table for scheduled bulk messages
CREATE TABLE public.scheduled_bulk_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  course_filter TEXT DEFAULT 'all',
  recipient_ids TEXT[] NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_bulk_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view scheduled messages"
ON public.scheduled_bulk_messages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create scheduled messages"
ON public.scheduled_bulk_messages FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update scheduled messages"
ON public.scheduled_bulk_messages FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete scheduled messages"
ON public.scheduled_bulk_messages FOR DELETE
TO authenticated
USING (true);

-- Create indexes for performance
CREATE INDEX idx_scheduled_bulk_messages_status ON public.scheduled_bulk_messages(status);
CREATE INDEX idx_scheduled_bulk_messages_scheduled_at ON public.scheduled_bulk_messages(scheduled_at);

-- Update trigger for templates
CREATE TRIGGER update_bulk_message_templates_updated_at
BEFORE UPDATE ON public.bulk_message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for scheduled messages
CREATE TRIGGER update_scheduled_bulk_messages_updated_at
BEFORE UPDATE ON public.scheduled_bulk_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();