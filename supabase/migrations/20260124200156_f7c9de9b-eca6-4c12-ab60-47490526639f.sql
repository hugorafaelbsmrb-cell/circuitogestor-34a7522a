-- Create automation_settings table for managing WhatsApp automation features
CREATE TABLE public.automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_settings
CREATE POLICY "Authenticated users can view automation_settings"
ON public.automation_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert automation_settings"
ON public.automation_settings FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update automation_settings"
ON public.automation_settings FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete automation_settings"
ON public.automation_settings FOR DELETE
USING (is_admin(auth.uid()));

-- Create message_logs table for tracking all WhatsApp messages sent
CREATE TABLE public.message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID REFERENCES public.guardians(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  template_category TEXT,
  message_preview TEXT,
  automation_key TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_logs
CREATE POLICY "Authenticated users can view message_logs"
ON public.message_logs FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert message_logs"
ON public.message_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete message_logs"
ON public.message_logs FOR DELETE
USING (is_admin(auth.uid()));

-- Create trigger for updating updated_at on automation_settings
CREATE TRIGGER update_automation_settings_updated_at
BEFORE UPDATE ON public.automation_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default automation settings
INSERT INTO public.automation_settings (key, enabled, description, config) VALUES
('auto_payment_confirmed', false, 'Enviar confirmação automática quando pagamento for recebido', '{"template_category": "payment_confirmed"}'),
('auto_payment_reminder_48h', false, 'Enviar lembrete 48h antes do vencimento do boleto', '{"template_category": "payment_due_48h", "send_time": "09:00"}'),
('auto_payment_overdue', false, 'Enviar notificação quando boleto estiver atrasado', '{"template_category": "payment_overdue", "send_time": "10:00"}'),
('auto_enrollment_welcome', false, 'Enviar boas-vindas automática após finalizar matrícula', '{"template_category": "enrollment"}'),
('auto_birthday_greeting', false, 'Enviar parabéns no aniversário do aluno', '{"template_category": "birthday", "send_time": "08:00"}'),
('auto_lms_alert', false, 'Alertar responsáveis semanalmente sobre alunos atrasados no LMS', '{"template_category": "lms_alert", "frequency": "weekly", "send_day": "monday"}'),
('bulk_leads_enabled', true, 'Habilitar envio em massa na página de Leads', '{}'),
('bulk_guardians_enabled', true, 'Habilitar envio em massa na página de Responsáveis', '{}');

-- Create index for faster queries on message_logs
CREATE INDEX idx_message_logs_guardian_id ON public.message_logs(guardian_id);
CREATE INDEX idx_message_logs_lead_id ON public.message_logs(lead_id);
CREATE INDEX idx_message_logs_sent_at ON public.message_logs(sent_at DESC);
CREATE INDEX idx_message_logs_automation_key ON public.message_logs(automation_key);