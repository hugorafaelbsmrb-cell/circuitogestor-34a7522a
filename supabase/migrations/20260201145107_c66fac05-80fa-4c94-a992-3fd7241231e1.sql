-- Create email_messages table for caching emails locally
CREATE TABLE public.email_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  from_address TEXT NOT NULL,
  to_addresses TEXT[] NOT NULL DEFAULT '{}',
  cc_addresses TEXT[] DEFAULT '{}',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  folder TEXT NOT NULL DEFAULT 'INBOX',
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only authenticated users can access
CREATE POLICY "Authenticated users can view email_messages"
ON public.email_messages
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert email_messages"
ON public.email_messages
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update email_messages"
ON public.email_messages
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete email_messages"
ON public.email_messages
FOR DELETE
USING (is_admin(auth.uid()));

-- Create indexes for better query performance
CREATE INDEX idx_email_messages_folder ON public.email_messages(folder);
CREATE INDEX idx_email_messages_received_at ON public.email_messages(received_at DESC);
CREATE INDEX idx_email_messages_is_read ON public.email_messages(is_read);

-- Create trigger for updated_at
CREATE TRIGGER update_email_messages_updated_at
BEFORE UPDATE ON public.email_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();