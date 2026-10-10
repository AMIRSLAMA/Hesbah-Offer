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

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    defaultConfig {
        applicationId = "com.hesbah.offer"
        minSdk = 24
        targetSdk = 35
        versionCode = 3
        versionName = "1.2.0"
        manifestPlaceholders["appLabel"] = "Hesbah Offer"
        buildConfigField("String", "API_URL", "\"$configuredApiUrl\"")
    }

    flavorDimensions += "audience"
    productFlavors {
        create("customer") {
            dimension = "audience"
            applicationIdSuffix = ".customer"
            versionNameSuffix = "-customer"
            manifestPlaceholders["appLabel"] = "Hesbah Offer - العميل"
            buildConfigField("String", "START_URL", "\"$configuredApiUrl/\"")
            buildConfigField("String", "APP_SECTION", "\"تطبيق العميل\"")
            buildConfigField("String", "APP_ICON", "\"🛍️\"")
            buildConfigField("String", "WELCOME_TITLE", "\"أهلاً بيك في حسبة أوفر\"")
            buildConfigField("String", "WELCOME_MESSAGE", "\"كل احتياجاتك وعروض متاجرك المفضلة في مكان واحد. اطلب بسهولة وتابع طلبك لحد باب البيت.\"")
        }
        create("driver") {
            dimension = "audience"
            applicationIdSuffix = ".driver"
            versionNameSuffix = "-driver"
            manifestPlaceholders["appLabel"] = "Hesbah Offer - المندوب"
            buildConfigField("String", "START_URL", "\"$configuredApiUrl/driver-login.html\"")
            buildConfigField("String", "APP_SECTION", "\"تطبيق المندوب\"")
            buildConfigField("String", "APP_ICON", "\"🛵\"")
            buildConfigField("String", "WELCOME_TITLE", "\"أهلاً بيك يا بطل التوصيل\"")
            buildConfigField("String", "WELCOME_MESSAGE", "\"ابدأ يومك، استقبل طلباتك، وتابع توصيلها للعملاء من خلال صفحة المندوب.\"")
        }
        create("merchant") {
            dimension = "audience"
            applicationIdSuffix = ".merchant"
            versionNameSuffix = "-merchant"
            manifestPlaceholders["appLabel"] = "Hesbah Offer - التاجر"
            buildConfigField("String", "START_URL", "\"$configuredApiUrl/merchant-login.html\"")
            buildConfigField("String", "APP_SECTION", "\"تطبيق التاجر\"")
            buildConfigField("String", "APP_ICON", "\"🏪\"")
            buildConfigField("String", "WELCOME_TITLE", "\"أهلاً بيك في متجرك\"")
            buildConfigField("String", "WELCOME_MESSAGE", "\"اعرض منتجاتك، تابع الطلبات، ونمّي مبيعات متجرك من خلال Hesbah Offer.\"")
        }
        create("admin") {
            dimension = "audience"
            applicationIdSuffix = ".admin"
            versionNameSuffix = "-admin"
            manifestPlaceholders["appLabel"] = "Hesbah Offer - الإدارة"
            buildConfigField("String", "START_URL", "\"$configuredApiUrl/admin.html\"")
            buildConfigField("String", "APP_SECTION", "\"تطبيق الإدارة\"")
            buildConfigField("String", "APP_ICON", "\"🛡️\"")
            buildConfigField("String", "WELCOME_TITLE", "\"أهلاً بيك في لوحة الإدارة\"")
            buildConfigField("String", "WELCOME_MESSAGE", "\"تابع المنصة وأدِر عمليات Hesbah Offer من واجهة مخصصة وسهلة الاستخدام.\"")
        }
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
