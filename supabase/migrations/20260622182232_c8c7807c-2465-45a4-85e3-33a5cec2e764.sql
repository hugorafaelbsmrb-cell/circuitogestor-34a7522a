ALTER TABLE public.vacation_camp_packages
  ADD COLUMN IF NOT EXISTS card_interest_free_installments integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS card_interest_percent numeric(6,3) NOT NULL DEFAULT 0;