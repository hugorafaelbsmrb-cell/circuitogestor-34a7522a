ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS zapsign_document_id text,
  ADD COLUMN IF NOT EXISTS zapsign_signer_token text,
  ADD COLUMN IF NOT EXISTS zapsign_sign_url text,
  ADD COLUMN IF NOT EXISTS zapsign_signed_pdf_url text,
  ADD COLUMN IF NOT EXISTS zapsign_status text,
  ADD COLUMN IF NOT EXISTS zapsign_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS zapsign_signed_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS contracts_zapsign_document_id_idx ON public.contracts(zapsign_document_id);