import type { IAdService } from "./IAdService.ts";
import { isPokiAvailable } from "./PokiLifecycle.ts";
import { bgm } from "../engine/audio/audio.ts";

/** Rewarded-ad adapter backed by `PokiSDK.rewardedBreak()`. */
export class PokiAdService implements IAdService {
  async showAd(): Promise<boolean> {
    if (!isPokiAvailable()) return false;
    bgm.pause();
    try {
      return await window.PokiSDK!.rewardedBreak();
    } catch {
      return false;
    } finally {
      bgm.resume();
    }
  }
}
