ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS clicksign_envelope_id text,
  ADD COLUMN IF NOT EXISTS clicksign_document_id text,
  ADD COLUMN IF NOT EXISTS clicksign_signer_id text,
  ADD COLUMN IF NOT EXISTS clicksign_request_signature_key text,
  ADD COLUMN IF NOT EXISTS clicksign_sign_url text,
  ADD COLUMN IF NOT EXISTS clicksign_signed_pdf_url text,
  ADD COLUMN IF NOT EXISTS clicksign_status text,
  ADD COLUMN IF NOT EXISTS clicksign_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS clicksign_signed_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS contracts_clicksign_envelope_id_idx ON public.contracts(clicksign_envelope_id);
CREATE INDEX IF NOT EXISTS contracts_clicksign_signer_id_idx ON public.contracts(clicksign_signer_id);