ALTER TABLE public.vacation_camp_enrollments
  ADD COLUMN IF NOT EXISTS asaas_payment_id_2 text,
  ADD COLUMN IF NOT EXISTS split_pix_amount numeric,
  ADD COLUMN IF NOT EXISTS split_card_amount numeric,
  ADD COLUMN IF NOT EXISTS split_pix_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS split_card_paid boolean NOT NULL DEFAULT false;