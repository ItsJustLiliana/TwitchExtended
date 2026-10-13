package com.twitchextended.app

import android.content.Context
import android.webkit.WebView
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.security.MessageDigest

class ScriptManager(private val context: Context) {
    private var handler: ScriptHandler? = null
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
    fun enabled(id: String) = prefs.getBoolean(id, true)
    fun asset(name: String) = context.assets.open("modules/$name").bufferedReader().use { it.readText() }
    fun hash(name: String) = MessageDigest.getInstance("SHA-256").digest(asset(name).toByteArray()).joinToString("") { "%02x".format(it) }
    fun install(web: WebView): Boolean {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return false
        handler?.remove()
        val js = buildString {
            append("if(window===window.top && !window.__teInstalled){window.__teInstalled=true;\n")
            append(asset("runtime.js"))
            val config=JSONObject()
            config.put("systemDark",context.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK == android.content.res.Configuration.UI_MODE_NIGHT_YES)
            for(id in listOf("vaft","rewind","bttv","promos"))config.put(id,enabled(id))
            for(id in listOf("background","desktop","pip"))config.put(id,prefs.getBoolean(id,id=="pip"))
            append("window.__te.config=$config;window.__te.setSetting=(id,enabled)=>window.TeSettings?.postMessage(JSON.stringify({id,enabled}));\n")
            appendModule("settings",asset("extension-settings.js"),this)
            appendModule("mobile",asset("mobile-shell.js"),this)
            append("\nwindow.__te.background=${prefs.getBoolean("background", false)};\n")
            // VAFT first: Rewind wraps the already patched worker. Reversing this order
            // permits VAFT's prototype cleanup to remove another worker wrapper.
            if (enabled("vaft")) appendModule("vaft", asset("vaft.js"), this)
            if (enabled("rewind")) {
                appendModule("vod", asset("vod-unlock.js"), this)
                appendModule("hls", asset("hls.js"), this)
                appendModule("rewind", asset("rewind.js"), this)
                append("window.__te.style(${JSONObject.quote(asset("rewind.css") + asset("mobile.css"))});\n")
            }
            if (enabled("promos")) appendModule("promos", asset("hide-promos.js"), this)
            if (enabled("bttv")) {
                append("window.__te.bttvCss=${JSONObject.quote(asset("betterttv.css"))};window.__te.style(window.__te.bttvCss);\n")
                append("function bootBetterTTV(){\n")
                appendModule("bttv",asset("betterttv.js"),this)
                append("}\nif(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootBetterTTV,{once:true});else bootBetterTTV();\n")
                appendModule("bttv",asset("bttv-emotes.js"),this)
            }
            append("window.__te.watchWorkers();\n")
            append("}")
        }
        handler = WebViewCompat.addDocumentStartJavaScript(web, js, setOf("https://*.twitch.tv", "https://twitch.tv"))
        return true
    }
    private fun appendModule(id: String, code: String, out: StringBuilder) {
        out.append("try {\n$code\n;window.__te.report('$id','initialized');}catch(e){window.__te.report('$id','error');}\n")
    }
    fun close() { if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))handler?.remove(); handler = null }
}
