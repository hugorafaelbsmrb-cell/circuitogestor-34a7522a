-- =====================================================
-- COLÔNIA DE FÉRIAS: Tabelas, RLS e Bucket
-- =====================================================

-- 1. vacation_camps (edições da colônia)
CREATE TABLE IF NOT EXISTS public.vacation_camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_image_url TEXT,
  gallery JSONB DEFAULT '[]'::jsonb,
  highlights JSONB DEFAULT '[]'::jsonb,
  faq JSONB DEFAULT '[]'::jsonb,
  start_date DATE,
  end_date DATE,
  location TEXT,
  age_min INTEGER,
  age_max INTEGER,
  theme_color TEXT DEFAULT '#f97316',
  cta_text TEXT DEFAULT 'Garantir vaga',
  whatsapp_number TEXT,
  terms_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. vacation_camp_packages (pacotes)
CREATE TABLE IF NOT EXISTS public.vacation_camp_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.vacation_camps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC,
  max_slots INTEGER,
  sold_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  payment_methods JSONB DEFAULT '["PIX","BOLETO"]'::jsonb,
  max_installments INTEGER NOT NULL DEFAULT 1,
  due_days INTEGER NOT NULL DEFAULT 3,
  includes JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. vacation_camp_schedule (programação)
CREATE TABLE IF NOT EXISTS public.vacation_camp_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.vacation_camps(id) ON DELETE CASCADE,
  day_label TEXT NOT NULL,
  time_label TEXT,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Sparkles',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. vacation_camp_enrollments (inscritos)
CREATE TABLE IF NOT EXISTS public.vacation_camp_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.vacation_camps(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.vacation_camp_packages(id) ON DELETE SET NULL,
  guardian_name TEXT NOT NULL,
  guardian_phone TEXT NOT NULL,
  guardian_email TEXT,
  guardian_cpf TEXT NOT NULL,
  child_name TEXT NOT NULL,
  child_age INTEGER,
  child_birthdate DATE,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'landing' CHECK (source IN ('landing', 'admin')),
  linked_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'overdue', 'cancelled', 'exempt')),
  asaas_payment_id TEXT,
  asaas_invoice_url TEXT,
  asaas_bank_slip_url TEXT,
  asaas_pix_payload TEXT,
  asaas_customer_id TEXT,
  amount NUMERIC,
  payment_method TEXT,
  installments INTEGER DEFAULT 1,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_vacation_camps_slug ON public.vacation_camps(slug);
CREATE INDEX IF NOT EXISTS idx_vacation_camps_status ON public.vacation_camps(status);
CREATE INDEX IF NOT EXISTS idx_vacation_camp_packages_camp_id ON public.vacation_camp_packages(camp_id);
CREATE INDEX IF NOT EXISTS idx_vacation_camp_schedule_camp_id ON public.vacation_camp_schedule(camp_id);
CREATE INDEX IF NOT EXISTS idx_vacation_camp_enrollments_camp_id ON public.vacation_camp_enrollments(camp_id);
CREATE INDEX IF NOT EXISTS idx_vacation_camp_enrollments_package_id ON public.vacation_camp_enrollments(package_id);
CREATE INDEX IF NOT EXISTS idx_vacation_camp_enrollments_status ON public.vacation_camp_enrollments(payment_status);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- vacation_camps
ALTER TABLE public.vacation_camps ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas de colônias publicadas (landing page)
CREATE POLICY "Public can view published camps"
ON public.vacation_camps FOR SELECT
USING (status = 'published');

-- Admins podem tudo
CREATE POLICY "Admins can manage camps"
ON public.vacation_camps FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- vacation_camp_packages
ALTER TABLE public.vacation_camp_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view packages of published camps"
ON public.vacation_camp_packages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vacation_camps
    WHERE vacation_camps.id = vacation_camp_packages.camp_id
    AND vacation_camps.status = 'published'
  )
);

CREATE POLICY "Admins can manage packages"
ON public.vacation_camp_packages FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- vacation_camp_schedule
ALTER TABLE public.vacation_camp_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view schedule of published camps"
ON public.vacation_camp_schedule FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.vacation_camps
    WHERE vacation_camps.id = vacation_camp_schedule.camp_id
    AND vacation_camps.status = 'published'
  )
);

CREATE POLICY "Admins can manage schedule"
ON public.vacation_camp_schedule FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- vacation_camp_enrollments
ALTER TABLE public.vacation_camp_enrollments ENABLE ROW LEVEL SECURITY;

-- Insert público (via edge function com service_role, mas permitimos anon para o checkout)
CREATE POLICY "Public can insert enrollments"
ON public.vacation_camp_enrollments FOR INSERT
WITH CHECK (true);

-- Leitura e update apenas admins
CREATE POLICY "Admins can manage enrollments"
ON public.vacation_camp_enrollments FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- =====================================================
-- TRIGGERS (updated_at)
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_vacation_camps') THEN
    CREATE TRIGGER set_updated_at_vacation_camps
    BEFORE UPDATE ON public.vacation_camps
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_vacation_camp_packages') THEN
    CREATE TRIGGER set_updated_at_vacation_camp_packages
    BEFORE UPDATE ON public.vacation_camp_packages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_vacation_camp_schedule') THEN
    CREATE TRIGGER set_updated_at_vacation_camp_schedule
    BEFORE UPDATE ON public.vacation_camp_schedule
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_vacation_camp_enrollments') THEN
    CREATE TRIGGER set_updated_at_vacation_camp_enrollments
    BEFORE UPDATE ON public.vacation_camp_enrollments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- =====================================================
-- STORAGE BUCKET (camp-images)
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('camp-images', 'camp-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
DROP POLICY IF EXISTS "Public can view camp images" ON storage.objects;
CREATE POLICY "Public can view camp images"
ON storage.objects FOR SELECT
USING (bucket_id = 'camp-images');

DROP POLICY IF EXISTS "Admins can manage camp images" ON storage.objects;
CREATE POLICY "Admins can manage camp images"
ON storage.objects FOR ALL
USING (bucket_id = 'camp-images' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'camp-images' AND public.is_admin(auth.uid()));
