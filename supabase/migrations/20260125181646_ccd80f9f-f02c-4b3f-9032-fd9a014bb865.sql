-- Create canteen_products table (menu items)
CREATE TABLE public.canteen_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'lanche',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create canteen_consumptions table (consumption records)
CREATE TABLE public.canteen_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.canteen_products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  week_reference DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create canteen_weekly_summaries table (weekly reports)
CREATE TABLE public.canteen_weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_value DECIMAL(10,2) NOT NULL,
  items_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.canteen_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteen_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteen_weekly_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for canteen_products
-- Public can view active products (for the external link)
CREATE POLICY "Public can view active products" ON public.canteen_products
  FOR SELECT USING (is_active = true);

-- Authenticated users can view all products
CREATE POLICY "Authenticated users can view all products" ON public.canteen_products
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Authenticated users can manage products
CREATE POLICY "Authenticated users can insert products" ON public.canteen_products
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update products" ON public.canteen_products
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete products" ON public.canteen_products
  FOR DELETE USING (is_admin(auth.uid()));

-- RLS Policies for canteen_consumptions
-- Authenticated users can view consumptions
CREATE POLICY "Authenticated users can view consumptions" ON public.canteen_consumptions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Public can insert consumptions (via edge function with service role)
CREATE POLICY "Service role can insert consumptions" ON public.canteen_consumptions
  FOR INSERT WITH CHECK (true);

-- Authenticated users can update consumptions
CREATE POLICY "Authenticated users can update consumptions" ON public.canteen_consumptions
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Admins can delete consumptions
CREATE POLICY "Admins can delete consumptions" ON public.canteen_consumptions
  FOR DELETE USING (is_admin(auth.uid()));

-- RLS Policies for canteen_weekly_summaries
CREATE POLICY "Authenticated users can view summaries" ON public.canteen_weekly_summaries
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert summaries" ON public.canteen_weekly_summaries
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update summaries" ON public.canteen_weekly_summaries
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete summaries" ON public.canteen_weekly_summaries
  FOR DELETE USING (is_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_canteen_products_updated_at
  BEFORE UPDATE ON public.canteen_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_canteen_weekly_summaries_updated_at
  BEFORE UPDATE ON public.canteen_weekly_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for consumptions (for notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.canteen_consumptions;

-- Create indexes for performance
CREATE INDEX idx_canteen_consumptions_student_id ON public.canteen_consumptions(student_id);
CREATE INDEX idx_canteen_consumptions_week_reference ON public.canteen_consumptions(week_reference);
CREATE INDEX idx_canteen_weekly_summaries_guardian_id ON public.canteen_weekly_summaries(guardian_id);
CREATE INDEX idx_canteen_weekly_summaries_week_start ON public.canteen_weekly_summaries(week_start);