/**
 * Session-scoped "play once" guard for settlement presentation SFX/VFX.
 */

const MEMORY = new Set<string>();

function storageKey(prefix: string, key: string): string {
  return `${prefix}${key}`;
}

export function hasPlayedSfxOnce(prefix: string, key: string): boolean {
  const full = storageKey(prefix, key);
  if (MEMORY.has(full)) return true;
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(full) === "1";
  } catch {
    return false;
  }
}

export function markSfxPlayedOnce(prefix: string, key: string): void {
  const full = storageKey(prefix, key);
  MEMORY.add(full);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(full, "1");
  } catch {
    /* private mode */
  }
}
