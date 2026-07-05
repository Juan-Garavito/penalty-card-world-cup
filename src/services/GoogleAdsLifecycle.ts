/**
 * Thin wrapper around the global `adBreak`/`adConfig` functions (see ../google-ads.d.ts).
 * `adBreak()` calls queue silently and never resolve if the account isn't approved yet
 * or the remote script fails to load, so every call here falls back to a timeout —
 * otherwise gameplay would hang waiting for an ad break that will never arrive.
 */

import { bgm } from "../engine/audio/audio.ts";

const AD_TIMEOUT_MS = 8000;

export function isGoogleAdsAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.adBreak === "function";
}

/** Call once at startup, before the asset-loading phase begins. */
export function googleAdsInit(): void {
  if (!isGoogleAdsAvailable()) return;
  window.adConfig!({ preloadAdBreaks: "on", sound: "on" });
}

/** Show an interstitial ad at a natural pause between matches. Resolves when it ends, fails, or times out. */
export async function googleAdsMidgameAd(): Promise<void> {
  if (!isGoogleAdsAvailable()) return;
  bgm.pause();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      bgm.resume();
      resolve();
    };
    setTimeout(finish, AD_TIMEOUT_MS);
    window.adBreak!({
      type: "next",
      name: "midgame",
      adBreakDone: finish,
    });
  });
}
