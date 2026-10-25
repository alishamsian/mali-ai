# مالی (Mali)

اپ Android مدیریت مالی شخصی با ثبت خودکار تراکنش از پیامک بانکی (معماری جدا از SMS).

## پیش‌نیاز

- Node 20+
- JDK 17 و Android SDK برای بیلد نیتیو
- فونت Vazirmatn در `assets/fonts`

## نصب

```bash
npm install
npx react-native-asset
```

## اجرا روی Android

```bash
npx react-native start
npx react-native run-android
```

اگر متن‌ها سمت چپ افتادند، یک‌بار اپ را کاملاً ببندید و دوباره باز کنید
(یا در صورت نیاز Uninstall کنید). قبلاً `forceRTL` ممکن است در دستگاه ذخیره شده باشد.

## تست و کیفیت

```bash
npm test
npm run typecheck
npm run lint
```

## Supabase

1. پروژه بسازید و `supabase/migrations/0001_init.sql` را اجرا کنید.
2. `.env.example` را کپی کنید:

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

کلید service role را در اپ نگذارید. بدون این مقادیر، اپ آفلاین کار می‌کند.

## وضعیت پارس بانک‌ها

ملت، ملی، سامان، تجارت، پاسارگاد: اسکلت آماده، **منتظر SMS واقعی** (`NEEDS_FIXTURES`).

پارس عمومی فقط روی کلیدواژه‌های فارسی (برداشت/واریز/خرید/...) کار می‌کند و ادعا نمی‌کند قالب رسمی بانک است.
