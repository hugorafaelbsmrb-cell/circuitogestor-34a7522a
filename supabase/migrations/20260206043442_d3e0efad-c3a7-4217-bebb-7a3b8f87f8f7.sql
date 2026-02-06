-- ============================================
-- VIEWS MASCARADAS PARA DADOS SENSÍVEIS
-- ============================================

-- View mascarada para responsáveis (guardians)
-- Oculta CPF, telefone, email e endereço parcialmente
CREATE OR REPLACE VIEW public.guardians_masked
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  avatar_url,
  -- CPF mascarado: ***.***.***-XX
  CASE 
    WHEN cpf IS NOT NULL AND LENGTH(cpf) >= 2 
    THEN '***.***.***-' || RIGHT(REGEXP_REPLACE(cpf, '[^0-9]', '', 'g'), 2)
    ELSE '***.***.***-**'
  END as cpf,
  -- Email mascarado: p***@dominio.com
  CASE 
    WHEN email IS NOT NULL AND email LIKE '%@%'
    THEN LEFT(email, 1) || '***@' || SPLIT_PART(email, '@', 2)
    ELSE '***@***.***'
  END as email,
  -- Telefone mascarado: (**) *****-XXXX
  CASE 
    WHEN phone IS NOT NULL AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 4
    THEN '(**) *****-' || RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 4)
    ELSE '(**) *****-****'
  END as phone,
  -- Endereço mascarado: mostra apenas cidade/bairro
  CASE 
    WHEN address IS NOT NULL 
    THEN SPLIT_PART(address, ',', 1) || ', ***'
    ELSE '***'
  END as address,
  address_number,
  province,
  postal_code,
  asaas_customer_id,
  created_at,
  updated_at
FROM public.guardians;

-- View mascarada para leads
CREATE OR REPLACE VIEW public.leads_masked
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  avatar_url,
  source,
  status,
  notes,
  student_name,
  student_birth_date,
  student_sex,
  interested_course_id,
  assigned_to,
  converted_at,
  enrollment_id,
  preferred_due_day,
  -- Email mascarado
  CASE 
    WHEN email IS NOT NULL AND email LIKE '%@%'
    THEN LEFT(email, 1) || '***@' || SPLIT_PART(email, '@', 2)
    ELSE NULL
  END as email,
  -- Telefone mascarado
  CASE 
    WHEN phone IS NOT NULL AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 4
    THEN '(**) *****-' || RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 4)
    ELSE '(**) *****-****'
  END as phone,
  -- CPF mascarado
  CASE 
    WHEN guardian_cpf IS NOT NULL AND LENGTH(guardian_cpf) >= 2 
    THEN '***.***.***-' || RIGHT(REGEXP_REPLACE(guardian_cpf, '[^0-9]', '', 'g'), 2)
    ELSE NULL
  END as guardian_cpf,
  -- Endereço mascarado
  CASE 
    WHEN guardian_address IS NOT NULL 
    THEN SPLIT_PART(guardian_address, ',', 1) || ', ***'
    ELSE NULL
  END as guardian_address,
  guardian_address_number,
  guardian_province,
  guardian_postal_code,
  created_at,
  updated_at
FROM public.leads;

-- Comentários para documentação
COMMENT ON VIEW public.guardians_masked IS 'View com dados sensíveis de responsáveis mascarados para usuários não-admin';
COMMENT ON VIEW public.leads_masked IS 'View com dados sensíveis de leads mascarados para usuários não-admin';