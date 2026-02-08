-- Create cron job to run scheduled-notifications daily at 9:00 AM (Brasilia time = 12:00 UTC)
SELECT cron.schedule(
  'run-scheduled-notifications-daily',
  '0 12 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://akxpcfqcasuabxbwyrew.supabase.co/functions/v1/scheduled-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFreHBjZnFjYXN1YWJ4Ynd5cmV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5OTQ2OTksImV4cCI6MjA4MzU3MDY5OX0.i8o_GrdfMlNClnly4s87jx-ACgh1XFi18hpBhJNlmbU"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);