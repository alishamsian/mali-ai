package ir.maliai.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import ir.maliai.app.MainActivity
import ir.maliai.app.R
import org.json.JSONObject

/**
 * Home-screen widgets. The app computes every figure (already formatted, Persian digits)
 * and hands them over as JSON; the widget only lays them out, so it never needs the
 * encrypted database and shows nothing until the app has run once.
 */
object WidgetState {
    private const val PREFS = "poolet-widget"
    private const val KEY = "state"

    fun save(context: Context, json: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
    }

    fun load(context: Context): JSONObject? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)?.let {
            try { JSONObject(it) } catch (_: Exception) { null }
        }

    fun refreshAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        for (provider in listOf(BudgetWidgetSmall::class.java, BudgetWidgetWide::class.java)) {
            val ids = manager.getAppWidgetIds(ComponentName(context, provider))
            if (ids.isNotEmpty()) {
                val layout = if (provider == BudgetWidgetWide::class.java) R.layout.widget_wide else R.layout.widget_small
                ids.forEach { manager.updateAppWidget(it, render(context, layout)) }
            }
        }
    }

    private fun link(context: Context, uri: String?, code: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        if (uri != null) {
            intent.action = Intent.ACTION_VIEW
            intent.data = Uri.parse(uri)
        }
        return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun render(context: Context, layout: Int): RemoteViews {
        val views = RemoteViews(context.packageName, layout)
        val s = load(context)
        views.setTextViewText(R.id.widget_kicker, s?.optString("kicker") ?: "پولت")
        views.setTextViewText(R.id.widget_amount, s?.optString("amount") ?: "—")
        views.setTextViewText(R.id.widget_sub, s?.optString("sub") ?: "برای شروع، پولت را باز کن")
        val progress = s?.optInt("progress", -1) ?: -1
        views.setViewVisibility(R.id.widget_progress, if (progress >= 0) View.VISIBLE else View.GONE)
        views.setProgressBar(R.id.widget_progress, 100, progress.coerceIn(0, 100), false)
        if (layout == R.layout.widget_wide) {
            views.setTextViewText(R.id.widget_today_label, s?.optString("todayLabel") ?: "")
            views.setTextViewText(R.id.widget_today, s?.optString("today") ?: "")
            views.setTextViewText(R.id.widget_month_label, s?.optString("monthLabel") ?: "")
            views.setTextViewText(R.id.widget_month, s?.optString("month") ?: "")
            views.setOnClickPendingIntent(R.id.widget_voice, link(context, "poolet://voice", 3))
        }
        views.setOnClickPendingIntent(R.id.widget_root, link(context, null, 1))
        views.setOnClickPendingIntent(R.id.widget_add, link(context, "poolet://add", 2))
        return views
    }
}

class BudgetWidgetSmall : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { manager.updateAppWidget(it, WidgetState.render(context, R.layout.widget_small)) }
    }
}

class BudgetWidgetWide : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { manager.updateAppWidget(it, WidgetState.render(context, R.layout.widget_wide)) }
    }
}

class WidgetBridgeModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "WidgetBridge"

    /** Asks the launcher to place the widget (Android 8+); the launcher shows its own dialog. */
    @ReactMethod
    fun requestPin(wide: Boolean, promise: com.facebook.react.bridge.Promise) {
        val manager = AppWidgetManager.getInstance(context)
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O || !manager.isRequestPinAppWidgetSupported) {
            promise.resolve(false)
            return
        }
        val provider = ComponentName(context, if (wide) BudgetWidgetWide::class.java else BudgetWidgetSmall::class.java)
        promise.resolve(manager.requestPinAppWidget(provider, null, null))
    }

    @ReactMethod
    fun setState(json: String) {
        WidgetState.save(context, json)
        WidgetState.refreshAll(context)
    }
}

class WidgetPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(WidgetBridgeModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
