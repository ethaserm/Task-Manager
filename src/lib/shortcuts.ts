/**
 * Bridge to the iOS Shortcuts app.
 *
 * iOS gives web pages no way to block apps, but Shortcuts can: a personal
 * automation fires when a blocked app opens, reads an "unlocked until" file,
 * and bounces you out if the window has passed. This writes that file by
 * running a shortcut through its URL scheme.
 */

const SCHEME = "shortcuts://run-shortcut";

export const UNLOCK_SHORTCUT = "Unlock";
export const LOCK_SHORTCUT = "Lock";

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, so check for touch as well.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Hands `input` to a named shortcut. No-op off iOS. */
export function runShortcut(name: string, input: string | number = "") {
  if (!isIOS()) return;
  const url = `${SCHEME}?name=${encodeURIComponent(name)}&input=${encodeURIComponent(String(input))}`;
  window.location.href = url;
}
