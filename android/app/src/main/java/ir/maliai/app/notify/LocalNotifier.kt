package ir.maliai.app.notify

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.ViewManager
import ir.maliai.app.MainActivity
import ir.maliai.app.R
import org.json.JSONArray
import org.json.JSONObject

/**
 * Local notifications without a third-party library: post now, or arm an inexact alarm
 * that posts later. Armed reminders are kept in SharedPreferences so they survive a
 * reboot (BootReceiver re-arms them). Only titles and bodies built by the app are stored;
 * no SMS text goes through here.
 */
object Notifier {
    private const val CHANNEL_ID = "poolet-reminders"
    private const val PREFS = "poolet-notify"
    private const val KEY_SCHEDULED = "scheduled"
    const val EXTRA_ID = "id"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, "یادآورها و هشدارها", NotificationManager.IMPORTANCE_DEFAULT),
                )
            }
        }
    }

    fun post(context: Context, key: String, title: String, body: String) {
        ensureChannel(context)
        val open = PendingIntent.getActivity(
            context,
            key.hashCode(),
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(key.hashCode(), notification)
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS not granted: nothing to show.
        }
    }

    private fun alarmIntent(context: Context, key: String, title: String, body: String): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            key.hashCode(),
            Intent(context, ReminderReceiver::class.java)
                .putExtra(EXTRA_ID, key)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_BODY, body),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun arm(context: Context, item: JSONObject) {
        val at = item.getLong("at")
        if (at <= System.currentTimeMillis()) {
            return
        }
        val alarms = context.getSystemService(AlarmManager::class.java)
        alarms.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            at,
            alarmIntent(context, item.getString("id"), item.getString("title"), item.getString("body")),
        )
    }

    /** Replaces every armed reminder with `items`. */
    fun replaceScheduled(context: Context, items: JSONArray) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val old = JSONArray(prefs.getString(KEY_SCHEDULED, "[]"))
        val alarms = context.getSystemService(AlarmManager::class.java)
        for (i in 0 until old.length()) {
            val item = old.getJSONObject(i)
            alarms.cancel(alarmIntent(context, item.getString("id"), item.getString("title"), item.getString("body")))
        }
        for (i in 0 until items.length()) {
            arm(context, items.getJSONObject(i))
        }
        prefs.edit().putString(KEY_SCHEDULED, items.toString()).apply()
    }

    fun rearmAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val items = JSONArray(prefs.getString(KEY_SCHEDULED, "[]"))
        for (i in 0 until items.length()) {
            arm(context, items.getJSONObject(i))
        }
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val key = intent.getStringExtra(Notifier.EXTRA_ID) ?: return
        Notifier.post(
            context,
            key,
            intent.getStringExtra(Notifier.EXTRA_TITLE) ?: return,
            intent.getStringExtra(Notifier.EXTRA_BODY) ?: "",
        )
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Notifier.rearmAll(context)
        }
    }
}

class LocalNotifierModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "LocalNotifier"

    @ReactMethod
    fun show(key: String, title: String, body: String) {
        Notifier.post(context, key, title, body)
    }

    /** items: [{ id, title, body, at (epoch ms) }] */
    @ReactMethod
    fun replaceScheduled(items: ReadableArray, promise: Promise) {
        val json = JSONArray()
        for (i in 0 until items.size()) {
            val map = items.getMap(i) ?: continue
            json.put(
                JSONObject()
                    .put("id", map.getString("id"))
                    .put("title", map.getString("title"))
                    .put("body", map.getString("body"))
                    .put("at", map.getDouble("at").toLong()),
            )
        }
        Notifier.replaceScheduled(context, json)
        promise.resolve(json.length())
    }

    @ReactMethod
    fun areEnabled(promise: Promise) {
        promise.resolve(NotificationManagerCompat.from(context).areNotificationsEnabled())
    }
}

class NotifyPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(LocalNotifierModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
