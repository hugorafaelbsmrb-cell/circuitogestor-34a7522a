-- Update RLS policy to allow public access to all branding settings
DROP POLICY IF EXISTS "Public can view branding settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public can view system branding settings" ON public.app_settings;

CREATE POLICY "Public can view all branding settings"
ON public.app_settings
FOR SELECT
TO anon, public
USING (
  key IN ('system_name', 'system_logo', 'system_favicon', 'system_browser_title', 'login_background')
  AND is_secret = false
);

-- Drop duplicate login_background policy if exists
DROP POLICY IF EXISTS "Public can view login_background setting" ON public.app_settings;