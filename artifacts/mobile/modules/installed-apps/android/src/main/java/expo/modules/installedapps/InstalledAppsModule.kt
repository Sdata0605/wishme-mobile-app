package expo.modules.installedapps

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import android.telecom.TelecomManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** An intent to start, described from JavaScript. */
class IntentSpec : Record {
  @Field
  var action: String = Intent.ACTION_MAIN

  @Field
  var category: String? = null

  /** For the "main selector" apps (contacts, gallery, calculator...): see Intent.makeMainSelectorActivity. */
  @Field
  var selectorCategory: String? = null

  @Field
  var data: String? = null

  @Field
  var type: String? = null

  @Field
  var packageName: String? = null

  @Field
  var className: String? = null
}

/**
 * Lists the apps installed on the phone that have a launcher icon, and starts any of them by package name.
 *
 * Android 11+ hides other apps from an app unless its manifest says it may look for them. The <queries> block in this
 * module's manifest asks for apps with a MAIN/LAUNCHER activity only, which is every app the user can open from the
 * home screen, without needing the restricted QUERY_ALL_PACKAGES permission.
 */
class InstalledAppsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  @Suppress("DEPRECATION")
  private fun query(intent: Intent): List<ResolveInfo> {
    val pm = context.packageManager
    return if (Build.VERSION.SDK_INT >= 33) {
      pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0L))
    } else {
      pm.queryIntentActivities(intent, 0)
    }
  }

  private fun launchers(category: String): List<Map<String, String>> {
    val pm = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(category)
    val out = ArrayList<Map<String, String>>()
    val seen = HashSet<String>()
    for (ri in query(intent)) {
      val ai = ri.activityInfo ?: continue
      // WishMe itself is not something to "open" by voice.
      if (ai.packageName == context.packageName) continue
      // The same package can show up more than once (a phone app with a contacts icon); keep each launcher entry once.
      if (!seen.add(ai.packageName + "/" + ai.name)) continue
      val label = ri.loadLabel(pm).toString().trim().ifEmpty { ai.packageName }
      out.add(mapOf("label" to label, "packageName" to ai.packageName, "activityName" to ai.name))
    }
    return out
  }

  // A plain startActivity, never startActivityForResult: nothing is left pending, so the next launch is never refused.
  private fun start(intent: Intent): Boolean {
    return try {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      val activity = appContext.currentActivity
      if (activity != null) activity.startActivity(intent) else context.startActivity(intent)
      true
    } catch (e: ActivityNotFoundException) {
      false
    } catch (e: SecurityException) {
      false
    }
  }

  override fun definition() = ModuleDefinition {
    Name("InstalledApps")

    AsyncFunction("getLaunchableApps") {
      launchers(Intent.CATEGORY_LAUNCHER)
    }

    AsyncFunction("getAppsForCategory") { category: String ->
      launchers(category)
    }

    AsyncFunction("isInstalled") { packageName: String ->
      context.packageManager.getLaunchIntentForPackage(packageName) != null
    }

    AsyncFunction("getDefaultSmsPackage") {
      Telephony.Sms.getDefaultSmsPackage(context)
    }

    AsyncFunction("getDefaultDialerPackage") {
      context.getSystemService(TelecomManager::class.java)?.defaultDialerPackage
    }

    AsyncFunction("launchApp") { packageName: String, activityName: String? ->
      val intent: Intent? =
        if (activityName != null) {
          Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .setComponent(ComponentName(packageName, activityName))
        } else {
          context.packageManager.getLaunchIntentForPackage(packageName)
        }
      if (intent == null) {
        false
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
        start(intent)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("launchIntent") { spec: IntentSpec ->
      val selector = spec.selectorCategory
      // makeMainSelectorActivity is the documented way to start the "default" contacts / gallery / calculator app.
      val intent: Intent =
        if (selector != null) Intent.makeMainSelectorActivity(spec.action, selector) else Intent(spec.action)
      spec.category?.let { intent.addCategory(it) }
      val uri: Uri? = spec.data?.let { Uri.parse(it) }
      val type: String? = spec.type
      if (uri != null && type != null) {
        intent.setDataAndType(uri, type)
      } else if (uri != null) {
        intent.data = uri
      } else if (type != null) {
        intent.type = type
      }
      val pkg = spec.packageName
      val cls = spec.className
      if (pkg != null && cls != null) {
        intent.component = ComponentName(pkg, cls)
      } else if (pkg != null) {
        intent.setPackage(pkg)
      }
      start(intent)
    }.runOnQueue(Queues.MAIN)
  }
}
