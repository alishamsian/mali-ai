package ir.maliai.app.sms

import android.content.Context

object SmsPendingStore {
    private const val PREF = "mali_sms_pending"
    private const val KEY_ITEMS = "items"
    private const val KEY_RESCAN = "rescan"

    fun markRescan(context: Context) {
        context
            .getSharedPreferences(PREF, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_RESCAN, true)
            .remove(KEY_ITEMS)
            .apply()
    }

    fun consumeRescan(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        val need = prefs.getBoolean(KEY_RESCAN, false)
        prefs.edit().putBoolean(KEY_RESCAN, false).remove(KEY_ITEMS).apply()
        return need
    }

    fun drainLegacyBodies(context: Context): org.json.JSONArray {
        val prefs = context.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        val arr = org.json.JSONArray(prefs.getString(KEY_ITEMS, "[]"))
        prefs.edit().remove(KEY_ITEMS).apply()
        return arr
    }
}
