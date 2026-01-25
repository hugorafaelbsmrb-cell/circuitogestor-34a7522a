-- Add automation setting for auto-send signed contract
INSERT INTO public.automation_settings (key, enabled, description, config)
VALUES (
  'auto_contract_signed_notify',
  false,
  'Envia automaticamente o contrato assinado para o responsável via WhatsApp',
  '{"send_pdf": false}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Add template for signed contract notification
INSERT INTO public.app_settings (key, value, description, is_secret)
VALUES (
  'whatsapp_template_contract_signed',
  'Olá {nome}! 🎉\n\nO contrato de matrícula de *{aluno}* no curso *{curso}* foi assinado com sucesso!\n\n✅ *Data da assinatura:* {data_assinatura}\n📄 *Hash de verificação:* {hash}\n\nO documento possui validade jurídica conforme MP 2.200-2/2001.\n\nAgradecemos pela confiança! 🙂',
  'Template de notificação de contrato assinado',
  false
)
ON CONFLICT (key) DO NOTHING;