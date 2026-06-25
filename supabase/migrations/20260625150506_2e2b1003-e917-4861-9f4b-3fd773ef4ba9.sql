
ALTER TABLE public.vacation_camp_enrollments
  ADD COLUMN IF NOT EXISTS reserved_payment_date DATE,
  ADD COLUMN IF NOT EXISTS reservation_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vce_reserved_date
  ON public.vacation_camp_enrollments(reserved_payment_date)
  WHERE reserved_payment_date IS NOT NULL AND reservation_sent_at IS NULL;

-- Cron diário para disparar reservas (09:00 BRT = 12:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('vacation-camp-send-reservations-daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='vacation-camp-send-reservations-daily');
    PERFORM cron.schedule(
      'vacation-camp-send-reservations-daily',
      '0 12 * * *',
      $cmd$
      SELECT net.http_post(
        url := 'https://akxpcfqcasuabxbwyrew.supabase.co/functions/v1/vacation-camp-send-reservations',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb
      );
      $cmd$
    );
  END IF;
END$$;
