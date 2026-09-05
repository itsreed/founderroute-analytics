plugins {
    id("com.android.library") version "8.9.2"
    id("org.jetbrains.kotlin.android") version "2.1.20"
    id("maven-publish")
    id("signing")
}
group = "app.founderroute"
version = "0.1.0"
android {
    namespace = "com.founderroute.analytics"
    compileSdk = 35
    defaultConfig { minSdk = 24; testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner" }
    compileOptions { isCoreLibraryDesugaringEnabled = true; sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    publishing { singleVariant("release") { withSourcesJar() } }
}
dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"]); artifactId = "analytics-android"
                pom {
                    name.set("FounderRoute Analytics"); description.set("Consent-first native FounderRoute analytics SDK")
                    url.set("https://github.com/elharrakrachid217-cloud/founderroute-analytics")
                    licenses { license { name.set("MIT"); url.set("https://opensource.org/licenses/MIT") } }
                    developers { developer { id.set("founderroute"); name.set("FounderRoute") } }
                    scm { url.set("https://github.com/elharrakrachid217-cloud/founderroute-analytics") }
                }
            }
        }
    }
}
