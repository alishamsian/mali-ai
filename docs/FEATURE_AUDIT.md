# چک‌لیست Feature Audit — پولت v1.13.x

راهنمای تست دستی قبل از انتشار. هر مورد را روی دستگاه/امولاتور واقعی بزنید.

## ناوبری اصلی (تب‌ها)

| مسیر | دکمه/اکشن | انتظار |
|------|-----------|--------|
| خانه | تب خانه | داشبورد، کارت‌ها، تراکنش‌های اخیر |
| خانه | «همه» تراکنش‌ها | `Transactions` stack |
| روزانه | تب روزانه | تقویم روز، لیست تراکنش |
| + (FAB) | دکمه وسط | `AddTransaction` |
| خزانه | تب خزانه | دارایی‌ها و حساب‌ها |
| بیشتر | تب بیشتر | هاب ابزارها |

## بیشتر → برنامه‌ریزی / بینش

| مسیر | انتظار |
|------|--------|
| تحلیل | `Analytics` — نمودار، insight یک‌خطی |
| بودجه | `Budgets` |
| تراکنش‌ها | `Transactions` + فیلتر bottom sheet |
| بینش / Recap / تقویم | `Insights`, `Recap`, `Calendar` |
| دستیار | `Assistant` |

## SMS و بانک

| مسیر | انتظار |
|------|--------|
| آنبوردینگ SMS | `SmsOnboarding` بدون کرش |
| انتخاب فرستنده | `SmsSenderPicker` — FlashList، EmptyState |
| تأیید فرستنده | `SmsSenderConfirm` |
| مدیریت فرستندگان | `BankSendersManage` |
| صندوق بررسی | `ReviewInbox` — تأیید/حذف/رد |
| تنظیمات → بانک و SMS | `SettingsBanksSms` |

## تراکنش‌ها

| اکشن | انتظار |
|------|--------|
| جستجو | فیلتر متنی |
| سگمنت همه/هزینه/درآمد/انتقال | فیلتر نوع |
| آیکن فیلتر | bottom sheet — دوره، حساب، دسته، مبلغ |
| badge فیلتر | تعداد فیلترهای فعال |
| CSV | اشتراک‌گذاری |
| pull-to-refresh | اسکن SMS |
| ردیف تراکنش | `TransactionDetails` |

## تنظیمات (Control Center)

| بخش | مسیر | نکته |
|-----|------|------|
| پروفایل | `AccountProfile` | Surface بالای صفحه |
| جستجو | — | نتایج از catalog |
| SMS | `SettingsBanksSms` | وضعیت on/off |
| ثروت | `SettingsAccounts` | |
| برنامه‌ریزی | `SettingsBudgets` | |
| امنیت | `SettingsSecurity` | قفل اپ |
| اعلان | `SettingsNotifications` | |
| ظاهر | `SettingsAppearance` | تم + reduced motion |
| پشتیبان | `SettingsBackup` | |
| درباره | `SettingsAbout` | |
| dev | `SettingsDeveloper` | فقط `__DEV__` |

## استک‌های پنهان / عمیق

| Route | ورود معمول |
|-------|------------|
| `Goals` | تنظیمات بودجه یا بیشتر |
| `Recurring` | بینش |
| `Privacy` | تنظیمات / آنبوردینگ |
| `Notifications` | تنظیمات |
| `CinematicBalance` | لحظه خزانه |
| `AssetDetail` / `AddWealthAsset` | خزانه |
| `SmsParserLab` | dev |
| `Auth` | ورود ابری |

## Motion و دسترسی

- [ ] تنظیمات → ظاهر → **کاهش حرکت**: انیمیشن ناوبری و modal خاموش
- [ ] سیستم‌عامل reduced motion: هم‌تراز با `AppMotionBridge`
- [ ] Skeleton بدون پالس وقتی reduced فعال است

## Virtualization (لیست‌های سنگین)

| صفحه | لیست |
|------|------|
| `TransactionsScreen` | FlashList + `estimatedItemSize` |
| `SmsSenderPickerScreen` | FlashList |
| `ReviewInboxScreen` | FlashList |
| `DailyLedgerScreen` | FlashList (حالت بدون گروه) |

## رگرسیون‌های شناخته‌شده — چک کنید

- [ ] آنبوردینگ اسلاید ۲ — بدون کرش (VIBRATE)
- [ ] مهمان: ۳ تراکنش نمونه
- [ ] RTL متن‌ها راست‌چین
- [ ] قفل اپ بعد از background
- [ ] sync banner SMS هنگام اسکن

---

آخرین به‌روزرسانی: بسته UI/UX v1.13 — فیلتر شیت، motion سراسری، FlashList audit.
