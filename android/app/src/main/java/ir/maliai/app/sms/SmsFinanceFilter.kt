package ir.maliai.app.sms

object SmsFinanceFilter {
    private val keys = listOf(
        "برداشت", "واریز", "خرید", "مانده", "موجودی", "انتقال",
        "حواله", "حساب", "ریال", "تومان", "بانک", "بانك", "ملي", "ملی",
        "خریداينترنتی", "خریداینترنتی",
    )

    fun looksFinancial(body: String): Boolean = keys.any { body.contains(it) }

    /**
     * LIVE SMS_RECEIVED gate.
     *
     * When the user has verified senders: ONLY those senders pass (no body keyword discard).
     * When none verified yet: do not treat as bank SMS (user must complete verification).
     * Legacy KnownBankSenders is NOT authoritative for live ingest.
     */
    fun looksBankSms(context: android.content.Context, sender: String, body: String): Boolean {
        if (VerifiedSendersStore.hasAny(context)) {
            return VerifiedSendersStore.isVerified(context, sender)
        }
        // No verified senders — block automatic bank pipeline.
        // (Picker / onboarding reads inbox via explicit ContentProvider queries.)
        return false
    }

    /** @deprecated Prefer context-aware looksBankSms */
    fun looksBankSms(sender: String, body: String): Boolean {
        // Without context we cannot check verified store — deny by default.
        return false
    }
}
