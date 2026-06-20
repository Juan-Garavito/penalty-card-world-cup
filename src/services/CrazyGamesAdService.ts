import type { IAdService } from "./IAdService.ts";
import { isCrazyGamesAvailable } from "./CrazyGamesLifecycle.ts";
import { bgm } from "../engine/audio/audio.ts";

/** Rewarded-ad adapter backed by `CrazyGames.SDK.ad.requestAd("rewarded", ...)`. */
export class CrazyGamesAdService implements IAdService {
  async showAd(): Promise<boolean> {
    if (!isCrazyGamesAvailable()) return false;
    bgm.pause();
    return new Promise((resolve) => {
      window.CrazyGames!.SDK.ad.requestAd("rewarded", {
        adFinished: () => {
          bgm.resume();
          resolve(true);
        },
        adError: () => {
          bgm.resume();
          resolve(false);
        },
      });
    });
  }
}
