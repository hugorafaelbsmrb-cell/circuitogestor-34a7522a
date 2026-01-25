-- Add avatar_url column to leads table
ALTER TABLE public.leads 
ADD COLUMN avatar_url TEXT;

COMMENT ON COLUMN public.leads.avatar_url IS 'URL da foto de perfil do WhatsApp do lead';