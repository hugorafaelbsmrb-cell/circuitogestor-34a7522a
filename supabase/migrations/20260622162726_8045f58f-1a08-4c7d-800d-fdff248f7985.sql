ALTER TABLE public.vacation_camp_packages 
  ADD COLUMN IF NOT EXISTS students_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_negotiable boolean NOT NULL DEFAULT false;