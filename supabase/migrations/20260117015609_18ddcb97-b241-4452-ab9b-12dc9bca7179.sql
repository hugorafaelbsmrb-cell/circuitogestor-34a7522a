-- Create fixed_assets table for inventory management
CREATE TABLE public.fixed_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  acquisition_date DATE NOT NULL,
  acquisition_value NUMERIC NOT NULL,
  current_value NUMERIC,
  location TEXT,
  condition TEXT NOT NULL DEFAULT 'good',
  status TEXT NOT NULL DEFAULT 'active',
  depreciation_rate NUMERIC DEFAULT 0,
  useful_life_years INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view fixed_assets"
ON public.fixed_assets
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert fixed_assets"
ON public.fixed_assets
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update fixed_assets"
ON public.fixed_assets
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete fixed_assets"
ON public.fixed_assets
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_fixed_assets_updated_at
BEFORE UPDATE ON public.fixed_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();