package com.twitchextended.app

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class ApkUpdater(private val activity: Activity) {
    fun downloadAndVerify(url:String):File {
        require(url.startsWith("https://github.com/ItsJustLiliana/twitch-extended/releases/download/")) { "Untrusted release URL" }
        val dir=File(activity.cacheDir,"updates").apply{mkdirs()}
        val part=File(dir,"update.part");val apk=File(dir,"update.apk")
        var next=url
        try {
            var complete=false
            for(i in 0..5){
                val parsed=URL(next)
                require(parsed.protocol=="https" && parsed.host in setOf("github.com","release-assets.githubusercontent.com","objects.githubusercontent.com")) { "Untrusted download redirect" }
                val c=parsed.openConnection() as HttpURLConnection
                c.instanceFollowRedirects=false;c.connectTimeout=15000;c.readTimeout=20000
                try {
                    if(c.responseCode in 300..399){next=URL(parsed,c.getHeaderField("Location")?:error("Missing redirect")).toString();continue}
                    require(c.responseCode==200){"Download failed"}
                    require(c.contentLengthLong<=150000000L){"APK too large"}
                    c.inputStream.use{input->part.outputStream().use{out->val buf=ByteArray(65536);var total=0L;while(true){val n=input.read(buf);if(n<0)break;total+=n;require(total<=150000000L){"APK too large"};out.write(buf,0,n)}}}
                    complete=true;break
                }finally{c.disconnect()}
            }
            require(complete){"Too many redirects"}
            verify(part)
            if(apk.exists())require(apk.delete())
            require(part.renameTo(apk));return apk
        }catch(e:Exception){part.delete();throw e}
    }
    @Suppress("DEPRECATION") private fun verify(file:File){
        val pm=activity.packageManager
        val flags=if(Build.VERSION.SDK_INT>=28)PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val candidate=pm.getPackageArchiveInfo(file.absolutePath,flags)?:error("Invalid APK")
        val installed=pm.getPackageInfo(activity.packageName,flags)
        require(candidate.packageName==activity.packageName){"Wrong package"}
        val candidateCode=if(Build.VERSION.SDK_INT>=28)candidate.longVersionCode else candidate.versionCode.toLong()
        val installedCode=if(Build.VERSION.SDK_INT>=28)installed.longVersionCode else installed.versionCode.toLong()
        require(candidateCode>installedCode){"Update is not newer"}
        val remote=if(Build.VERSION.SDK_INT>=28)candidate.signingInfo?.apkContentsSigners else candidate.signatures
        val local=if(Build.VERSION.SDK_INT>=28)installed.signingInfo?.apkContentsSigners else installed.signatures
        require(remote!=null&&local!=null&&remote.size==local.size&&remote.isNotEmpty()&&remote.all{r->local.any{it==r}}){"Signing certificate mismatch"}
    }
    fun install(file:File){
        if(!activity.packageManager.canRequestPackageInstalls()){
            activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:${activity.packageName}")));return
        }
        val uri=FileProvider.getUriForFile(activity,"${activity.packageName}.files",file)
        activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
    }
}
