-- Temporariamente permitir acesso completo para debugging
-- IMPORTANTE: Isso é apenas para teste, vamos refinar depois

DROP POLICY IF EXISTS "Public can view contracts via signature token" ON public.contracts;
DROP POLICY IF EXISTS "Service role can update contracts for signing" ON public.contracts;

-- Política mais permissiva para permitir Safari acessar
CREATE POLICY "Anyone can view contracts with token"
ON public.contracts
FOR SELECT
USING (signature_token IS NOT NULL);

-- Permitir service role (edge function) atualizar contratos
CREATE POLICY "Allow updates for signing"
ON public.contracts
FOR UPDATE  
USING (signature_token IS NOT NULL AND signed_at IS NULL);