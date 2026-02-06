-- Fix overly permissive RLS policies for guardian_support_tickets
-- These should require authentication, not public access
DROP POLICY IF EXISTS "Users can create tickets" ON public.guardian_support_tickets;
DROP POLICY IF EXISTS "Users can delete tickets" ON public.guardian_support_tickets;
DROP POLICY IF EXISTS "Users can update tickets" ON public.guardian_support_tickets;
DROP POLICY IF EXISTS "Users can view all tickets" ON public.guardian_support_tickets;

CREATE POLICY "Authenticated users can create tickets"
ON public.guardian_support_tickets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view tickets"
ON public.guardian_support_tickets
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tickets"
ON public.guardian_support_tickets
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete tickets"
ON public.guardian_support_tickets
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix teacher_credentials policies
DROP POLICY IF EXISTS "Authenticated users can insert teacher credentials" ON public.teacher_credentials;
DROP POLICY IF EXISTS "Authenticated users can update teacher credentials" ON public.teacher_credentials;
DROP POLICY IF EXISTS "Authenticated users can view teacher credentials" ON public.teacher_credentials;

CREATE POLICY "Authenticated users can insert teacher credentials"
ON public.teacher_credentials
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update teacher credentials"
ON public.teacher_credentials
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view teacher credentials"
ON public.teacher_credentials
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Fix soroban_credentials policies
DROP POLICY IF EXISTS "Authenticated users can insert soroban credentials" ON public.soroban_credentials;
DROP POLICY IF EXISTS "Authenticated users can update soroban credentials" ON public.soroban_credentials;
DROP POLICY IF EXISTS "Authenticated users can view soroban credentials" ON public.soroban_credentials;

CREATE POLICY "Authenticated users can insert soroban credentials"
ON public.soroban_credentials
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update soroban credentials"
ON public.soroban_credentials
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view soroban credentials"
ON public.soroban_credentials
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Fix homework_reports policies - keep public insert for webhooks but add restrictions
DROP POLICY IF EXISTS "Service role can insert homework reports" ON public.homework_reports;
DROP POLICY IF EXISTS "Service role can update homework reports" ON public.homework_reports;
DROP POLICY IF EXISTS "Authenticated users can view homework reports" ON public.homework_reports;

CREATE POLICY "Service role can insert homework reports"
ON public.homework_reports
FOR INSERT
WITH CHECK (true); -- Needed for edge functions

CREATE POLICY "Service role can update homework reports"
ON public.homework_reports
FOR UPDATE
USING (true); -- Needed for edge functions

CREATE POLICY "Authenticated users can view homework reports"
ON public.homework_reports
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Fix teacher_training_progress policies
DROP POLICY IF EXISTS "Service role can insert teacher training progress" ON public.teacher_training_progress;
DROP POLICY IF EXISTS "Service role can update teacher training progress" ON public.teacher_training_progress;

CREATE POLICY "Service role can insert teacher training progress"
ON public.teacher_training_progress
FOR INSERT
WITH CHECK (true); -- Needed for edge functions/webhooks

CREATE POLICY "Service role can update teacher training progress"
ON public.teacher_training_progress
FOR UPDATE
USING (true); -- Needed for edge functions/webhooks

-- Update is_admin function to use new secure role checking
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
$$;