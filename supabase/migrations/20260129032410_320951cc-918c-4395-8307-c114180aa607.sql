-- Add notification fields to student_reports
ALTER TABLE public.student_reports 
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS read_by_guardian BOOLEAN DEFAULT false;

-- Insert automation setting for report notifications
INSERT INTO public.automation_settings (key, enabled, description, config)
VALUES (
  'auto_report_notification',
  false,
  'Enviar notificação automática ao responsável quando relatório for aprovado',
  '{"template_category": "report_available"}'
)
ON CONFLICT (key) DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_student_reports_notification ON public.student_reports (approval_status, notification_sent_at);
CREATE INDEX IF NOT EXISTS idx_student_reports_read ON public.student_reports (read_at);