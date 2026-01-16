-- Drop the insecure public policy for payments
DROP POLICY IF EXISTS "Allow all for payments" ON public.payments;

-- Create secure RLS policies for payments table
-- Only authenticated users can view payments
CREATE POLICY "Authenticated users can view payments"
ON public.payments
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Only authenticated users can insert payments
CREATE POLICY "Authenticated users can insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated users can update payments
CREATE POLICY "Authenticated users can update payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Only admins can delete payments
CREATE POLICY "Admins can delete payments"
ON public.payments
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));