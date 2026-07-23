"use client";

import { useCapacitorWalletResume } from "@/hooks/game/useCapacitorWalletResume";

/** No-op on web; on Capacitor WebView keeps WalletConnect sessions in sync after wallet app return. */
export function CapacitorWalletBridge() {
  useCapacitorWalletResume();
  return null;
}
