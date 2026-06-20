/**
 * Thin wrapper around the global `CrazyGames.SDK` object (see ../crazygames-sdk.d.ts).
 * All calls are no-ops when the SDK script isn't present (e.g. local dev,
 * or builds hosted outside CrazyGames) so the rest of the game never needs to
 * check `window.CrazyGames` itself.
 */

import { bgm } from "../engine/audio/audio.ts";

export function isCrazyGamesAvailable(): boolean {
  return typeof window !== "undefined" && !!window.CrazyGames?.SDK;
}

/** Call once at startup, before the asset-loading phase begins. */
export async function crazyGamesInit(): Promise<void> {
  if (!isCrazyGamesAvailable()) return;
  try {
    await window.CrazyGames!.SDK.init();
  } catch {
    // Continue loading the game even if the SDK fails to initialize.
  }
}

/** Call once, right when the asset-loading phase begins (after init()). */
export function crazyGamesGameLoadingStart(): void {
  if (!isCrazyGamesAvailable()) return;
  window.CrazyGames!.SDK.game.loadingStart();
}

/** Call once asset loading has finished and the game is ready to display. */
export function crazyGamesGameLoadingFinished(): void {
  if (!isCrazyGamesAvailable()) return;
  window.CrazyGames!.SDK.game.loadingStop();
}

/** Call when the player starts/resumes active gameplay (a penalty shootout). */
export function crazyGamesGameplayStart(): void {
  if (!isCrazyGamesAvailable()) return;
  window.CrazyGames!.SDK.game.gameplayStart();
}

/** Call when active gameplay pauses or ends (results screens, menus). */
export function crazyGamesGameplayStop(): void {
  if (!isCrazyGamesAvailable()) return;
  window.CrazyGames!.SDK.game.gameplayStop();
}

/** Show a midgame ad at a natural pause between matches. Resolves when the ad ends or fails. */
export async function crazyGamesMidgameAd(): Promise<void> {
  if (!isCrazyGamesAvailable()) return;
  bgm.pause();
  return new Promise((resolve) => {
    window.CrazyGames!.SDK.ad.requestAd("midgame", {
      adFinished: () => {
        bgm.resume();
        resolve();
      },
      adError: () => {
        bgm.resume();
        resolve();
      },
    });
  });
}
