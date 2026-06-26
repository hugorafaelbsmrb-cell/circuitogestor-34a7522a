
ALTER TABLE public.vacation_camp_enrollments
  ADD COLUMN IF NOT EXISTS internal_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_guardian_id uuid REFERENCES public.guardians(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_internal_student boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS base_tuition numeric,
  ADD COLUMN IF NOT EXISTS tuition_diff numeric,
  ADD COLUMN IF NOT EXISTS settled_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tuition_settled_at timestamptz;

ALTER TABLE public.vacation_camps
  ADD COLUMN IF NOT EXISTS tuition_skip_month smallint,
  ADD COLUMN IF NOT EXISTS tuition_skip_year smallint;

CREATE INDEX IF NOT EXISTS idx_vce_internal_student ON public.vacation_camp_enrollments(internal_student_id);
