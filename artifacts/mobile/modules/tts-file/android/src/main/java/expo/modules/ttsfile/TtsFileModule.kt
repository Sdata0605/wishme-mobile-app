package expo.modules.ttsfile

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

/** What to say, in which voice, into which file. */
class SynthesisSpec : Record {
  @Field
  var text: String = ""

  /** A voice name from getVoices(); null picks the engine's default for `language`. */
  @Field
  var voiceName: String? = null

  /** A BCP-47 tag such as "en-IN", used when no voice is named or the named one is gone. */
  @Field
  var language: String? = null

  @Field
  var pitch: Double = 1.0

  @Field
  var rate: Double = 1.0

  /** Absolute path of the WAV file to write (a file:// prefix is accepted). */
  @Field
  var path: String = ""
}

/**
 * The phone's own text-to-speech engine, writing to a file instead of the speaker, so the app can place each voice in a
 * room (stereo, reflections) before it is heard. Everything the engine supports is free and works offline.
 *
 * One engine is created on first use and kept until the module is destroyed. Requests are run one after another: the
 * engine is a single queue anyway.
 */
class TtsFileModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var tts: TextToSpeech? = null
  private var ready = false
  private var initFailed = false
  private val waiting = ArrayList<(Boolean) -> Unit>()
  private val pending = HashMap<String, Promise>()
  private val ids = AtomicInteger(0)

  private fun engine(then: (Boolean) -> Unit) {
    synchronized(this) {
      if (ready) {
        then(true)
        return
      }
      if (initFailed) {
        then(false)
        return
      }
      waiting.add(then)
      if (tts != null) return
      tts = TextToSpeech(context) { status ->
        val ok = status == TextToSpeech.SUCCESS
        val callbacks: List<(Boolean) -> Unit>
        synchronized(this) {
          ready = ok
          initFailed = !ok
          callbacks = ArrayList(waiting)
          waiting.clear()
        }
        if (ok) {
          tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}

            override fun onDone(utteranceId: String?) {
              val p = synchronized(this@TtsFileModule) { pending.remove(utteranceId) } ?: return
              p.resolve(true)
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
              onError(utteranceId, TextToSpeech.ERROR)
            }

            override fun onError(utteranceId: String?, errorCode: Int) {
              val p = synchronized(this@TtsFileModule) { pending.remove(utteranceId) } ?: return
              p.reject(CodedException("ERR_TTS_SYNTHESIS", "The text-to-speech engine failed (code $errorCode).", null))
            }
          })
        }
        for (cb in callbacks) cb(ok)
      }
    }
  }

  private fun voiceInfo(v: Voice): Map<String, Any> = mapOf(
    "name" to v.name,
    "language" to v.locale.toLanguageTag(),
    "quality" to v.quality,
    "latency" to v.latency,
    "requiresNetwork" to v.isNetworkConnectionRequired,
    "features" to ArrayList(v.features ?: emptySet<String>()),
  )

  override fun definition() = ModuleDefinition {
    Name("TtsFile")

    AsyncFunction("getVoices") { promise: Promise ->
      engine { ok ->
        if (!ok) {
          promise.reject(CodedException("ERR_TTS_UNAVAILABLE", "No text-to-speech engine is available on this phone.", null))
          return@engine
        }
        val voices = try {
          tts?.voices?.map { voiceInfo(it) } ?: emptyList()
        } catch (e: Exception) {
          emptyList<Map<String, Any>>()
        }
        promise.resolve(voices)
      }
    }

    AsyncFunction("synthesize") { spec: SynthesisSpec, promise: Promise ->
      engine { ok ->
        val t = tts
        if (!ok || t == null) {
          promise.reject(CodedException("ERR_TTS_UNAVAILABLE", "No text-to-speech engine is available on this phone.", null))
          return@engine
        }
        try {
          val file = File(spec.path.removePrefix("file://"))
          file.parentFile?.mkdirs()
          var voiceSet = false
          val wanted = spec.voiceName
          if (wanted != null) {
            val voice = try { t.voices?.firstOrNull { it.name == wanted } } catch (e: Exception) { null }
            if (voice != null) voiceSet = t.setVoice(voice) == TextToSpeech.SUCCESS
          }
          if (!voiceSet && spec.language != null) {
            t.language = Locale.forLanguageTag(spec.language!!)
          }
          t.setPitch(spec.pitch.toFloat().coerceIn(0.5f, 2.0f))
          t.setSpeechRate(spec.rate.toFloat().coerceIn(0.5f, 2.0f))
          val id = "council-" + ids.incrementAndGet()
          synchronized(this@TtsFileModule) { pending[id] = promise }
          val params = Bundle()
          val result = t.synthesizeToFile(spec.text, params, file, id)
          if (result != TextToSpeech.SUCCESS) {
            synchronized(this@TtsFileModule) { pending.remove(id) }
            promise.reject(CodedException("ERR_TTS_SYNTHESIS", "The text-to-speech engine refused the request.", null))
          }
        } catch (e: Exception) {
          promise.reject(CodedException("ERR_TTS_SYNTHESIS", e.message ?: "Text-to-speech failed.", e))
        }
      }
    }

    OnDestroy {
      try {
        tts?.stop()
        tts?.shutdown()
      } catch (e: Exception) {
        // nothing to release
      }
      tts = null
      ready = false
    }
  }
}
