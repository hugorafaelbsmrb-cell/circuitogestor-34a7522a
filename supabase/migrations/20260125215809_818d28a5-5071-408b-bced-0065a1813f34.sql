-- Add representative signature URL field to contract_config
ALTER TABLE public.contract_config 
ADD COLUMN representative_signature_url TEXT DEFAULT NULL;

-- Add representative name field for the signature
ALTER TABLE public.contract_config 
ADD COLUMN representative_name TEXT DEFAULT NULL;