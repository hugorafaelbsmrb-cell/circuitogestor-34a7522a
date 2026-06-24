-- =====================================================
-- Controle de Presença e Matrículas Manuais
-- =====================================================

-- 1. Adiciona campos para matrícula manual e Day Use scheduling
ALTER TABLE public.vacation_camp_enrollments 
ADD COLUMN IF NOT EXISTS amount_override NUMERIC,
ADD COLUMN IF NOT EXISTS scheduled_days JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- 2. Tabela de presença (check-in diário)
CREATE TABLE IF NOT EXISTS public.vacation_camp_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.vacation_camp_enrollments(id) ON DELETE CASCADE,
  camp_id UUID NOT NULL REFERENCES public.vacation_camps(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  present BOOLEAN NOT NULL DEFAULT false,
  check_in_time TIME,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, day_date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vacation_camp_attendance_enrollment ON public.vacation_camp_attendance(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_vacation_camp_attendance_camp_day ON public.vacation_camp_attendance(camp_id, day_date);

-- RLS: admin full access, public none
ALTER TABLE public.vacation_camp_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on attendance" ON public.vacation_camp_attendance
  FOR ALL USING (true) WITH CHECK (true);

-- Update trigger
CREATE OR REPLACE TRIGGER set_vacation_camp_attendance_updated_at
  BEFORE UPDATE ON public.vacation_camp_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
