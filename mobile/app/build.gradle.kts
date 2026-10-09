plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val configuredApiUrl = providers.gradleProperty("HESBAH_API_URL")
    .orElse(providers.environmentVariable("HESBAH_API_URL"))
    .orElse("https://hesbah-server.tail957349.ts.net:8443")
    .get()
    .trimEnd('/')

android {
    buildFeatures { buildConfig = true }
    namespace = "com.hesbah.offer"
    compileSdk = 35

    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }

    flavorDimensions += "audience"
    productFlavors {
        create("customer") {
            dimension = "audience"
            applicationIdSuffix = ".customer"
            versionNameSuffix = "-customer"
            resValue("string", "app_name", "Hesbah Offer - العميل")
            buildConfigField("String", "APP_MODE", "\"customer\"")
        }
        create("driver") {
            dimension = "audience"
            applicationIdSuffix = ".driver"
            versionNameSuffix = "-driver"
            resValue("string", "app_name", "Hesbah Offer - المندوب")
            buildConfigField("String", "APP_MODE", "\"driver\"")
        }
        create("merchant") {
            dimension = "audience"
            applicationIdSuffix = ".merchant"
            versionNameSuffix = "-merchant"
            resValue("string", "app_name", "Hesbah Offer - التاجر")
            buildConfigField("String", "APP_MODE", "\"merchant\"")
        }
        create("admin") {
            dimension = "audience"
            applicationIdSuffix = ".admin"
            versionNameSuffix = "-admin"
            resValue("string", "app_name", "Hesbah Offer - الإدارة")
            buildConfigField("String", "APP_MODE", "\"admin\"")
        }
    }

    defaultConfig {
        applicationId = "com.hesbah.offer"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "1.1.0"
        buildConfigField("String", "API_URL", "\"$configuredApiUrl\"")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}