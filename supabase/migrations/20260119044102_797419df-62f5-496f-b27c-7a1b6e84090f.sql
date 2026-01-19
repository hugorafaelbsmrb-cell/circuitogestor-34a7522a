-- Drop the current leads delete policy that allows any authenticated user
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;

-- Create new policy that only allows admins to delete leads
CREATE POLICY "Admins can delete leads" 
ON public.leads 
FOR DELETE 
USING (is_admin(auth.uid()));