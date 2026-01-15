-- Allow public read access to login_background setting (needed before authentication)
CREATE POLICY "Public can view login_background setting"
ON public.app_settings
FOR SELECT
USING (key = 'login_background' AND is_secret = false);