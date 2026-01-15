-- Create storage bucket for login backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('login-backgrounds', 'login-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public can view login backgrounds"
ON storage.objects
FOR SELECT
USING (bucket_id = 'login-backgrounds');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload login backgrounds"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'login-backgrounds' AND auth.role() = 'authenticated');

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update login backgrounds"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'login-backgrounds' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete login backgrounds"
ON storage.objects
FOR DELETE
USING (bucket_id = 'login-backgrounds' AND auth.role() = 'authenticated');