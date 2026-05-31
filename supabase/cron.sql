-- NoiDue — Cron job per i promemoria push
-- Esegui questo nel pannello Supabase -> SQL Editor (una volta sola).
-- Ogni 5 minuti chiama l'Edge Function "push" in modalità "cron",
-- che scansiona i promemoria scaduti e invia le notifiche.

-- 1) Abilita le estensioni necessarie (idempotente)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) (Opzionale ma consigliato) rimuovi un eventuale job omonimo precedente
select cron.unschedule('noidue-reminders')
where exists (select 1 from cron.job where jobname = 'noidue-reminders');

-- 3) Pianifica il job: ogni 5 minuti
select cron.schedule(
  'noidue-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://vyorlvfqwaxrrstfxhtx.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer sb_publishable_dkU7rcUQFxNg2_aWHcerbg_beT04-92'
    ),
    body    := jsonb_build_object('mode', 'cron')
  );
  $$
);

-- --- Comandi utili ---------------------------------------------------------
-- Vedere i job attivi:
--   select jobid, jobname, schedule, active from cron.job;
-- Vedere gli ultimi run:
--   select * from cron.job_run_details order by start_time desc limit 10;
-- Disattivare il job:
--   select cron.unschedule('noidue-reminders');
