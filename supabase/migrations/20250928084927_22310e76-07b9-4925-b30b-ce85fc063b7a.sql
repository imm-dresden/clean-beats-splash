-- Set up a cron job to automatically reset overdue streaks daily at midnight
SELECT cron.schedule(
  'auto-reset-streaks-daily',
  '0 0 * * *', -- Run daily at midnight UTC
  $$
  SELECT
    net.http_post(
      url := 'https://zvaslazcmocjditstuxw.supabase.co/functions/v1/auto-reset-streaks',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YXNsYXpjbW9jamRpdHN0dXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNzQ5MzIsImV4cCI6MjA3MTk1MDkzMn0.LlE4ylI-4prUzZOl5l0vNrxUC2COBOGez5hGYVCoRBc"}'::jsonb,
      body := '{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);