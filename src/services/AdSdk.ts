/**
 * Single integration point for portal ad SDKs (Poki, CrazyGames).
 * Dispatches to the provider selected at build time via `AD_SDK_PROVIDER`
 * (see ../config/adSdk.ts), falling back to the in-game mock ad modal
 * when the selected SDK isn't present (e.g. local dev).
 */

import { AD_SDK_PROVIDER } from "../config/adSdk.ts";
import type { Navigation } from "../engine/navigation/navigation.ts";
import type { IAdService } from "./IAdService.ts";
import {
  pokiInit,
  pokiGameLoadingFinished,
  pokiGameplayStart,
  pokiGameplayStop,
  pokiCommercialBreak,
  isPokiAvailable,
} from "./PokiLifecycle.ts";
import {
  crazyGamesInit,
  crazyGamesGameLoadingStart,
  crazyGamesGameLoadingFinished,
  crazyGamesGameplayStart,
  crazyGamesGameplayStop,
  crazyGamesMidgameAd,
  isCrazyGamesAvailable,
} from "./CrazyGamesLifecycle.ts";
import { PokiAdService } from "./PokiAdService.ts";
import { CrazyGamesAdService } from "./CrazyGamesAdService.ts";
import { MockAdService } from "./MockAdService.ts";
import { AdModalScreen } from "../screens/AdModalScreen.ts";

/** Call once at startup, before the asset-loading phase begins. */
export async function adInit(): Promise<void> {
  if (AD_SDK_PROVIDER === "crazygames") return crazyGamesInit();
  if (AD_SDK_PROVIDER === "poki") return pokiInit();
}

/** Call once, right when the asset-loading phase begins (after adInit()). */
export function adGameLoadingStart(): void {
  if (AD_SDK_PROVIDER === "crazygames") crazyGamesGameLoadingStart();
}

/** Call once asset loading has finished and the game is ready to display. */
export function adGameLoadingFinished(): void {
  if (AD_SDK_PROVIDER === "crazygames") crazyGamesGameLoadingFinished();
  else if (AD_SDK_PROVIDER === "poki") pokiGameLoadingFinished();
}

/** Call when the player starts/resumes active gameplay (a penalty shootout). */
export function adGameplayStart(): void {
  if (AD_SDK_PROVIDER === "crazygames") crazyGamesGameplayStart();
  else if (AD_SDK_PROVIDER === "poki") pokiGameplayStart();
}

/** Call when active gameplay pauses or ends (results screens, menus). */
export function adGameplayStop(): void {
  if (AD_SDK_PROVIDER === "crazygames") crazyGamesGameplayStop();
  else if (AD_SDK_PROVIDER === "poki") pokiGameplayStop();
}

/** Show a portal ad break at a natural pause between matches. Resolves when it ends. */
export async function adBreak(): Promise<void> {
  if (AD_SDK_PROVIDER === "crazygames") return crazyGamesMidgameAd();
  if (AD_SDK_PROVIDER === "poki") return pokiCommercialBreak();
}

/** Returns the rewarded-ad adapter for the active provider, or the mock modal as a fallback. */
export function createAdService(navigation: Navigation): IAdService {
  if (AD_SDK_PROVIDER === "crazygames" && isCrazyGamesAvailable()) {
    return new CrazyGamesAdService();
  }
  if (AD_SDK_PROVIDER === "poki" && isPokiAvailable()) {
    return new PokiAdService();
  }
  return new MockAdService(() => new AdModalScreen(), navigation);
}
