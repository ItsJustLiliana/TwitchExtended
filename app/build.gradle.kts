import java.io.RandomAccessFile
import java.time.Instant
import java.util.Properties
plugins { id("com.android.application") }
val counter = rootProject.file(".gradle/build-number")
counter.parentFile.mkdirs()
val buildNumber = RandomAccessFile(counter, "rw").use { f ->
    f.channel.lock().use {
        val next = maxOf((f.readLine()?.toIntOrNull() ?: 0) + 1, (Instant.now().epochSecond - 1577836800L).toInt())
        f.setLength(0); f.seek(0); f.writeBytes(next.toString()); next
    }
}
android {
    signingConfigs {
        create("release") {
            val props = Properties()
            val signingFile = rootProject.file("keystore.properties")
            if (signingFile.exists()) {
                signingFile.inputStream().use { props.load(it) }
                storeFile = rootProject.file(props.getProperty("storeFile"))
                storePassword = props.getProperty("storePassword")
                keyAlias = props.getProperty("keyAlias")
                keyPassword = props.getProperty("keyPassword")
            }
        }
    }
    namespace = "com.twitchextended.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.twitchextended.app"
        minSdk = 26
        targetSdk = 36
        versionCode = buildNumber
        versionName = "1.0.7"
        testInstrumentationRunner = "android.test.InstrumentationTestRunner"
    }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    buildTypes { getByName("release") { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("release") } }
}
dependencies { implementation("androidx.webkit:webkit:1.15.0"); implementation("androidx.activity:activity:1.13.0") }


