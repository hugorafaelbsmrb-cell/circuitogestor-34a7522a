-- Allow public access to contracts via signature token for digital signing
CREATE POLICY "Public can view contracts via signature token"
ON public.contracts
FOR SELECT
USING (signature_token IS NOT NULL);

-- Allow public access to insert signature logs (for audit trail)
CREATE POLICY "Public can insert signature logs"
ON public.contract_signature_logs
FOR INSERT
WITH CHECK (true);