-- Allow public access to active students for canteen selection
CREATE POLICY "Public can view active students for canteen" 
ON public.students 
FOR SELECT 
USING (is_active = true);