-- Category ids come from the app (src/types/finance.ts CategoryId) and public.categories
-- is never seeded, so the foreign key rejected every synced transaction that had a category.
alter table public.transactions drop constraint if exists transactions_category_id_fkey;
