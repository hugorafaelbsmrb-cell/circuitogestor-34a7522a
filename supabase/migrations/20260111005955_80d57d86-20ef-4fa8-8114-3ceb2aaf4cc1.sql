-- Create discounts table
CREATE TABLE public.discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  value NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- Create policy for read access (public read)
CREATE POLICY "Discounts are viewable by everyone" 
ON public.discounts 
FOR SELECT 
USING (true);

-- Create policy for insert (allow all for now - should be admin only in production)
CREATE POLICY "Allow insert discounts" 
ON public.discounts 
FOR INSERT 
WITH CHECK (true);

-- Create policy for update
CREATE POLICY "Allow update discounts" 
ON public.discounts 
FOR UPDATE 
USING (true);

-- Create policy for delete
CREATE POLICY "Allow delete discounts" 
ON public.discounts 
FOR DELETE 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_discounts_updated_at
BEFORE UPDATE ON public.discounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default discounts
INSERT INTO public.discounts (name, description, type, value) VALUES
('Desconto Irmão', 'Desconto para irmãos matriculados', 'percentage', 10),
('Desconto Funcionário', 'Desconto para filhos de funcionários', 'percentage', 20),
('Desconto Antecipação', 'Desconto para pagamento antecipado', 'percentage', 5),
('Desconto Promocional', 'Promoção especial', 'fixed', 50);