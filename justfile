# Build a release APK (JS bundle is handled automatically by Gradle)
release:
    mkdir -p android/app/src/main/assets
    cd android && ./gradlew assembleRelease
    @echo "APK: android/app/build/outputs/apk/release/app-release.apk"
