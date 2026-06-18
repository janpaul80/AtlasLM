#!/usr/bin/env bash
# Patch 016B - Step 2: create the upload keystore (one time) and build signed AAB + APK.
# Run from android-shell/. Requires the Android SDK + JDK 17.
set -euo pipefail

KEYSTORE="atlaslm-release.jks"
ALIAS="atlaslm"

if [ ! -f "$KEYSTORE" ]; then
  echo "[*] Generating upload keystore (answer the prompts, keep the passwords safe)"
  keytool -genkey -v \
    -keystore "$KEYSTORE" \
    -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000
  echo "    Created $KEYSTORE. Now fill android/keystore.properties (see example)."
  echo "    Back up this .jks file. Losing it means you cannot update the app on Play."
fi

echo "[*] Building signed release AAB (for Play Store)"
npm run build:web
npx cap sync android
( cd android && ./gradlew bundleRelease )

echo "[*] Building signed release APK (for sideload / other stores)"
( cd android && ./gradlew assembleRelease )

echo "[OK] Artifacts:"
echo "    AAB: android/app/build/outputs/bundle/release/app-release.aab"
echo "    APK: android/app/build/outputs/apk/release/app-release.apk"
