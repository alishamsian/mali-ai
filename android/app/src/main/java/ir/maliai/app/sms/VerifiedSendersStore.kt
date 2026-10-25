package ir.maliai.app.sms

import android.content.Context
import org.json.JSONArray

/**
 * User-verified (or migrated) bank SMS senders mirrored from JS.
 * Empty list = no verified senders yet → live SMS must not assume bank trust.
 */
object VerifiedSendersStore {
    private const val PREFS = "mali_sms_verified_senders"
    private const val KEY = "senders_json"

    fun setSenders(context: Context, senders: List<String>) {
        val arr = JSONArray()
        for (s in senders) {
            val n = normalize(s)
            if (n.isNotEmpty()) {
                arr.put(n)
            }
        }
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY, arr.toString())
            .apply()
    }

    fun getSenders(context: Context): List<String> {
        val raw = context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, "[]") ?: "[]"
        return try {
            val arr = JSONArray(raw)
            buildList {
                for (i in 0 until arr.length()) {
                    val n = normalize(arr.optString(i))
                    if (n.isNotEmpty()) add(n)
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun hasAny(context: Context): Boolean = getSenders(context).isNotEmpty()

    fun isVerified(context: Context, sender: String): Boolean {
        val needle = normalize(sender)
        if (needle.isEmpty()) return false
        return getSenders(context).any { known ->
            needle == known ||
                (known.length >= 4 && needle.contains(known)) ||
                (needle.length >= 4 && known.contains(needle))
        }
    }

    fun normalize(raw: String): String {
        return raw.trim()
            .lowercase()
            .replace("+", "")
            .replace(Regex("^00"), "")
            .replace(Regex("[\\s\\-_.]"), "")
    }
}
