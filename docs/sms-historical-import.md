# SMS historical import & Parser Lab

## Why messages were missed

1. Inbox scan capped at **200** financial hits / **1200** raw rows.
2. Native filter required a **known sender** OR (`بانک` + `مانده/حساب`).
3. `detectBank` only gave **+0.25** for keywords — below the **0.6** match threshold without a known sender.
4. Unmatched financial SMS were **`ignored`** (not recorded as unknown diagnostics).

## 30-day historical scan

`runHistoricalSmsImport` (`src/features/sms/import/historicalImport.ts`):

- Window = exactly previous `days * 24h` (default 30), not calendar month.
- Native `readInboxBatch(minDate, maxDate, offset, limit)` pages inbox **without** sender-only filter.
- Each page → `looksFinancialCandidate` → existing `ingestSms` / `runSmsPipeline`.
- Progress + cancel; already-imported txs kept on cancel.
- Settings: `lastHistoricalImportAt`, `lastImportedSmsId`, `lastImportedTimestamp`.

Manual UI (dev): **Profile → آزمایشگاه پارسر پیامک** → «بررسی مجدد پیامک‌های ۳۰ روز اخیر».

## Multiple senders / formats

- Sender is **one** signal; strong body keywords (e.g. `بانک ملت`) also match.
- Unknown senders collected as `verified: false` candidates during import.
- Formats grouped by `patternHash` → `format-{hash8}`.

## Duplicates

- Exact fingerprint (existing).
- Fuzzy window (existing).
- `sourceSmsId` (Android `_id`) when present.
- Historical re-run returns `duplicate` / updates date twin — does not double-create.

## Unknown SMS

Stored locally in `snapshot.unknownSms` with:

`failureReason`, `patternHash`, `sanitizedMessage`, `formatId`, `sourceSmsId`.

Reasons include: `bank_not_detected`, `unknown_format`, `amount_not_detected`, `PARSER_CONFLICT`.

Raw SMS is **never** synced/uploaded.

## Adding a real fixture

1. Paste SMS in Parser Lab → Sanitize → Privacy scan must pass.
2. Confirm parse result.
3. Write JSON under `tests/fixtures/sms/<bank>/<type>/` with `status: "real"` and **sanitized** message only.
4. Never commit raw cards / IBAN / OTP / phone.
5. Run `npm run sms:test`.

## Tests

```bash
npm test -- --testPathPattern=sms
npm run sms:test
```

## Privacy

- Sanitizer: `src/features/sms/privacy/sanitize.ts`
- Scanner blocks fixture export if sensitive data remains.
- Production UI does not expose Parser Lab (`__DEV__` only).
