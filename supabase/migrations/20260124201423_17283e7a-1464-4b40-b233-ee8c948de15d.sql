-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can create templates" ON public.bulk_message_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON public.bulk_message_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON public.bulk_message_templates;
DROP POLICY IF EXISTS "Authenticated users can create scheduled messages" ON public.scheduled_bulk_messages;
DROP POLICY IF EXISTS "Authenticated users can update scheduled messages" ON public.scheduled_bulk_messages;
DROP POLICY IF EXISTS "Authenticated users can delete scheduled messages" ON public.scheduled_bulk_messages;

-- Recreate with proper auth checks
CREATE POLICY "Authenticated users can create templates"
ON public.bulk_message_templates FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update templates"
ON public.bulk_message_templates FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete templates"
ON public.bulk_message_templates FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can create scheduled messages"
ON public.scheduled_bulk_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update scheduled messages"
ON public.scheduled_bulk_messages FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete scheduled messages"
ON public.scheduled_bulk_messages FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));