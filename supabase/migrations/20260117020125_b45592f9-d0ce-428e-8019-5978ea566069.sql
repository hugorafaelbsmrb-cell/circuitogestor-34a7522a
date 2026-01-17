-- Create asset_categories table
CREATE TABLE public.asset_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  depreciation_rate NUMERIC DEFAULT 0,
  useful_life_years INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view asset_categories"
ON public.asset_categories
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert asset_categories"
ON public.asset_categories
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update asset_categories"
ON public.asset_categories
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete asset_categories"
ON public.asset_categories
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_asset_categories_updated_at
BEFORE UPDATE ON public.asset_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.asset_categories (name, description, depreciation_rate, useful_life_years) VALUES
('Móveis e Utensílios', 'Mesas, cadeiras, armários, estantes', 10, 10),
('Equipamentos de Informática', 'Computadores, notebooks, impressoras', 20, 5),
('Equipamentos de Áudio/Vídeo', 'TVs, projetores, caixas de som', 20, 5),
('Veículos', 'Carros, motos, vans', 20, 5),
('Máquinas e Equipamentos', 'Equipamentos industriais e de produção', 10, 10),
('Instalações', 'Instalações elétricas, hidráulicas', 10, 10),
('Edificações', 'Prédios, construções', 4, 25),
('Outros', 'Outros ativos não classificados', 10, 10);