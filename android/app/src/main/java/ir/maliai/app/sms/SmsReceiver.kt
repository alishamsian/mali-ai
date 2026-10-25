package ir.maliai.app.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsMessage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }
        val messages = extract(intent) ?: return
        for (sms in assemble(messages)) {
            if (!SmsFinanceFilter.looksBankSms(context.applicationContext, sms.sender, sms.body)) {
                continue
            }
            val ctx = SmsParserBridge.reactContext
            if (ctx == null || !ctx.hasActiveReactInstance()) {
                SmsPendingStore.markRescan(context.applicationContext)
            } else {
                emit(ctx, sms)
            }
        }
    }

    private data class AssembledSms(val sender: String, val body: String, val timestampMillis: Long)

    /**
     * Long Persian SMS (UCS-2, >70 chars) arrive as several PDUs in one intent.
     * Join parts per sender in arrival order so the parser sees the whole message.
     */
    private fun assemble(messages: Array<SmsMessage>): List<AssembledSms> {
        val bodies = LinkedHashMap<String, StringBuilder>()
        val timestamps = HashMap<String, Long>()
        for (msg in messages) {
            val sender = msg.originatingAddress ?: continue
            val part = msg.messageBody ?: continue
            bodies.getOrPut(sender) { StringBuilder() }.append(part)
            if (!timestamps.containsKey(sender)) {
                timestamps[sender] = msg.timestampMillis
            }
        }
        return bodies.map { (sender, body) ->
            AssembledSms(sender, body.toString(), timestamps[sender] ?: System.currentTimeMillis())
        }
    }

    private fun extract(intent: Intent): Array<SmsMessage>? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            Telephony.Sms.Intents.getMessagesFromIntent(intent)
        } else {
            null
        }
    }

    private fun toIso(millis: Long): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        return fmt.format(java.util.Date(millis))
    }

    private fun emit(ctx: ReactApplicationContext, sms: AssembledSms) {
        try {
            val map = Arguments.createMap()
            map.putString("sender", sms.sender)
            map.putString("body", sms.body)
            map.putString("receivedAt", toIso(sms.timestampMillis))
            ctx
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("mali.sms.received", map)
        } catch (_: Exception) {
            SmsPendingStore.markRescan(ctx)
        }
    }
}

object SmsParserBridge {
    @Volatile
    var reactContext: ReactApplicationContext? = null
}
