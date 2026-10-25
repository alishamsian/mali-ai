# معماری مالی

اپ **مالی** یک محصول local-first برای مدیریت مالی شخصی در ایران است.

## اصل جداسازی منبع از موتور

موتور مالی به SMS وابسته نیست. هر منبع یک آداپتور است:

`android_sms` → `ios_message_filter` → `open_banking` → `csv` → `manual`

همه به `Transaction` نرمال‌شده می‌رسند.

## خط لوله SMS

Source Adapter → Raw Input → Preprocessor → Bank Detector → Parser →
Normalizer → Validator → Duplicate Detector → Transfer Detector →
Category Engine → Transaction Engine → Database → Analytics / Budget / Insights

## لایه‌ها

- `src/features/sms` پارس و بومی Android
- `src/engine` منطق مالی خالص (بدون React)
- `src/database` ذخیره محلی + صف همگام‌سازی
- `src/services/supabase` همگام‌سازی اختیاری
- UI در `src/features/*/screens`

## اطمینان (confidence)

- `>= 0.90` ثبت خودکار
- `0.60–0.90` ثبت با نیاز به بررسی
- `< 0.60` صف در انتظار / unknown

پارسِ بانک‌محور بدون فیکسچر واقعی `NEEDS_FIXTURES` است. پارس عمومی فقط کلیدواژه‌های فارسی رایج را با اطمینان پایین‌تر استخراج می‌کند.

## همگام‌سازی

UI فوراً از SQLite/حافظه محلی به‌روز می‌شود. `SyncQueue` با backoff نمایی به Supabase می‌رود.
