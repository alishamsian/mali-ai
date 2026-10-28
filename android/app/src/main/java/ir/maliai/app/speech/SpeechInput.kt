package ir.maliai.app.speech

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ViewManager

/**
 * Speech-to-text through the phone's own recognizer (android.speech). Emits
 * SpeechPartial / SpeechResult with { text }, SpeechError with { code } and SpeechEnd.
 * The recognizer belongs to the system speech service, which may process audio online.
 */
class SpeechInputModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val main = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null

    override fun getName() = "SpeechInput"

    private fun emit(event: String, text: String? = null, code: Int? = null) {
        val payload = Arguments.createMap()
        text?.let { payload.putString("text", it) }
        code?.let { payload.putInt("code", it) }
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(event, payload)
    }

    private fun best(bundle: Bundle?): String =
        bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""

    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(SpeechRecognizer.isRecognitionAvailable(context))
    }

    @ReactMethod
    fun start(locale: String, promise: Promise) {
        main.post {
            try {
                recognizer?.destroy()
                val r = SpeechRecognizer.createSpeechRecognizer(context)
                r.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() = emit("SpeechEnd")
                    override fun onError(error: Int) = emit("SpeechError", code = error)
                    override fun onResults(results: Bundle?) = emit("SpeechResult", text = best(results))
                    override fun onPartialResults(partialResults: Bundle?) =
                        emit("SpeechPartial", text = best(partialResults))
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                    .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                r.startListening(intent)
                recognizer = r
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("speech_start", e)
            }
        }
    }

    @ReactMethod
    fun stop() {
        main.post { recognizer?.stopListening() }
    }

    @ReactMethod
    fun cancel() {
        main.post {
            recognizer?.destroy()
            recognizer = null
        }
    }

    // Required by NativeEventEmitter on the JS side.
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    override fun invalidate() {
        main.post {
            recognizer?.destroy()
            recognizer = null
        }
        super.invalidate()
    }
}

class SpeechPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(SpeechInputModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
