pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositories { google(); mavenCentral() } }
rootProject.name = "founderroute-analytics-android"
include(":example")
project(":example").projectDir = file("../examples/android")
