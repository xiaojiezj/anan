#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TASK_ROOT"
node scripts/check-speech.mjs
if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME="$(/usr/libexec/java_home -F -v 21 2>/dev/null || true)"
  if [ -z "$JAVA_HOME" ] && [ -d "$TASK_ROOT/.tools/jdk/Contents/Home" ]; then JAVA_HOME="$TASK_ROOT/.tools/jdk/Contents/Home"; fi
  export JAVA_HOME
fi
export ANDROID_HOME="${ANDROID_HOME:-$TASK_ROOT/.tools/android-sdk}"
if [ ! -d "$ANDROID_HOME/platforms/android-36" ]; then
  echo 'Android SDK 36 is required. Set ANDROID_HOME to your SDK directory.' >&2
  exit 1
fi
mkdir -p output
cd android
BUILD_GRADLE_ARGS=(--no-daemon --console=plain)
if [ -n "${ANDROID_BUILD_SOCKS_PORT:-}" ]; then BUILD_GRADLE_ARGS+=(-DsocksProxyHost=127.0.0.1 "-DsocksProxyPort=$ANDROID_BUILD_SOCKS_PORT"); fi
if [ -x "$TASK_ROOT/.tools/gradle-8.14.3/bin/gradle" ]; then
  "$TASK_ROOT/.tools/gradle-8.14.3/bin/gradle" "${BUILD_GRADLE_ARGS[@]}" assembleDebug
else
  ./gradlew "${BUILD_GRADLE_ARGS[@]}" assembleDebug
fi
cp app/build/outputs/apk/debug/app-debug.apk "$TASK_ROOT/output/little-explorer-1.1.0-debug.apk"
echo "APK: $TASK_ROOT/output/little-explorer-1.1.0-debug.apk"
