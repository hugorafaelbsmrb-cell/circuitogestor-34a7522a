-- Create table for quick reply templates
CREATE TABLE public.quick_reply_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  message TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quick_reply_templates ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (admin access)
CREATE POLICY "Authenticated users can view active quick replies"
ON public.quick_reply_templates
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage quick replies"
ON public.quick_reply_templates
FOR ALL
USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_quick_reply_templates_updated_at
BEFORE UPDATE ON public.quick_reply_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default quick replies
INSERT INTO public.quick_reply_templates (label, message, sort_order) VALUES
('Saudação', 'Olá! Tudo bem? Em que posso ajudar?', 1),
('Confirmação', 'Perfeito! Confirmado. ✅', 2),
('Agradecimento', 'Muito obrigado pelo contato! 🙏', 3),
('Aguardar', 'Aguarde um momento, por favor. Já retorno!', 4),
('Até logo', 'Foi um prazer atendê-lo! Qualquer dúvida, estamos à disposição. 👋', 5),
('Horário', 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.', 6);