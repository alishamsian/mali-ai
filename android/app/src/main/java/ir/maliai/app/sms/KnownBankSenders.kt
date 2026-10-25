package ir.maliai.app.sms

/**
 * Known bank sender fragments for inbox queries (not the live SMS gate).
 * Keep in sync with JS BANK_SENDER_ALIASES — text aliases only; no invented numeric codes.
 */
object KnownBankSenders {
    val ALL: List<String> = listOf(
        // verified numeric senders (fixtures)
        "9909", "9980", "9830009417", "983000",
        // bank ids + legacy text aliases
        "melli", "bmi", "mellat", "tejarat", "saderat", "bsi", "sepah",
        "keshavarzi", "maskan", "refah", "postbank", "sanat", "madan",
        "tosee", "taavon", "saman", "pasargad", "bpi", "parsian",
        "enbank", "eghtesad", "shahr", "ayandeh", "dey", "sina",
        "karafarin", "gardeshgari", "tourism", "iranzamin", "iran_zamin",
        "khavarmiyaneh", "middleeast", "biv", "iran_venezuela",
        "resalat", "mehr", "mehr_iran", "blu", "blubank",
        "ghavamin", "ansar", "hekmat", "kosar", "mehr_eghtesad", "tat",
    )

    fun isKnown(sender: String): Boolean {
        val s = sender.lowercase()
        return ALL.any { s.contains(it.lowercase()) }
    }
}
