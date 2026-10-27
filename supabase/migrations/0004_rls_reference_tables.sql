-- 0001 left three tables without Row Level Security. The anon key ships inside the app,
-- so without RLS anyone could read and write them through the REST API.

-- Reference data: signed-in users may read; only the service role writes.
alter table public.categories enable row level security;
alter table public.parser_versions enable row level security;
drop policy if exists "read_categories" on public.categories;
create policy "read_categories" on public.categories for select to authenticated using (true);
drop policy if exists "read_parser_versions" on public.parser_versions;
create policy "read_parser_versions" on public.parser_versions for select to authenticated using (true);

-- Telemetry: no client policies; only the service role (server side) can touch it.
alter table public.parser_telemetry enable row level security;
