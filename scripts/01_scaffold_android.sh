#!/usr/bin/env bash
# Patch 016B - Step 1: scaffold the native Android project.
# Run on a machine with Node 18+ and the Android SDK. From android-shell/android-shell/.
set -euo pipefail

echo "[*] Installing Capacitor tooling"
npm install

echo "[*] Building the web app for static export (reuses the Atlas design system)"
npm run build:web

echo "[*] Adding the native Android platform"
npx cap add android

echo "[*] Copying our app-level Gradle + config into the generated project"
cp app-build.gradle android/app/build.gradle
[ -f keystore.properties ] && cp keystore.properties android/keystore.properties || \
  echo "    NOTE: create android/keystore.properties from keystore.properties.example before release builds"

echo "[*] Syncing web assets into the native shell"
npx cap sync android

echo "[OK] Native project ready at android/."
echo "    Debug run:    npx cap open android   (then Run in Android Studio)"
echo "    Release AAB:  npm run build:aab"
