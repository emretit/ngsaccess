import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    id("dev.flutter.flutter-gradle-plugin")
}

// CI compilation must opt in explicitly; ordinary release tasks fail closed.
val unsignedRelease = providers.gradleProperty("ngsUnsignedRelease").orNull == "true"
val releaseProperties = Properties()
val releasePropertiesFile = rootProject.file("key.properties")
if (releasePropertiesFile.isFile) {
    releasePropertiesFile.inputStream().use { releaseProperties.load(it) }
}
fun signingValue(environmentName: String, propertyName: String): String? =
    providers.environmentVariable(environmentName).orNull?.takeIf { it.isNotBlank() }
        ?: releaseProperties.getProperty(propertyName)?.takeIf { it.isNotBlank() }
val uploadStore = signingValue("ANDROID_KEYSTORE_PATH", "storeFile")
val uploadStorePassword = signingValue("ANDROID_KEYSTORE_PASSWORD", "storePassword")
val uploadAlias = signingValue("ANDROID_KEY_ALIAS", "keyAlias")
val uploadKeyPassword = signingValue("ANDROID_KEY_PASSWORD", "keyPassword")
val hasSigning = listOf(uploadStore, uploadStorePassword, uploadAlias, uploadKeyPassword)
    .all { !it.isNullOrBlank() }

android {
    namespace = "com.ngsplus.app.ngsplusapp"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = JavaVersion.VERSION_17.toString() }

    defaultConfig {
        // Preserve deployed application identity; iOS has its own existing bundle ID.
        applicationId = "com.ngsplus.app.ngsplusapp"
        minSdk = maxOf(23, flutter.minSdkVersion)
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }
    signingConfigs {
        if (hasSigning && !unsignedRelease) {
            create("upload") {
                storeFile = rootProject.file(requireNotNull(uploadStore))
                storePassword = uploadStorePassword
                keyAlias = uploadAlias
                keyPassword = uploadKeyPassword
            }
        }
    }
    buildTypes {
        release {
            signingConfig = if (hasSigning && !unsignedRelease) {
                signingConfigs.getByName("upload")
            } else {
                null
            }
        }
    }
}

// Task graph catches direct Gradle and Flutter release entry points. Never log inputs.
gradle.taskGraph.whenReady {
    val buildingRelease = allTasks.any {
        it.project == project && it.name.contains("Release", ignoreCase = true)
    }
    if (buildingRelease && !unsignedRelease) {
        check(hasSigning) {
            "Release signing is missing. Configure upload signing or use the explicit unsigned CI build script."
        }
        check(rootProject.file(requireNotNull(uploadStore)).isFile) {
            "Release keystore is unavailable."
        }
        check(!requireNotNull(uploadAlias).equals("androiddebugkey", ignoreCase = true)) {
            "Android debug signing is forbidden for release."
        }
    }
}

flutter { source = "../.." }
