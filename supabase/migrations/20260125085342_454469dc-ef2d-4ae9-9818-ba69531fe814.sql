-- Adicionar campos para pré-matrícula na tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS guardian_cpf TEXT,
ADD COLUMN IF NOT EXISTS guardian_address TEXT,
ADD COLUMN IF NOT EXISTS guardian_address_number TEXT DEFAULT 'S/N',
ADD COLUMN IF NOT EXISTS guardian_province TEXT DEFAULT 'Centro',
ADD COLUMN IF NOT EXISTS guardian_postal_code TEXT;

-- Adicionar campo de sexo do aluno (já existe student_name e student_birth_date)
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS student_sex TEXT DEFAULT 'M';

-- Criar política para permitir inserção pública (formulário externo)
CREATE POLICY "Public can insert leads from external form"
ON public.leads
FOR INSERT
TO anon
WITH CHECK (source = 'external_form');

-- Criar política para permitir leitura pública de cursos ativos (para dropdown do formulário)
CREATE POLICY "Public can view active courses"
ON public.courses
FOR SELECT
TO anon
USING (is_active = true);

-- Criar política para leitura pública de branding
CREATE POLICY "Public can view branding settings"
ON public.app_settings
FOR SELECT
TO anon
USING (key IN ('system_name', 'system_logo') AND is_secret = false);