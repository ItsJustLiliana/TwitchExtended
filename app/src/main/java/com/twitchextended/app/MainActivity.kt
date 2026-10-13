package com.twitchextended.app

import android.app.*
import android.content.*
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.*
import android.media.session.*
import android.net.Uri
import android.os.*
import android.util.Rational
import android.view.*
import android.webkit.*
import android.widget.*
import androidx.webkit.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject
import java.net.URL
import java.util.ArrayDeque

class MainActivity : ComponentActivity() {
    companion object { var mediaToken: MediaSession.Token? = null }
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private lateinit var column: LinearLayout
    private lateinit var scripts: ScriptManager
    private lateinit var session: MediaSession
    private lateinit var audio: AudioManager
    private lateinit var focus: AudioFocusRequest
    private var custom: View? = null
    private var customCallback: WebChromeClient.CustomViewCallback? = null
    private var playing = false
    private var focused = false
    private var pausedForFocus = false
    private val diagnostics = ArrayDeque<String>()
    private val prefs by lazy { getSharedPreferences("settings", MODE_PRIVATE) }
    private val ui = Handler(Looper.getMainLooper())
    private var settingsDialog: Dialog? = null
    private val dark get() = when(prefs.getString("theme", "system")) { "dark" -> true; "light" -> false; else -> resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES }
    private val fg get() = if(dark) Color.rgb(242,242,247) else Color.rgb(25,26,32)
    private val bg get() = if(dark) Color.rgb(16,17,22) else Color.rgb(246,246,250)
    private fun dp(n:Int) = (n * resources.displayMetrics.density).toInt()
    private fun event(module:String, status:String) { diagnostics.addLast("${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.ROOT).format(java.util.Date())}  $module: $status"); while(diagnostics.size>150) diagnostics.removeFirst() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window,false)
        onBackPressedDispatcher.addCallback(this,object:OnBackPressedCallback(true){override fun handleOnBackPressed(){if(custom!=null)exitFullscreen()else if(web.canGoBack())web.goBack()else finish()}})
        root=FrameLayout(this);column=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setBackgroundColor(bg)}
        root.addView(column);setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v,insets ->
            val bars=insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left,bars.top,bars.right,bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        web=WebView(this);column.addView(web,LinearLayout.LayoutParams(-1,0,1f));scripts=ScriptManager(this)
        web.setBackgroundColor(bg)
        web.settings.apply {
            javaScriptEnabled=true;domStorageEnabled=true;mediaPlaybackRequiresUserGesture=false
            allowFileAccess=false;allowContentAccess=false;setSupportMultipleWindows(true);javaScriptCanOpenWindowsAutomatically=true
            mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,true)
        applyUserAgent()
        web.webViewClient=object:WebViewClient(){
            override fun shouldInterceptRequest(view:WebView,request:WebResourceRequest):WebResourceResponse? {
                val path=request.url.path?:return null
                if(request.url.host!="cdn.betterttv.net"||!path.startsWith("/assets/")||path.contains("..")||!path.matches(Regex("/[a-zA-Z0-9_./-]+")))return null
                return try {
                    val mime=when{path.endsWith(".svg")->"image/svg+xml";path.endsWith(".woff2")->"font/woff2";path.endsWith(".woff")->"font/woff";else->java.net.URLConnection.guessContentTypeFromName(path)?:"application/octet-stream"}
                    WebResourceResponse(mime,null,200,"OK",mapOf("Access-Control-Allow-Origin" to "*"),assets.open("bttv"+path))
                }catch(_:java.io.IOException){null}
            }
            override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest):Boolean {
                val u=request.url
                if(isAppLink(u))return true
                // Keep ordinary web navigation inside WebView. Never launch Android's
                // app/browser chooser as a side effect of Twitch page navigation.
                return u.scheme!="https" && u.scheme!="http"
            }
            override fun onReceivedError(view:WebView,request:WebResourceRequest,error:WebResourceError){if(request.isForMainFrame){event("network","error ${error.errorCode}");AlertDialog.Builder(this@MainActivity).setTitle("Unable to load Twitch").setMessage("Check your connection and try again.").setPositiveButton("Retry"){_,_->web.reload()}.setNegativeButton("Close",null).show()}}
            override fun onRenderProcessGone(view:WebView,detail:RenderProcessGoneDetail):Boolean{event("engine","renderer stopped");column.removeView(view);view.destroy();AlertDialog.Builder(this@MainActivity).setTitle("Playback stopped").setMessage("Restart the app to restore the browser.").setPositiveButton("Restart"){_,_->recreate()}.show();return true}
            override fun onPageFinished(view:WebView,url:String){CookieManager.getInstance().flush();event("page","loaded")}
        }
        web.webChromeClient=object:WebChromeClient(){
            override fun onShowCustomView(view:View,callback:CustomViewCallback){if(custom!=null){callback.onCustomViewHidden();return};custom=view;customCallback=callback;column.visibility=View.GONE;root.addView(view,FrameLayout.LayoutParams(-1,-1));if(Build.VERSION.SDK_INT>=30){window.insetsController?.hide(WindowInsets.Type.systemBars());window.insetsController?.systemBarsBehavior=WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE}else window.decorView.systemUiVisibility=5894}
            override fun onHideCustomView(){exitFullscreen()}
            override fun onConsoleMessage(message:ConsoleMessage):Boolean{if(message.messageLevel()==ConsoleMessage.MessageLevel.ERROR)event("page","console error at line ${message.lineNumber()}");return true}
            override fun onCreateWindow(view:WebView,isDialog:Boolean,isUserGesture:Boolean,resultMsg:Message):Boolean {
                if(!isUserGesture)return false
                val popup=WebView(this@MainActivity)
                popup.webViewClient=object:WebViewClient(){
                    override fun shouldOverrideUrlLoading(v:WebView,r:WebResourceRequest):Boolean{
                        if(!isAppLink(r.url)&&(r.url.scheme=="https"||r.url.scheme=="http"))web.loadUrl(r.url.toString())
                        v.destroy();return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView=popup;resultMsg.sendToTarget();return true
            }
        }
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.addWebMessageListener(web,"TeEvents",setOf("https://*.twitch.tv","https://twitch.tv")){_,message,_,main,_->
            if(main)try{val data=JSONObject(message.data?:"{}");val module=data.optString("module");val status=data.optString("event");if(module in setOf("vaft","vod","hls","rewind","promos","scripts","media","mobile","bttv") && status in setOf("initialized","error","promise-error","player-reload","ready","controls","playing","paused","stream-error","ad-filtering","ad-detected","no-ad-detected","reload-request")){event(module,status);if(module=="media")updateMedia(status=="playing")}}catch(_:Exception){}
        }
        setupMedia()
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.addWebMessageListener(web,"TeSettings",setOf("https://*.twitch.tv","https://twitch.tv")){_,message,_,main,_->
            if(main)try{
                val data=JSONObject(message.data?:"{}")
                val id=data.optString("id")
                if(id in setOf("vaft","rewind","bttv","promos","background","desktop","pip") && data.get("enabled") is Boolean){
                    prefs.edit().putBoolean(id,data.getBoolean("enabled")).apply()
                    scripts.install(web);applyUserAgent();web.reload()
                }
            }catch(_:Exception){}
        }
        if(!scripts.install(web))AlertDialog.Builder(this).setTitle("Update Android System WebView").setMessage("This WebView lacks document-start injection. VAFT and Rewind cannot initialize safely. Update Android System WebView first.").setPositiveButton("OK",null).show()
        if(savedInstanceState==null||web.restoreState(savedInstanceState)==null)web.loadUrl("https://www.twitch.tv/")
        if(System.currentTimeMillis()-prefs.getLong("updateCheck",0)>86400000L){prefs.edit().putLong("updateCheck",System.currentTimeMillis()).apply();checkUpdates(true)}
    }
    private fun button(label:String,action:()->Unit)=Button(this).apply{text=label;isAllCaps=false;setTextColor(fg);setOnClickListener{action()}}
    private fun isAppLink(u:Uri):Boolean = u.host?.endsWith(".app.link")==true || u.host in setOf("twitch.app.link","twitch-mobile.app.link","www.twitch.app.link") || u.scheme in setOf("intent","twitch","market") || (u.isHierarchical && u.getQueryParameter("tt_deeplink")=="true")
    private fun applyUserAgent(){web.settings.userAgentString=if(prefs.getBoolean("desktop",false))"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" else WebSettings.getDefaultUserAgent(this).replace("; wv", "").replace("Version/4.0 ","")}
    private fun js(code:String){web.evaluateJavascript(code,null)}
    override fun onConfigurationChanged(newConfig:Configuration){
        super.onConfigurationChanged(newConfig)
        val systemDark=newConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        js("if(window.__te?.config){window.__te.config.systemDark=$systemDark;window.dispatchEvent(new Event('te-system-theme'));}")
    }
    private fun media(action:String){js("window.__te?.media('$action')")}
    private fun setupMedia(){
        audio=getSystemService(AudioManager::class.java)
        focus=AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build()).setOnAudioFocusChangeListener { change ->
            if(change<0){pausedForFocus=playing;media("pause");if(change==AudioManager.AUDIOFOCUS_LOSS)focused=false}else if(change==AudioManager.AUDIOFOCUS_GAIN&&pausedForFocus){pausedForFocus=false;media("play")}
        }.build()
        session=MediaSession(this,"Twitch Extended");mediaToken=session.sessionToken
        session.setCallback(object:MediaSession.Callback(){override fun onPlay(){media("play")};override fun onPause(){media("pause")};override fun onStop(){media("pause")};override fun onSeekTo(pos:Long){js("const v=window.__te?.video();if(v&&Number.isFinite(v.duration))v.currentTime=${pos/1000.0};")}})
        session.setMetadata(MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,"Twitch Extended").build());session.isActive=true
    }
    private fun updateMedia(active:Boolean){
        playing=active
        if(active&&!focused){focused=audio.requestAudioFocus(focus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;if(!focused)media("pause")}
        session.setPlaybackState(PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_STOP).setState(if(active)PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED,PlaybackState.PLAYBACK_POSITION_UNKNOWN,1f).build())
        if(active)window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)else{window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);stopService(Intent(this,PlaybackService::class.java))}
    }
    private fun enterPip(){if(!playing){Toast.makeText(this,"Start a stream first",Toast.LENGTH_SHORT).show();return};enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(Rational(16,9)).build())}
    override fun onUserLeaveHint(){super.onUserLeaveHint();if(playing&&prefs.getBoolean("pip",true))enterPip()}
    private fun exitFullscreen(){custom?.let{root.removeView(it)};custom=null;column.visibility=View.VISIBLE;customCallback?.onCustomViewHidden();customCallback=null;if(Build.VERSION.SDK_INT>=30)window.insetsController?.show(WindowInsets.Type.systemBars())else window.decorView.systemUiVisibility=0}
    override fun onSaveInstanceState(out:Bundle){web.saveState(out);super.onSaveInstanceState(out)}
    override fun onStop(){super.onStop();CookieManager.getInstance().flush();if(playing&&prefs.getBoolean("background",false))startForegroundService(Intent(this,PlaybackService::class.java))else if(!isInPictureInPictureMode)media("pause")}
    override fun onResume(){super.onResume();if(::web.isInitialized)web.onResume()}
    override fun onDestroy(){settingsDialog?.dismiss();stopService(Intent(this,PlaybackService::class.java));scripts.close();session.release();mediaToken=null;audio.abandonAudioFocusRequest(focus);web.stopLoading();web.webChromeClient=null;column.removeView(web);web.destroy();super.onDestroy()}
    private fun text(value:String,size:Float=15f)=TextView(this).apply{text=value;textSize=size;setTextColor(fg);setPadding(dp(4),dp(8),dp(4),dp(8))}
    private fun showSettings(){
        val dialog=Dialog(this);settingsDialog=dialog
        val scroll=ScrollView(this);val body=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(20),dp(20),dp(20),dp(20));setBackgroundColor(bg)};scroll.addView(body)
        body.addView(text("Settings",24f));body.addView(text("Twitch Extended ${BuildConfig.VERSION_NAME} · ${BuildConfig.VERSION_CODE}"))
        fun section(title:String){body.addView(text(title,19f))}
        fun toggle(id:String,label:String,default:Boolean=true,reload:Boolean=false){val sw=Switch(this).apply{text=label;setTextColor(fg);setPadding(dp(12),dp(12),dp(12),dp(12));isChecked=prefs.getBoolean(id,default);background=GradientDrawable().apply{setColor(if(dark)Color.rgb(29,30,38)else Color.WHITE);cornerRadius=dp(6).toFloat()};setOnCheckedChangeListener{_,on->prefs.edit().putBoolean(id,on).apply();if(reload){scripts.install(web);applyUserAgent();web.reload();event(id,if(on)"enabled" else "disabled")}else if(id=="background"){js("if(window.__te)window.__te.background=$on;");if(on&&Build.VERSION.SDK_INT>=33)requestPermissions(arrayOf("android.permission.POST_NOTIFICATIONS"),100);if(!on)stopService(Intent(this@MainActivity,PlaybackService::class.java))}}};body.addView(sw,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=dp(8)})}
        section("Integrated modules")
        body.addView(text("Module changes reload the page to safely replace Worker and fetch hooks."))
        toggle("vaft","VAFT Adblock · 37.0.0",reload=true);toggle("rewind","Twitch Rewind · 1.0.0",reload=true);toggle("promos","Hide Ad-Free / Turbo · 1.1.0",reload=true)
        body.addView(text("Initialization does not prove ads were blocked. Rewind requires available VOD history."))
        section("Playback");toggle("pip","Automatic Picture-in-Picture");toggle("background","Background audio",false);toggle("desktop","Desktop website",false,true)
        section("Appearance")
        body.addView(button("Theme: ${prefs.getString("theme","system")}"){AlertDialog.Builder(this).setTitle("Theme").setItems(arrayOf("System","Dark","Light")){_,which->prefs.edit().putString("theme",arrayOf("system","dark","light")[which]).apply();column.setBackgroundColor(bg);dialog.dismiss();showSettings()}.show()})
        section("Updates")
        body.addView(button("Check GitHub Releases"){checkUpdates()})
        if(java.io.File(cacheDir,"updates/update.apk").exists())body.addView(button("Install downloaded update"){ApkUpdater(this).install(java.io.File(cacheDir,"updates/update.apk"))})
        body.addView(button("Check module versions"){checkModules()})
        body.addView(text("Only locally bundled scripts run. Script updates arrive in verified APKs. Disable a failing module to restore Twitch playback."))
        section("Diagnostics")
        body.addView(text("Engine: ${WebViewCompat.getCurrentWebViewPackage(this)?.versionName}\nDocument start: ${WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)}\nVAFT SHA-256: ${scripts.hash("vaft.js").take(16)}"))
        body.addView(button("View recent events"){AlertDialog.Builder(this).setTitle("Diagnostics").setMessage(diagnostics.joinToString("\n").ifEmpty{"No events yet"}).setPositiveButton("Close",null).show()})
        body.addView(button("Reload Twitch"){scripts.install(web);web.reload();dialog.dismiss()})
        body.addView(button("Close"){dialog.dismiss()})
        dialog.setContentView(scroll);dialog.window?.setLayout(-1,-1);dialog.show();dialog.window?.setLayout(-1,-1)
    }
    private fun readHttps(url:String):String{val c=URL(url).openConnection() as java.net.HttpURLConnection;c.connectTimeout=10000;c.readTimeout=10000;c.setRequestProperty("Accept","application/vnd.github+json");try{if(c.responseCode!=200)throw IllegalStateException("HTTP ${c.responseCode}");return c.inputStream.bufferedReader().use{it.readText()}}finally{c.disconnect()}}
    private fun checkUpdates(automatic:Boolean=false) {
        Thread {
            try {
                val release=JSONObject(readHttps("https://api.github.com/repos/ItsJustLiliana/twitch-extended/releases/latest"))
                val tag=release.getString("tag_name")
                val url=release.getString("html_url")
                val assets=release.optJSONArray("assets")
                var apkUrl:String?=null
                if(assets!=null)for(i in 0 until assets.length()) {
                    val asset=assets.getJSONObject(i)
                    if(asset.optString("name").endsWith(".apk")) apkUrl=asset.optString("browser_download_url")
                }
                val download=apkUrl
                ui.post {
                    if(!isFinishing&&!isDestroyed&&(!automatic||newerVersion(tag,BuildConfig.VERSION_NAME))) {
                        val dialog=AlertDialog.Builder(this).setTitle("Latest release: $tag")
                            .setMessage("Installed: ${BuildConfig.VERSION_NAME}. APK package, version and signing certificate are verified before installation.")
                            .setNegativeButton("Close",null)
                            .setNeutralButton("Open release") { _,_->
                                if(url.startsWith("https://github.com/ItsJustLiliana/twitch-extended/releases/"))startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url)))
                            }
                        if(download!=null)dialog.setPositiveButton("Download update") { _,_->downloadUpdate(download) }
                        dialog.show()
                    }
                }
            } catch(_:Exception) {
                ui.post { if(!isDestroyed) { event("updates","unavailable");if(!automatic)Toast.makeText(this,"No release available, or update server unreachable",Toast.LENGTH_LONG).show() } }
            }
        }.start()
    }
    private fun downloadUpdate(url:String) {
        Toast.makeText(this,"Downloading verified update?",Toast.LENGTH_LONG).show()
        Thread {
            try {
                val updater=ApkUpdater(this)
                val apk=updater.downloadAndVerify(url)
                ui.post { if(!isDestroyed) {
                    if(!packageManager.canRequestPackageInstalls()) {
                        AlertDialog.Builder(this).setTitle("Allow APK updates").setMessage("Enable installation from Twitch Extended, then select Install downloaded update in Settings.")
                            .setPositiveButton("Open Android settings") { _,_->updater.install(apk) }.setNegativeButton("Close",null).show()
                    } else updater.install(apk)
                } }
            } catch(_:Exception) { ui.post { if(!isDestroyed){event("updates","verification or download failed");Toast.makeText(this,"Update rejected or download failed",Toast.LENGTH_LONG).show()} } }
        }.start()
    }
    private fun newerVersion(remote:String,local:String):Boolean {
        val r=remote.removePrefix("v").split('.').mapNotNull{it.toIntOrNull()}
        val l=local.split('.').mapNotNull{it.toIntOrNull()}
        if(r.size!=3||l.size!=3)return false
        for(i in 0..2)if(r[i]!=l[i])return r[i]>l[i]
        return false
    }
    private fun checkModules(){Thread{try{val vaft=readHttps("https://raw.githubusercontent.com/pixeltris/TwitchAdSolutions/master/vaft/vaft.user.js");val version=Regex("@version\\s+(\\S+)").find(vaft)?.groupValues?.get(1)?:"unknown";val rewind=JSONObject(readHttps("https://raw.githubusercontent.com/Alban1911/TwitchRewind/main/manifest.json")).optString("version");ui.post{AlertDialog.Builder(this).setTitle("Upstream versions").setMessage("VAFT: $version (bundled 37.0.0)\nRewind: $rewind (bundled 1.0.0)\nChanges are downloaded for version inspection only and never executed.").setPositiveButton("OK",null).show()}}catch(_:Exception){ui.post{Toast.makeText(this,"Module check unavailable",Toast.LENGTH_LONG).show()}}}.start()}
}
