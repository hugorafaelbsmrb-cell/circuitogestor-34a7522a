-- Add user permissions column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{"dashboard": true, "enrollment": true, "students": true, "leads": true, "classes": true, "courses": true, "schedules": true, "financial": true, "carnes": true, "contracts": true, "discounts": true, "contract_config": true}'::jsonb;

-- Update admin to have all permissions
UPDATE profiles SET permissions = '{
  "dashboard": true,
  "enrollment": true,
  "students": true,
  "leads": true,
  "classes": true,
  "courses": true,
  "schedules": true,
  "financial": true,
  "carnes": true,
  "contracts": true,
  "discounts": true,
  "contract_config": true,
  "users": true,
  "settings": true
}'::jsonb WHERE role = 'admin';

-- Insert default Asaas discount settings if not exist
INSERT INTO app_settings (key, value, description, is_secret)
VALUES 
  ('asaas_discount_enabled', 'false', 'Habilitar desconto por antecipação nos boletos', false),
  ('asaas_discount_value', '0', 'Valor do desconto por antecipação (em %)', false),
  ('asaas_discount_days_before', '0', 'Dias antes do vencimento para aplicar desconto', false)
ON CONFLICT (key) DO NOTHING;