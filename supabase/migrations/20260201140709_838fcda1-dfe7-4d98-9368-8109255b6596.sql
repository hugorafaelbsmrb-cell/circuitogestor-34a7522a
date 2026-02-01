-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  class_group_id UUID REFERENCES public.class_groups(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_time TIME NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, attendance_date, class_group_id)
);

-- Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view attendance_records"
ON public.attendance_records FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can insert attendance_records"
ON public.attendance_records FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance_records"
ON public.attendance_records FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete attendance_records"
ON public.attendance_records FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_attendance_records_updated_at
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default automation setting for absence notification
INSERT INTO public.automation_settings (key, enabled, config, description)
VALUES (
  'auto_absence_notification',
  false,
  '{"tolerance_minutes": 15, "send_immediately": false}'::jsonb,
  'Notificação automática de ausência via WhatsApp'
)
ON CONFLICT (key) DO NOTHING;

-- Insert default absence notification template
INSERT INTO public.app_settings (key, value, description, is_secret)
VALUES (
  'absence_notification_template',
  'Olá, {nome_responsavel}! 👋

Notamos que *{nome_aluno}* não compareceu à aula de *{curso}* hoje ({data}) às {horario}.

Está tudo bem? Se precisar reagendar ou tiver alguma dúvida, entre em contato conosco.

Atenciosamente,
*{nome_escola}*',
  'Template de mensagem WhatsApp para notificação de ausência',
  false
)
ON CONFLICT (key) DO NOTHING;

-- Enable realtime for attendance_records
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;