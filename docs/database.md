# پایگاه داده

پول همیشه **عدد صحیح ریال** است. شماره کارت کامل و متن خام پیامک در جدول تراکنش ذخیره نمی‌شود.

## محلی

`FinanceSnapshot` روی MMKV (دستگاه) یا حافظه (تست) با همان شکل موجودیت‌ها.

## PostgreSQL (Supabase)

جداول اصلی در `supabase/migrations/0001_init.sql`:

profiles, financial_accounts, transactions, categories, transaction_rules,
budgets, budget_categories, recurring_transactions, bank_connections,
sync_logs, parser_versions, parser_telemetry, ai_insights, notifications, user_settings

ایندکس‌ها روی `user_id` و ترکیب با تاریخ، حساب، fingerprint، دسته.

RLS: هر کاربر فقط دادهٔ خودش را می‌بیند. پروفایل با تریگر `auth.users` ساخته می‌شود.
