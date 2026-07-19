/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  forceUnlockBodyScroll,
  getBodyScrollLockCountForTests,
  lockBodyScroll,
  unlockBodyScroll,
} from "@/lib/ui/bodyScrollLock";

afterEach(() => {
  forceUnlockBodyScroll();
  document.body.style.cssText = "";
});

describe("bodyScrollLock", () => {
  it("locks and unlocks with nested counts", () => {
    expect(getBodyScrollLockCountForTests()).toBe(0);

    lockBodyScroll();
    lockBodyScroll();
    expect(getBodyScrollLockCountForTests()).toBe(2);
    expect(document.body.style.position).toBe("fixed");

    unlockBodyScroll();
    expect(getBodyScrollLockCountForTests()).toBe(1);
    expect(document.body.style.position).toBe("fixed");

    unlockBodyScroll();
    expect(getBodyScrollLockCountForTests()).toBe(0);
    expect(document.body.style.position).not.toBe("fixed");
  });

  it("forceUnlock clears stale lock", () => {
    lockBodyScroll();
    forceUnlockBodyScroll();
    expect(getBodyScrollLockCountForTests()).toBe(0);
    expect(document.body.style.position).not.toBe("fixed");
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
