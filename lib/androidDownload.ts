/** Android debug APK served from `/public/downloads/`. */
export const ANDROID_APK_SHA256 =
  "41743b01c873f0388e0c96cadf26eb5a7ce65242759d96d221c85ef85b7e8c9b" as const;

export const ANDROID_BUILD_DATE = "2026-07-23" as const;

export const ANDROID_APK_VERSIONED_FILENAME = "hansome-android-2026-07-23.apk" as const;
export const ANDROID_APK_STABLE_FILENAME = "hansome-android.apk" as const;

export const ANDROID_APK_VERSIONED_PATH = `/downloads/${ANDROID_APK_VERSIONED_FILENAME}` as const;
export const ANDROID_APK_STABLE_PATH = `/downloads/${ANDROID_APK_STABLE_FILENAME}` as const;

/** Preferred public URL on the game host (same file as stable path). */
export const ANDROID_APK_PUBLIC_URL =
  "https://game.hansomealpacas.xyz/downloads/hansome-android.apk" as const;

export const GAME_HOME_URL = "https://game.hansomealpacas.xyz/" as const;
