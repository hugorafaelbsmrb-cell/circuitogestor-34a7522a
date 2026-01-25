-- Drop existing restrictive policy and create new one for public contract access
DROP POLICY IF EXISTS "Public can view contracts via signature token" ON public.contracts;

CREATE POLICY "Public can view contracts via signature token"
ON public.contracts
FOR SELECT
TO anon, authenticated
USING (signature_token IS NOT NULL);

-- Ensure edge function can update contracts (service role will handle this)
-- But we need to allow updates via the edge function for contract signing
DROP POLICY IF EXISTS "Service role can update contracts for signing" ON public.contracts;

CREATE POLICY "Service role can update contracts for signing"
ON public.contracts
FOR UPDATE
TO anon, authenticated
USING (signature_token IS NOT NULL AND signed_at IS NULL)
WITH CHECK (true);