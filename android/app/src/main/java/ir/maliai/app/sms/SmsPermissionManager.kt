package ir.maliai.app.sms

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray

class SmsPermissionManager(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    override fun getName(): String = "MaliSmsModule"

    override fun initialize() {
        super.initialize()
        SmsParserBridge.reactContext = ctx
    }

    @ReactMethod
    fun startListening() {
        SmsParserBridge.reactContext = ctx
    }

    @ReactMethod
    fun stopListening() {
        // Receiver remains declared; JS unsubscribes from events.
    }

    @ReactMethod
    fun hasPermission(promise: Promise) {
        val receive = ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECEIVE_SMS) ==
            PackageManager.PERMISSION_GRANTED
        val read = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED
        promise.resolve(receive && read)
    }

    @ReactMethod
    fun setVerifiedSenders(senders: com.facebook.react.bridge.ReadableArray, promise: Promise) {
        try {
            val list = mutableListOf<String>()
            for (i in 0 until senders.size()) {
                val s = senders.getString(i) ?: continue
                list.add(s)
            }
            VerifiedSendersStore.setSenders(ctx, list)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("E_SMS_VERIFIED", e)
        }
    }

    /**
     * Quick Scan only: verified-sender filtered, capped.
     * Do NOT use for incremental/historical recovery.
     */
    @ReactMethod
    fun readInbox(limit: Int, promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            promise.reject("E_SMS_PERMISSION", "READ_SMS not granted")
            return
        }
        try {
            val cap = if (limit <= 0) 200 else limit.coerceAtMost(500)
            val verified = VerifiedSendersStore.getSenders(ctx)
            if (verified.isEmpty()) {
                promise.resolve(Arguments.createArray())
                return
            }
            val cursor = ctx.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                PROJECTION,
                null,
                null,
                Telephony.Sms.DATE + " DESC",
            )
            val arr = Arguments.createArray()
            if (cursor != null) {
                var n = 0
                var scanned = 0
                while (cursor.moveToNext() && n < cap && scanned < 5000) {
                    scanned += 1
                    val sender = cursor.getString(1) ?: ""
                    val body = cursor.getString(2) ?: continue
                    if (!VerifiedSendersStore.isVerified(ctx, sender)) {
                        continue
                    }
                    arr.pushMap(rowToMap(cursor, body))
                    n += 1
                }
                cursor.close()
            }
            promise.resolve(arr)
        } catch (e: Exception) {
            promise.reject("E_SMS_INBOX", e)
        }
    }

    /**
     * Generic date-range page (all senders). No finance filter.
     * Prefer [readBankSenderBatch] for reliable bank recovery.
     */
    @ReactMethod
    fun readInboxBatch(minDateMs: Double, maxDateMs: Double, offset: Int, limit: Int, promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            promise.reject("E_SMS_PERMISSION", "READ_SMS not granted")
            return
        }
        try {
            val pageSize = if (limit <= 0) 200 else limit.coerceAtMost(500)
            val safeOffset = offset.coerceAtLeast(0)
            val selection = "${Telephony.Sms.DATE} >= ? AND ${Telephony.Sms.DATE} <= ?"
            val args = arrayOf(
                minDateMs.toLong().toString(),
                maxDateMs.toLong().toString(),
            )
            // ASC for stable chronological processing
            val cursor = ctx.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                PROJECTION,
                selection,
                args,
                "${Telephony.Sms.DATE} ASC, ${Telephony.Sms._ID} ASC LIMIT $pageSize OFFSET $safeOffset",
            )
            promise.resolve(cursorToArray(cursor))
        } catch (e: Exception) {
            promise.reject("E_SMS_INBOX_BATCH", e)
        }
    }

    /**
     * Sender-based paginated scan — NO body keyword filter.
     * Returns ALL SMS from the given address fragment in [minDateMs, maxDateMs].
     * pageSize is NOT a total cap; caller paginates until empty.
     */
    @ReactMethod
    fun readBankSenderBatch(
        sender: String,
        minDateMs: Double,
        maxDateMs: Double,
        offset: Int,
        limit: Int,
        promise: Promise,
    ) {
        val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            promise.reject("E_SMS_PERMISSION", "READ_SMS not granted")
            return
        }
        val needle = sender.trim()
        if (needle.isEmpty()) {
            promise.resolve(Arguments.createArray())
            return
        }
        try {
            val pageSize = if (limit <= 0) 200 else limit.coerceAtMost(500)
            val safeOffset = offset.coerceAtLeast(0)
            val selection =
                "${Telephony.Sms.DATE} >= ? AND ${Telephony.Sms.DATE} <= ? AND ${Telephony.Sms.ADDRESS} LIKE ?"
            val args = arrayOf(
                minDateMs.toLong().toString(),
                maxDateMs.toLong().toString(),
                "%$needle%",
            )
            val cursor = ctx.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                PROJECTION,
                selection,
                args,
                "${Telephony.Sms.DATE} ASC, ${Telephony.Sms._ID} ASC LIMIT $pageSize OFFSET $safeOffset",
            )
            promise.resolve(cursorToArray(cursor))
        } catch (e: Exception) {
            promise.reject("E_SMS_BANK_SENDER_BATCH", e)
        }
    }

    /**
     * One pass over the inbox since [minDateMs], newest first, without moving every body
     * across the bridge: per sender, its message count, how many arrived since [recentFromMs],
     * and its [perSender] newest messages (enough to tell a bank from anyone else).
     */
    @ReactMethod
    fun readSenderSamples(minDateMs: Double, recentFromMs: Double, perSender: Int, promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            promise.reject("E_SMS_PERMISSION", "READ_SMS not granted")
            return
        }
        try {
            val keep = perSender.coerceIn(1, 10)
            val recentFrom = recentFromMs.toLong()
            val counts = LinkedHashMap<String, IntArray>()
            val samples = HashMap<String, WritableArray>()
            ctx.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                PROJECTION,
                "${Telephony.Sms.DATE} >= ?",
                arrayOf(minDateMs.toLong().toString()),
                "${Telephony.Sms.DATE} DESC",
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val sender = cursor.getString(1) ?: continue
                    val c = counts.getOrPut(sender) { IntArray(3) }
                    c[0] += 1
                    if (cursor.getLong(3) >= recentFrom) c[1] += 1
                    if (c[2] < keep) {
                        val body = cursor.getString(2) ?: continue
                        samples.getOrPut(sender) { Arguments.createArray() }.pushMap(rowToMap(cursor, body))
                        c[2] += 1
                    }
                }
            }
            val out = Arguments.createArray()
            for ((sender, c) in counts) {
                val map = Arguments.createMap()
                map.putString("sender", sender)
                map.putInt("count", c[0])
                map.putInt("recentCount", c[1])
                map.putArray("rows", samples[sender] ?: Arguments.createArray())
                out.pushMap(map)
            }
            promise.resolve(out)
        } catch (e: Exception) {
            promise.reject("E_SMS_SENDER_SAMPLES", e)
        }
    }

    @ReactMethod
    fun countInboxInRange(minDateMs: Double, maxDateMs: Double, promise: Promise) {
        countWithSelection(
            "${Telephony.Sms.DATE} >= ? AND ${Telephony.Sms.DATE} <= ?",
            arrayOf(minDateMs.toLong().toString(), maxDateMs.toLong().toString()),
            promise,
        )
    }

    @ReactMethod
    fun countBankSenderInRange(sender: String, minDateMs: Double, maxDateMs: Double, promise: Promise) {
        val needle = sender.trim()
        if (needle.isEmpty()) {
            promise.resolve(0)
            return
        }
        countWithSelection(
            "${Telephony.Sms.DATE} >= ? AND ${Telephony.Sms.DATE} <= ? AND ${Telephony.Sms.ADDRESS} LIKE ?",
            arrayOf(
                minDateMs.toLong().toString(),
                maxDateMs.toLong().toString(),
                "%$needle%",
            ),
            promise,
        )
    }

    /** Resolve inbox _id shortly after SMS_RECEIVED (best-effort). */
    @ReactMethod
    fun findRecentInboxId(sender: String, body: String, withinMs: Double, promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            promise.resolve(null)
            return
        }
        try {
            val since = (System.currentTimeMillis() - withinMs.toLong().coerceAtLeast(5_000L)).toString()
            val selection =
                "${Telephony.Sms.DATE} >= ? AND ${Telephony.Sms.ADDRESS} LIKE ? AND ${Telephony.Sms.BODY} = ?"
            val args = arrayOf(since, "%${sender.trim()}%", body)
            val cursor = ctx.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                arrayOf(Telephony.Sms._ID),
                selection,
                args,
                "${Telephony.Sms.DATE} DESC, ${Telephony.Sms._ID} DESC LIMIT 1",
            )
            var id: String? = null
            if (cursor != null) {
                if (cursor.moveToFirst()) {
                    id = cursor.getLong(0).toString()
                }
                cursor.close()
            }
            promise.resolve(id)
        } catch (_: Exception) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun drainPending(promise: Promise) {
        try {
            val raw = SmsPendingStore.drainLegacyBodies(ctx)
            promise.resolve(jsonToMaps(raw))
        } catch (e: Exception) {
            promise.reject("E_SMS_PENDING", e)
        }
    }

    @ReactMethod
    fun shouldRescan(promise: Promise) {
        try {
            promise.resolve(SmsPendingStore.consumeRescan(ctx))
        } catch (e: Exception) {
            promise.reject("E_SMS_RESCAN", e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String?) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }

    private fun countWithSelection(selection: String, args: Array<String>, promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            promise.reject("E_SMS_PERMISSION", "READ_SMS not granted")
            return
        }
        try {
            val cursor = ctx.contentResolver.query(
                Telephony.Sms.Inbox.CONTENT_URI,
                arrayOf(Telephony.Sms._ID),
                selection,
                args,
                null,
            )
            val count = cursor?.count ?: 0
            cursor?.close()
            promise.resolve(count)
        } catch (e: Exception) {
            promise.reject("E_SMS_COUNT", e)
        }
    }

    private fun cursorToArray(cursor: Cursor?): WritableArray {
        val arr = Arguments.createArray()
        if (cursor != null) {
            while (cursor.moveToNext()) {
                val body = cursor.getString(2) ?: continue
                arr.pushMap(rowToMap(cursor, body))
            }
            cursor.close()
        }
        return arr
    }

    private fun rowToMap(cursor: Cursor, body: String = cursor.getString(2) ?: ""): WritableMap {
        val map = Arguments.createMap()
        map.putString("id", cursor.getLong(0).toString())
        map.putString("sender", cursor.getString(1) ?: "")
        map.putString("body", body)
        map.putDouble("date", cursor.getLong(3).toDouble())
        map.putDouble("dateSent", cursor.getLong(4).toDouble())
        map.putInt("type", cursor.getInt(5))
        map.putString("threadId", cursor.getLong(6).toString())
        return map
    }

    private fun jsonToMaps(raw: JSONArray): WritableArray {
        val arr = Arguments.createArray()
        for (i in 0 until raw.length()) {
            val obj = raw.optJSONObject(i) ?: continue
            val map = Arguments.createMap()
            map.putString("sender", obj.optString("sender"))
            map.putString("body", obj.optString("body"))
            arr.pushMap(map)
        }
        return arr
    }

    companion object {
        private val PROJECTION = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.DATE_SENT,
            Telephony.Sms.TYPE,
            Telephony.Sms.THREAD_ID,
        )
    }
}
