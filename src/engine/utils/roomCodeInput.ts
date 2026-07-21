/**
 * PixiJS has no native text input, so joining an online match needs a real
 * DOM <input> layered on top of the canvas — see the `.room-code-overlay`
 * markup in index.html / public/style.css, styled the same way as the
 * `.rotate-overlay` precedent in orientationGuard.ts.
 *
 * This module owns exactly one interaction: toggle the overlay on, wait for
 * either CONNECT (Enter key or button click) or CANCEL, tear down its own
 * listeners, hide the overlay again, and resolve. It never talks to
 * PeerTransport directly — JoinGameScreen owns the actual connect attempt
 * and renders its own Pixi "Connecting…"/error state, since by the time a
 * connection attempt can fail, this overlay has already closed.
 */
const OVERLAY_CLASS = "room-code-required";

/** Pure helper, extracted so it's unit-testable without a real DOM. */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Shows the room-code DOM overlay and resolves once the player either
 * submits a code (Enter or the CONNECT button — resolves the trimmed,
 * uppercased value) or cancels (resolves `null`). Always removes its
 * temporary listeners and hides the overlay again before resolving, on
 * both paths.
 *
 * Safe to call in a non-browser environment (guards on `window`/`document`
 * exactly like orientationGuard.ts) — resolves `null` immediately if the DOM
 * isn't available. In practice this is never called from tests (no jsdom in
 * this repo's vitest setup — see vitest.config.ts), this is defense in depth
 * only, so importing this module never throws.
 */
export function showRoomCodeInput(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      resolve(null);
      return;
    }

    const input = document.getElementById(
      "room-code-input",
    ) as HTMLInputElement | null;
    const connectBtn = document.getElementById(
      "room-code-connect",
    ) as HTMLButtonElement | null;
    const cancelBtn = document.getElementById(
      "room-code-cancel",
    ) as HTMLButtonElement | null;
    const errorEl = document.getElementById("room-code-error");

    if (!input || !connectBtn || !cancelBtn) {
      resolve(null);
      return;
    }

    input.value = "";
    if (errorEl) errorEl.textContent = "";

    let settled = false;

    // Arrow functions assigned to `const` (not `function` declarations) so
    // TypeScript keeps narrowing `input`/`connectBtn`/`cancelBtn` to their
    // non-null types inside these closures — it's referenced before its
    // textual declaration below (`settle` calls `onKeyDown`/`onConnect`/
    // `onCancel`), which is safe: `settle` is only ever invoked from event
    // listeners registered after all of these consts are initialized.
    const settle = (value: string | null): void => {
      if (settled) return;
      settled = true;
      document.body.classList.remove(OVERLAY_CLASS);
      input.removeEventListener("keydown", onKeyDown);
      connectBtn.removeEventListener("click", onConnect);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(value);
    };

    const onConnect = (): void => {
      settle(normalizeRoomCode(input.value));
    };

    const onCancel = (): void => {
      settle(null);
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Enter") onConnect();
    };

    input.addEventListener("keydown", onKeyDown);
    connectBtn.addEventListener("click", onConnect);
    cancelBtn.addEventListener("click", onCancel);

    document.body.classList.add(OVERLAY_CLASS);
    input.focus();
  });
}
