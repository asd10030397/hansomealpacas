/**
 * Capacitor / native shell detection without bundling @capacitor/core in the web app.
 * Capacitor injects `window.Capacitor` into the WebView at runtime.
 */

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  return w.Capacitor?.isNativePlatform?.() === true;
}

export function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** APK WebView must not rely on window.ethereum; use WalletConnect relay session instead. */
export function shouldPreferWalletConnect(hasProvider: boolean): boolean {
  if (isCapacitorNative()) return true;
  if (hasProvider) return false;
  return isMobileUserAgent();
}
