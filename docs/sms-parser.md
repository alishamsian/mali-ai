# پارسر پیامک بانکی

See also: [sms-historical-import.md](./sms-historical-import.md) for 30-day import & Parser Lab.

## چرخه حیات

1. `SmsReceiver` فقط پیام‌هایی را که کلیدواژه مالی دارند به JS می‌فرستد.
2. `preprocessSms` ارقام، ویرگول، ی/ک، ZWNJ و یونیکد پنهان را نرمال می‌کند.
3. `detectBank` از فرستنده + کلیدواژهٔ قوی بانک استفاده می‌کند؛ زیر آستانه ۰٫۶ حدس نمی‌زند.
4. اگر پارسِ بانک `ok` و فیکسچر داشته باشد، همان استفاده می‌شود.
5. در غیر این صورت `parseGenericBankSms` با اطمینان حداکثر حدود ۰٫۸۴.
6. fingerprint (SHA-256) + `sourceSmsId` + تطبیق فازی در پنجره زمانی.
7. پیام ناشناخته: `patternHash` + `sanitizedMessage` محلی بدون آپلود متن خام.

## اسکن ۳۰ روز

`runHistoricalSmsImport` کل اینباکس بازهٔ `days*24h` را صفحه‌به‌صفحه می‌خواند (بدون truncate مخفی) و همان `ingestSms` را صدا می‌زند.

## افزودن بانک جدید

1. چند پیام واقعی sanitized در `tests/fixtures/sms/<bank>/` بگذارید.
2. `detector` / `patterns` / `parser` را از روی همان نمونه‌ها بنویسید.
3. `npm run sms:test` باید سبز شود.
4. `status` را از `NEEDS_FIXTURES` به `ok` تغییر دهید.

**قالب پیامک بانک را حدس نزنید.**
