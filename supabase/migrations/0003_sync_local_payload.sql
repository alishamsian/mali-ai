-- Full local records for restore. The typed columns cannot hold everything the app keeps
-- (bank balance after each SMS, SMS ids used for de-duplication, wealth details), so a
-- restore from the columns alone would be lossy. local_id is the app's own id.
alter table public.transactions add column if not exists local_id text;
alter table public.transactions add column if not exists payload jsonb;
alter table public.financial_accounts add column if not exists local_id text;
alter table public.financial_accounts add column if not exists payload jsonb;
