/**
 * Lock document scroll without jumping the visual viewport.
 * Important for iOS Safari / in-app browsers when opening fixed modals.
 */

let lockCount = 0;
let savedScrollY = 0;
let savedBodyStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;

export function lockBodyScroll(): void {
  if (typeof document === "undefined") return;
  lockCount += 1;
  if (lockCount > 1) return;

  const body = document.body;
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  savedBodyStyles = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };

  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0 || !savedBodyStyles) return;

  const body = document.body;
  const y = savedScrollY;
  const prev = savedBodyStyles;
  savedBodyStyles = null;

  body.style.position = prev.position;
  body.style.top = prev.top;
  body.style.left = prev.left;
  body.style.right = prev.right;
  body.style.width = prev.width;
  body.style.overflow = prev.overflow;

  window.scrollTo(0, y);
}
