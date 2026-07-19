/**
 * Mobile-safe scroll to game sections (sticky header aware).
 * Presentation / UX only.
 */

export const GAME_SECTION_IDS = {
  commit: "commit-section",
  autoReveal: "auto-reveal-section",
  battleResults: "battle-results-section",
} as const;

export type GameSectionId =
  (typeof GAME_SECTION_IDS)[keyof typeof GAME_SECTION_IDS];

/** Fallback when `.game-nav` is not measurable yet. */
const FALLBACK_STICKY_OFFSET_PX = 72;

const DEFAULT_RETRY_DELAYS_MS = [0, 80, 200, 450] as const;

export function measureGameStickyOffset(): number {
  if (typeof document === "undefined") return FALLBACK_STICKY_OFFSET_PX;
  const nav = document.querySelector(
    ".hansome-game .game-nav",
  ) as HTMLElement | null;
  if (!nav) return FALLBACK_STICKY_OFFSET_PX;
  return Math.ceil(nav.getBoundingClientRect().height) + 8;
}

/**
 * Scroll so `sectionId` sits below the sticky game header.
 * Returns false if the element is not in the DOM yet.
 */
export function scrollToGameSection(
  sectionId: string,
  opts?: { offset?: number; behavior?: ScrollBehavior },
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  const el = document.getElementById(sectionId);
  if (!el) return false;

  const offset = opts?.offset ?? measureGameStickyOffset();
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: opts?.behavior ?? "smooth",
  });
  return true;
}

/**
 * Retry briefly while responsive layout / route content mounts.
 * Returns a cancel function.
 */
export function scrollToGameSectionWithRetry(
  sectionId: string,
  opts?: { offset?: number; delaysMs?: readonly number[] },
): () => void {
  if (typeof window === "undefined") return () => {};

  const delays = opts?.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const timers: number[] = [];
  let done = false;

  for (const delay of delays) {
    timers.push(
      window.setTimeout(() => {
        if (done) return;
        if (
          scrollToGameSection(sectionId, {
            offset: opts?.offset,
            behavior: "smooth",
          })
        ) {
          done = true;
        }
      }, delay),
    );
  }

  return () => {
    done = true;
    for (const id of timers) window.clearTimeout(id);
  };
}
