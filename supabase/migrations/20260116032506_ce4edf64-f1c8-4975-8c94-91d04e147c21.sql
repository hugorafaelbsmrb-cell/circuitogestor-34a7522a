-- Drop the insecure public policy
DROP POLICY IF EXISTS "Allow all for guardians" ON public.guardians;

-- Create secure RLS policies for guardians table
-- Only authenticated users can view guardians
CREATE POLICY "Authenticated users can view guardians"
ON public.guardians
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Only authenticated users can insert guardians
CREATE POLICY "Authenticated users can insert guardians"
ON public.guardians
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated users can update guardians
CREATE POLICY "Authenticated users can update guardians"
ON public.guardians
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Only admins can delete guardians
CREATE POLICY "Admins can delete guardians"
ON public.guardians
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));