/**
 * Shows a "rotate your device" DOM overlay when the game is viewed on a
 * narrow, portrait-oriented viewport (phones held vertically). The game's
 * virtual canvas is always landscape (1280x720) — see HomeScreen.ts,
 * LoadingScreen.ts — so portrait phones render cramped/broken without this.
 *
 * Pure DOM/CSS feature: toggles a class on <body>; never touches the Pixi
 * canvas, ticker, or CreationResizePlugin/resize.ts (those keep scaling the
 * canvas exactly as before — this overlay just sits visually on top of it).
 */
// `pointer: coarse` targets touchscreens specifically — unlike a max-width
// threshold, it never false-positives on a narrow-but-tall desktop browser
// window (confirmed via a real headless-browser check during development:
// an 850px-wide desktop window incorrectly matched `max-width: 900px`).
const ROTATE_QUERY = "(orientation: portrait) and (pointer: coarse)";
const ROTATE_CLASS = "rotate-required";

/** Pure helper, extracted so it's unit-testable without a real MediaQueryList. */
export function shouldShowRotateOverlay(matches: boolean): boolean {
  return matches;
}

function applyState(matches: boolean): void {
  document.body.classList.toggle(
    ROTATE_CLASS,
    shouldShowRotateOverlay(matches),
  );
}

/**
 * Attaches a live matchMedia listener that toggles `body.rotate-required`.
 * Safe to call in non-browser environments (e.g. Vitest's Node test
 * environment) — becomes a no-op if `window.matchMedia` isn't available,
 * mirroring the guard pattern used for document.fonts in engine.ts.
 */
export function watchOrientation(): void {
  if (typeof window === "undefined" || !("matchMedia" in window)) return;

  const mql = window.matchMedia(ROTATE_QUERY);
  applyState(mql.matches);

  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", (e) => applyState(e.matches));
  } else if (typeof mql.addListener === "function") {
    // Deprecated fallback for older Safari, which lacks addEventListener on MediaQueryList.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    mql.addListener((e) => applyState(e.matches));
  }
}
