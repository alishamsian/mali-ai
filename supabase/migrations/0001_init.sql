-- Mali local-first schema mirrored on Supabase.
-- Apply with: supabase db push  OR  run in SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  bank_id text,
  name text not null,
  card_last4 text,
  balance_rial bigint not null default 0,
  last_sync_at timestamptz,
  transaction_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  label_fa text not null
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid references public.financial_accounts (id) on delete set null,
  type text not null,
  direction text not null,
  amount_rial bigint not null,
  currency text not null default 'IRR',
  merchant text,
  description text,
  category_id text references public.categories (id),
  transaction_date timestamptz not null,
  card_last4 text,
  source text not null,
  source_id text,
  fingerprint text not null,
  confidence numeric,
  is_confirmed boolean not null default false,
  needs_review boolean not null default false,
  transfer_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  matcher text not null,
  category_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period text not null,
  year int not null,
  month int,
  total_limit_rial bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  category_id text not null,
  limit_rial bigint not null
);

create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  merchant text not null,
  amount_rial bigint not null,
  frequency text not null,
  category_id text,
  next_expected_date date
);

create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bank_id text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.parser_versions (
  bank_id text not null,
  version text not null,
  status text not null,
  primary key (bank_id, version)
);

create table if not exists public.parser_telemetry (
  id uuid primary key default gen_random_uuid(),
  bank_id text,
  parser_version text,
  success boolean not null,
  failure_reason text,
  pattern_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  hide_balances boolean not null default false,
  reduced_motion boolean not null default false,
  theme text not null default 'dark',
  notifications_enabled boolean not null default true,
  sms_processing_enabled boolean not null default false
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_user_date_idx on public.transactions (user_id, transaction_date);
create index if not exists transactions_user_account_idx on public.transactions (user_id, account_id);
create index if not exists transactions_user_fingerprint_idx on public.transactions (user_id, fingerprint);
create index if not exists transactions_user_category_idx on public.transactions (user_id, category_id);

alter table public.profiles enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_rules enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_categories enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.bank_connections enable row level security;
alter table public.sync_logs enable row level security;
alter table public.ai_insights enable row level security;
alter table public.notifications enable row level security;
alter table public.user_settings enable row level security;

create policy "own_profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own_accounts" on public.financial_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_tx" on public.transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_rules" on public.transaction_rules for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_budgets" on public.budgets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_budget_cats" on public.budget_categories for all
  using (exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid()));
create policy "own_recurring" on public.recurring_transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_banks" on public.bank_connections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_sync" on public.sync_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_insights" on public.ai_insights for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_notes" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_settings" on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'کاربر'));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
