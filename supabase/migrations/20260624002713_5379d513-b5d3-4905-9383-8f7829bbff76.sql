ALTER TABLE public.vacation_camp_enrollments
ADD COLUMN IF NOT EXISTS amount_override NUMERIC,
ADD COLUMN IF NOT EXISTS scheduled_days JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

CREATE TABLE IF NOT EXISTS public.vacation_camp_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.vacation_camp_enrollments(id) ON DELETE CASCADE,
  camp_id UUID NOT NULL REFERENCES public.vacation_camps(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  present BOOLEAN NOT NULL DEFAULT false,
  check_in_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, day_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacation_camp_attendance TO authenticated;
GRANT ALL ON public.vacation_camp_attendance TO service_role;

ALTER TABLE public.vacation_camp_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all vacation camp attendance"
  ON public.vacation_camp_attendance
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Moderators can manage all vacation camp attendance"
  ON public.vacation_camp_attendance
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'));

CREATE TRIGGER update_vacation_camp_attendance_updated_at
  BEFORE UPDATE ON public.vacation_camp_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();