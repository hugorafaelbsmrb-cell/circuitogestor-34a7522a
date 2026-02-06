-- =====================================================
-- SECURITY FIX: Corrigir vulnerabilidades críticas de RLS
-- =====================================================

-- 1. PROFILES: Impedir auto-promoção de privilégios
DROP POLICY IF EXISTS "Users and admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile safely" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profile fields" ON public.profiles;

-- Usuários podem atualizar apenas campos não-sensíveis do próprio perfil
CREATE POLICY "Users can update own profile safely" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
  permissions = (SELECT permissions FROM public.profiles WHERE id = auth.uid())
);

-- Admins podem atualizar qualquer campo de qualquer perfil
CREATE POLICY "Admins can update all profile fields" 
ON public.profiles 
FOR UPDATE 
USING (public.is_admin(auth.uid()));

-- 2. STUDENTS: Manter políticas existentes (já estão ok)
-- Não alterar pois o acesso público é necessário para cantina e portal

-- 3. GUARDIANS: Já existe política autenticada, remover políticas públicas antigas
DROP POLICY IF EXISTS "Public can view guardians for support" ON public.guardians;
DROP POLICY IF EXISTS "Public read access for canteen registration" ON public.guardians;

-- 4. APP_SETTINGS: Restringir DELETE para admins
DROP POLICY IF EXISTS "Authenticated users can delete settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON public.app_settings;

CREATE POLICY "Admins can delete settings"
ON public.app_settings
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Restringir UPDATE de configurações secretas para admins
DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated can update non-secret settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update secret settings" ON public.app_settings;

CREATE POLICY "Authenticated can update non-secret settings"
ON public.app_settings
FOR UPDATE
USING (auth.uid() IS NOT NULL AND (is_secret = false OR is_secret IS NULL));

CREATE POLICY "Admins can update secret settings"
ON public.app_settings
FOR UPDATE
USING (public.is_admin(auth.uid()) AND is_secret = true);

-- 5. REPORT_PARENT_COMMENTS: Adicionar política de DELETE para admins
DROP POLICY IF EXISTS "Admins can delete comments" ON public.report_parent_comments;

CREATE POLICY "Admins can delete comments"
ON public.report_parent_comments
FOR DELETE
USING (public.is_admin(auth.uid()));

-- 6. STORAGE: Restringir upload/delete de branding para admins
DROP POLICY IF EXISTS "Authenticated users can upload login backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update login backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete login backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload system branding" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update system branding" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete system branding" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage login backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage system branding" ON storage.objects;

CREATE POLICY "Admins can manage login backgrounds" 
ON storage.objects
FOR ALL
USING (bucket_id = 'login-backgrounds' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'login-backgrounds' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage system branding" 
ON storage.objects
FOR ALL
USING (bucket_id = 'system-branding' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'system-branding' AND public.is_admin(auth.uid()));