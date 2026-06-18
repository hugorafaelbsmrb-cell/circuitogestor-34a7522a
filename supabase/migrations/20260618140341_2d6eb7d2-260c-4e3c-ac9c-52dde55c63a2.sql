
CREATE TABLE public.vacation_camps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  status text NOT NULL DEFAULT 'draft',
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date date,
  end_date date,
  location text,
  age_min int,
  age_max int,
  theme_color text DEFAULT '#3B82F6',
  cta_text text DEFAULT 'Garantir vaga',
  whatsapp_number text,
  terms_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacation_camps TO authenticated;
GRANT SELECT ON public.vacation_camps TO anon;
GRANT ALL ON public.vacation_camps TO service_role;
ALTER TABLE public.vacation_camps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view published camps" ON public.vacation_camps FOR SELECT USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage camps" ON public.vacation_camps FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.vacation_camp_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id uuid NOT NULL REFERENCES public.vacation_camps(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  original_price numeric(10,2),
  max_slots int,
  sold_count int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  payment_methods jsonb NOT NULL DEFAULT '["PIX","BOLETO","CREDIT_CARD"]'::jsonb,
  max_installments int NOT NULL DEFAULT 1,
  due_days int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacation_camp_packages TO authenticated;
GRANT SELECT ON public.vacation_camp_packages TO anon;
GRANT ALL ON public.vacation_camp_packages TO service_role;
ALTER TABLE public.vacation_camp_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view active packages" ON public.vacation_camp_packages FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage packages" ON public.vacation_camp_packages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.vacation_camp_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id uuid NOT NULL REFERENCES public.vacation_camps(id) ON DELETE CASCADE,
  day_label text NOT NULL,
  time_label text,
  title text NOT NULL,
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacation_camp_schedule TO authenticated;
GRANT SELECT ON public.vacation_camp_schedule TO anon;
GRANT ALL ON public.vacation_camp_schedule TO service_role;
ALTER TABLE public.vacation_camp_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view schedule" ON public.vacation_camp_schedule FOR SELECT USING (true);
CREATE POLICY "Admins manage schedule" ON public.vacation_camp_schedule FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.vacation_camp_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id uuid NOT NULL REFERENCES public.vacation_camps(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.vacation_camp_packages(id) ON DELETE SET NULL,
  guardian_name text NOT NULL,
  guardian_phone text NOT NULL,
  guardian_email text,
  guardian_cpf text,
  child_name text NOT NULL,
  child_age int,
  child_birthdate date,
  notes text,
  source text NOT NULL DEFAULT 'landing',
  linked_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  asaas_payment_id text,
  asaas_invoice_url text,
  asaas_pix_payload text,
  asaas_customer_id text,
  amount numeric(10,2),
  payment_method text,
  installments int DEFAULT 1,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacation_camp_enrollments TO authenticated;
GRANT ALL ON public.vacation_camp_enrollments TO service_role;
ALTER TABLE public.vacation_camp_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage enrollments" ON public.vacation_camp_enrollments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER vc_camps_updated BEFORE UPDATE ON public.vacation_camps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vc_packages_updated BEFORE UPDATE ON public.vacation_camp_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vc_schedule_updated BEFORE UPDATE ON public.vacation_camp_schedule FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER vc_enrollments_updated BEFORE UPDATE ON public.vacation_camp_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
