-- Create storage bucket for system branding
INSERT INTO storage.buckets (id, name, public)
VALUES ('system-branding', 'system-branding', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public can view system branding"
ON storage.objects
FOR SELECT
USING (bucket_id = 'system-branding');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload system branding"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'system-branding' AND auth.role() = 'authenticated');

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update system branding"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'system-branding' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete system branding"
ON storage.objects
FOR DELETE
USING (bucket_id = 'system-branding' AND auth.role() = 'authenticated');

-- Allow public read access to system_name and system_logo settings
CREATE POLICY "Public can view system branding settings"
ON public.app_settings
FOR SELECT
USING (key IN ('system_name', 'system_logo') AND is_secret = false);