/** Plain-text only — strip HTML and control chars for forum posts. */

const HTML_TAG = /<[^>]*>/g;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeForumText(input: string, maxLen: number): string {
  let text = input.replace(HTML_TAG, "").replace(CONTROL, "");
  text = text.replace(/\r\n/g, "\n").trim();
  if (text.length > maxLen) {
    text = text.slice(0, maxLen);
  }
  return text;
}

export function isForumTextValid(input: string, minLen = 1): boolean {
  const trimmed = input.trim();
  return trimmed.length >= minLen && !HTML_TAG.test(trimmed);
}

/** Derive a short list title from thread body (first line, then ~40–80 chars). */
export function deriveForumTitle(body: string, maxTitleLen: number): string {
  const sanitized = sanitizeForumText(body, Number.MAX_SAFE_INTEGER);
  const firstLine =
    sanitized.split("\n").find((line) => line.trim().length > 0) ?? sanitized;
  const collapsed = firstLine.replace(/\s+/g, " ").trim();
  if (!collapsed) return "";

  const preferredMax = Math.min(80, maxTitleLen);
  if (collapsed.length <= preferredMax) {
    return collapsed.slice(0, maxTitleLen);
  }

  let cut = collapsed.slice(0, preferredMax);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace >= 40) {
    cut = cut.slice(0, lastSpace);
  }
  const trimmed = cut.trim();
  if (trimmed) return trimmed.slice(0, maxTitleLen);

  return collapsed.slice(0, Math.min(40, maxTitleLen)).trim();
}
