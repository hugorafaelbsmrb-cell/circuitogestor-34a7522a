
-- 1) Camp album config columns
ALTER TABLE public.vacation_camps
  ADD COLUMN IF NOT EXISTS album_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS album_logo_url text,
  ADD COLUMN IF NOT EXISTS album_frame_color text DEFAULT '#f97316',
  ADD COLUMN IF NOT EXISTS album_title text,
  ADD COLUMN IF NOT EXISTS album_welcome_message text;

-- 2) Photos table
CREATE TABLE IF NOT EXISTS public.vacation_camp_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id uuid NOT NULL REFERENCES public.vacation_camps(id) ON DELETE CASCADE,
  external_url text NOT NULL,
  external_path text,
  thumbnail_url text,
  day_label text,
  activity_tag text,
  schedule_id uuid REFERENCES public.vacation_camp_schedule(id) ON DELETE SET NULL,
  has_watermark boolean NOT NULL DEFAULT false,
  has_frame boolean NOT NULL DEFAULT false,
  width integer,
  height integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vacation_camp_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacation_camp_photos TO authenticated;
GRANT ALL ON public.vacation_camp_photos TO service_role;

ALTER TABLE public.vacation_camp_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view photos of enabled albums"
  ON public.vacation_camp_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vacation_camps c
      WHERE c.id = vacation_camp_photos.camp_id
        AND c.album_enabled = true
    )
  );

CREATE POLICY "Admins manage photos"
  ON public.vacation_camp_photos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS vacation_camp_photos_camp_idx ON public.vacation_camp_photos(camp_id, created_at DESC);

CREATE TRIGGER update_vacation_camp_photos_updated_at
  BEFORE UPDATE ON public.vacation_camp_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Settings keys (idempotent)
INSERT INTO public.app_settings (key, value, description, is_secret)
VALUES
  ('PHOTO_API_URL', 'https://api.circuitokids.com.br', 'URL base da API de hospedagem de fotos (Circuito Kids / hospedagemcpanel)', false),
  ('PHOTO_API_KEY', '', 'Chave da API de hospedagem de fotos (X-API-Key)', true),
  ('PHOTO_API_COMPANY_SLUG', '', 'Slug da empresa na API de hospedagem (ex: circuito-kids)', false)
ON CONFLICT (key) DO NOTHING;
