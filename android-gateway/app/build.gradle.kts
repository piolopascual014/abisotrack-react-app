import java.util.Properties

plugins {
    id("com.android.application")
}

val gatewayProperties = Properties().apply {
    val configFile = rootProject.file("gateway.properties")
    if (configFile.exists()) configFile.inputStream().use(::load)
}

fun quoted(value: String): String = "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

android {
    namespace = "ph.edu.udm.abisotrack.gateway"
    compileSdk = 37

    defaultConfig {
        applicationId = "ph.edu.udm.abisotrack.gateway"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "SUPABASE_URL", quoted(gatewayProperties.getProperty("SUPABASE_URL", "https://YOUR_PROJECT.supabase.co")))
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", quoted(gatewayProperties.getProperty("SUPABASE_PUBLISHABLE_KEY", "YOUR_PUBLISHABLE_KEY")))
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

