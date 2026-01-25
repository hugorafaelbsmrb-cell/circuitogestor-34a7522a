-- Add signature fields to contracts table
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS signature_image text,
ADD COLUMN IF NOT EXISTS signed_ip text,
ADD COLUMN IF NOT EXISTS signed_user_agent text,
ADD COLUMN IF NOT EXISTS signature_hash text,
ADD COLUMN IF NOT EXISTS signature_token uuid DEFAULT gen_random_uuid();

-- Create unique index on signature_token for public signing
CREATE UNIQUE INDEX IF NOT EXISTS contracts_signature_token_idx ON public.contracts(signature_token);

-- Create audit log table for contract signature events
CREATE TABLE IF NOT EXISTS public.contract_signature_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL, -- 'viewed', 'signed', 'downloaded'
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on signature logs
ALTER TABLE public.contract_signature_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for signature logs
CREATE POLICY "Authenticated users can view signature logs"
ON public.contract_signature_logs
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert signature logs"
ON public.contract_signature_logs
FOR INSERT
WITH CHECK (true);

-- Add template for contract signature WhatsApp message
INSERT INTO public.app_settings (key, value, description, is_secret)
VALUES (
  'whatsapp_template_contract_signature',
  'Olá {nome}! 📋

O contrato de matrícula de *{aluno}* no curso *{curso}* está pronto para assinatura digital.

✍️ Acesse o link abaixo para visualizar e assinar:
{link}

Este link é único e intransferível.

Qualquer dúvida, estamos à disposição! 🙂',
  'Template da mensagem de assinatura de contrato',
  false
)
ON CONFLICT (key) DO NOTHING;

-- Add automation setting for auto contract signature
INSERT INTO public.automation_settings (key, description, enabled, config)
VALUES (
  'auto_contract_signature',
  'Enviar link de assinatura automaticamente quando contrato é gerado',
  true,
  '{"delay_seconds": 0}'::jsonb
)
ON CONFLICT (key) DO NOTHING;