/**
 * Thin wrapper around the global `PokiSDK` object (see ../poki-sdk.d.ts).
 * All calls are no-ops when the SDK script isn't present (e.g. local dev,
 * or builds hosted outside Poki) so the rest of the game never needs to
 * check `window.PokiSDK` itself.
 */

import { bgm } from "../engine/audio/audio.ts";

export function isPokiAvailable(): boolean {
  return typeof window !== "undefined" && !!window.PokiSDK;
}

/** Call once at startup, before the asset-loading phase begins. */
export async function pokiInit(): Promise<void> {
  if (!isPokiAvailable()) return;
  try {
    await window.PokiSDK!.init();
  } catch {
    // Continue loading the game even if the SDK fails to initialize.
  }
}

/** Call once asset loading has finished and the game is ready to display. */
export function pokiGameLoadingFinished(): void {
  if (!isPokiAvailable()) return;
  window.PokiSDK!.gameLoadingFinished();
}

/** Call when the player starts/resumes active gameplay (a penalty shootout). */
export function pokiGameplayStart(): void {
  if (!isPokiAvailable()) return;
  window.PokiSDK!.gameplayStart();
}

/** Call when active gameplay pauses or ends (results screens, menus). */
export function pokiGameplayStop(): void {
  if (!isPokiAvailable()) return;
  window.PokiSDK!.gameplayStop();
}

/** Show a commercial break at a natural pause between matches. Resolves when the break ends. */
export async function pokiCommercialBreak(): Promise<void> {
  if (!isPokiAvailable()) return;
  bgm.pause();
  try {
    await window.PokiSDK!.commercialBreak();
  } catch {
    // Ad failed or was skipped — continue regardless.
  } finally {
    bgm.resume();
  }
}
