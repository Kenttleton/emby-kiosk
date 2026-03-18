# ── Dev ───────────────────────────────────────────────────────────────────────

# Run on a connected Android device (default)
dev:
    npx expo run:android --device

# Run on a specific device by name (just dev-device "Pixel 7")
dev-device name:
    npx expo run:android --device "{{name}}"

# Start Metro bundler only (attach to an already-installed dev build)
metro:
    npx expo start

# ── Build ─────────────────────────────────────────────────────────────────────

# Build a release APK
release:
    mkdir -p android/app/src/main/assets
    cd android && ./gradlew assembleRelease
    @echo "APK: android/app/build/outputs/apk/release/app-release.apk"

# ── Maintenance ───────────────────────────────────────────────────────────────

# Install npm dependencies
install:
    npm install

# Clear Gradle build cache (fixes stale native module issues)
clean:
    rm -rf android/app/build
    rm -rf android/app/.cxx
    rm -rf android/build
    cd android && ./gradlew clean --continue || true

# Full reset: clear Metro cache, Gradle, and node_modules
reset:
    rm -rf node_modules
    npm install
    cd android && ./gradlew clean
    rm -rf android/app/build
    npx expo start --clear
