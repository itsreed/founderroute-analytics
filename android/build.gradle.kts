import org.gradle.api.publish.maven.MavenPublication
import org.gradle.jvm.tasks.Jar

plugins {
    id("com.android.library") version "8.9.2"
    id("org.jetbrains.kotlin.android") version "2.1.20"
    id("maven-publish")
    id("signing")
}
group = "app.founderroute"
version = "1.0.0-rc.2"
android {
    namespace = "com.founderroute.analytics"
    compileSdk = 35
    defaultConfig { minSdk = 24; testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    publishing { singleVariant("release") { withSourcesJar() } }
}
dependencies {
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
}
val javadocJar by tasks.registering(Jar::class) {
    archiveClassifier.set("javadoc")
    from("src/main/java")
}

afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])
                artifact(javadocJar)
                artifactId = "analytics-android"
                pom {
                    name.set("FounderRoute Analytics"); description.set("Native FounderRoute analytics SDK")
                    url.set("https://github.com/itsreed/founderroute-analytics")
                    licenses { license { name.set("MIT"); url.set("https://opensource.org/licenses/MIT") } }
                    developers { developer { id.set("founderroute"); name.set("FounderRoute"); url.set("https://founderroute.app") } }
                    scm {
                        connection.set("scm:git:git://github.com/itsreed/founderroute-analytics.git")
                        developerConnection.set("scm:git:ssh://github.com/itsreed/founderroute-analytics.git")
                        url.set("https://github.com/itsreed/founderroute-analytics")
                    }
                }
            }
        }
        repositories {
            maven {
                name = "centralBundle"
                url = uri(layout.buildDirectory.dir("central-bundle"))
            }
        }
    }
    signing {
        val signingKey = System.getenv("MAVEN_SIGNING_KEY")
        val signingPassword = System.getenv("MAVEN_SIGNING_PASSWORD")
        if (!signingKey.isNullOrBlank()) {
            useInMemoryPgpKeys(signingKey, signingPassword)
            sign(publishing.publications["release"])
        }
    }
}
