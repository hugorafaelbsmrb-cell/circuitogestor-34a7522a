-- Add automation setting for teacher report status notification
INSERT INTO automation_settings (key, description, enabled, config)
VALUES (
  'auto_teacher_report_notification',
  'Notificar professor automaticamente quando relatório for aprovado ou rejeitado',
  true,
  '{"template_approved": "Olá {nome}! 🎉\n\nSeu relatório de *{aluno}* foi *APROVADO* e já está disponível no portal dos pais.\n\n📅 Data: {data}\n📋 Título: {titulo}\n\nObrigado pelo excelente trabalho!", "template_rejected": "Olá {nome}!\n\nSeu relatório de *{aluno}* precisa de *REVISÃO*.\n\n📅 Data: {data}\n📋 Título: {titulo}\n\n⚠️ *Motivo:* {motivo}\n\nPor favor, faça os ajustes necessários e reenvie."}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  updated_at = now();