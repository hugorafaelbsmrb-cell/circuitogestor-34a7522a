-- Create bucket for campaign images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('campaign-images', 'campaign-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for campaign-images bucket
CREATE POLICY "Public can view campaign images"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-images');

CREATE POLICY "Authenticated users can upload campaign images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'campaign-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update campaign images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'campaign-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete campaign images"
ON storage.objects FOR DELETE
USING (bucket_id = 'campaign-images' AND public.is_admin(auth.uid()));

-- Create campaign_images table
CREATE TABLE public.campaign_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  type TEXT NOT NULL DEFAULT 'student_photo',
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on campaign_images
ALTER TABLE public.campaign_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_images
CREATE POLICY "Public can view active campaign images"
ON public.campaign_images FOR SELECT
USING (is_active = true);

CREATE POLICY "Authenticated users can view all campaign images"
ON public.campaign_images FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert campaign images"
ON public.campaign_images FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update campaign images"
ON public.campaign_images FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete campaign images"
ON public.campaign_images FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_campaign_images_updated_at
BEFORE UPDATE ON public.campaign_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default campaign settings into app_settings
INSERT INTO public.app_settings (key, value, description, is_secret)
VALUES 
  ('campaign_hero_title', 'Matrículas Abertas 2026!', 'Título principal da landing page de campanha', false),
  ('campaign_hero_subtitle', 'Transforme o futuro do seu filho com cursos inovadores de tecnologia e desenvolvimento cognitivo', 'Subtítulo da landing page de campanha', false),
  ('campaign_benefits', '[{"icon": "Users", "title": "Turmas Reduzidas", "description": "Máximo 8 alunos por turma"}, {"icon": "Award", "title": "Metodologia Comprovada", "description": "Resultados reais no aprendizado"}, {"icon": "GraduationCap", "title": "Professores Qualificados", "description": "Equipe especializada e experiente"}, {"icon": "Clock", "title": "Horários Flexíveis", "description": "Opções que cabem na sua rotina"}]', 'Lista de benefícios/diferenciais em JSON', false),
  ('campaign_is_active', 'true', 'Ativa ou desativa a landing page de campanha', false),
  ('whatsapp_template_lead_welcome', 'Olá {nome_responsavel}! 🎉\n\nRecebemos seu interesse no curso de *{nome_curso}*!\n\nEm breve nossa equipe entrará em contato para tirar suas dúvidas e agendar uma visita.\n\nObrigado por escolher o {nome_escola}! 🚀', 'Template da mensagem de boas-vindas para leads da campanha', false)
ON CONFLICT (key) DO NOTHING;

-- Insert automation setting for auto_lead_welcome
INSERT INTO public.automation_settings (key, description, enabled, config)
VALUES (
  'auto_lead_welcome',
  'Enviar mensagem automática de boas-vindas para leads da landing page de campanha',
  true,
  '{"delay_seconds": 5}'::jsonb
)
ON CONFLICT (key) DO NOTHING;