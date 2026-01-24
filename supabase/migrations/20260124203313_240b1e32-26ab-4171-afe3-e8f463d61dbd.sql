-- Create table for storing WhatsApp messages (sent and received)
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardian_id UUID REFERENCES public.guardians(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  status TEXT DEFAULT 'delivered',
  wapi_message_id TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_whatsapp_messages_guardian ON public.whatsapp_messages(guardian_id);
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone);
CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view messages"
  ON public.whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert messages"
  ON public.whatsapp_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;